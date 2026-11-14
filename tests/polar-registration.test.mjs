import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs, runPolarAnalysis } from '../scripts/run-polar-analysis.mjs';

const testTempRoot = resolve(process.env.LOCALAPPDATA ?? process.env.TEMP ?? tmpdir(), 'Temp', 'opencode');

test('polar analysis rejects exact pole because local azimuth is undefined', async () => {
  await assert.rejects(runPolarAnalysis({ latitudeDeg: -90 }), /latitude in \(-90, -80\]/);
});

test('polar analysis rejects invalid count, UTC timestamp, and duplicate sub-millisecond samples', async () => {
  await assert.rejects(runPolarAnalysis({ count: 10001 }), /count in \[1, 10000\]/);
  await assert.rejects(runPolarAnalysis({ start: '2026-02-30T00:00:00Z' }), /Valid UTC start/);
  await assert.rejects(runPolarAnalysis({ count: 2, stepMinutes: 0.000001 }), /distinct UTC timestamps/);
});

test('polar analysis rejects unsupported latitude and ray workload before loading data', async () => {
  await assert.rejects(runPolarAnalysis({ latitudeDeg: 0 }), /latitude in \(-90, -80\]/);
  await assert.rejects(runPolarAnalysis({ azimuthStepDeg: 1, distanceStepM: 1, maxDistanceM: 200000 }), /workload exceeds supported limit/);
  await assert.rejects(runPolarAnalysis({ azimuthStepDeg: 360, maxDistanceM: 200000 }), /full-circle coverage/);
  await assert.rejects(runPolarAnalysis({ azimuthStepDeg: 180, maxDistanceM: 0.1 }), /full-circle coverage/);
});

test('polar CLI parser rejects unknown options', () => {
  assert.throws(() => parseArgs(['--bogus', '1']), /Unknown option/);
});

test('polar CLI parser rejects invalid numeric inputs', () => {
  assert.throws(() => parseArgs(['--lat', 'NaN']), /Invalid numeric value/);
  assert.throws(() => parseArgs(['--count', 'Infinity']), /Invalid numeric value/);
});

test('real PDS LDEM_80S_80M terrain registers against generated sky and computes visibility', async () => {
  await mkdir(testTempRoot, { recursive: true });
  const temp = await mkdtemp(join(testTempRoot, 'polar-registration-test-'));
  try {
    const { result } = await runPolarAnalysis({
      siteId: 'polar-real-integration', latitudeDeg: -89.9, longitudeDeg: 0,
      observerHeightM: 2, start: '2026-11-14T00:00:00Z', count: 2, stepMinutes: 5,
      azimuthStepDeg: 90, distanceStepM: 240, maxDistanceM: 1000,
      output: resolve(temp, 'result.json')
    });
    assert.equal(result.registrationValidation.valid, true);
    assert.ok(Object.values(result.registrationValidation.checks).every(Boolean));
    assert.equal(result.horizonDocument.profile.dataKind, 'real');
    assert.equal(result.horizonDocument.provenance.product, 'LDEM_80S_80M');
    assert.equal(result.horizonDocument.provenance.sha256, 'c088dd4f510e879375ee7e6f0d320ba84115f535f45fb592dd7f83a7d2e83ae3');
    assert.ok(Math.abs(result.horizonDocument.provenance.surfaceHeightM - 625.953454) < 1e-6);
    assert.equal(result.sky.quality.dataKind, 'real');
    assert.equal(result.registrationValidation.checks.documentFrame, true);
    assert.equal(result.registrationValidation.checks.terrainSha256, true);
    assert.equal(result.visibility.scenarioId, 'polar-polar-real-integration');
    assert.equal(result.visibility.timesUtc.length, 2);
    assert.equal(result.visibility.quality.dataKind, 'real');
    assert.equal(result.horizonDocument.coverage.requestedMaximumDistanceM, 1000);
    assert.equal(result.horizonDocument.coverage.maximumDistanceM, 960);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
