import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadTerrainHorizon } from '../src/features/visibility/terrain.mjs';
import { fetchLola } from '../scripts/fetch-lola.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const execFileAsync = promisify(execFile);

async function cli(args) {
  return execFileAsync(process.execPath, [resolve(root, 'scripts/run-real-terrain.mjs'), ...args], { cwd: root, timeout: 120000 });
}

test('manifest describes the locally supplied NASA LOLA pair accurately', async () => {
  const manifest = JSON.parse(await readFile(resolve(root, 'data/lola-manifest.json'), 'utf8'));
  for (const [key, entry] of Object.entries(manifest.files)) {
    const bytes = await readFile(resolve(root, entry.path));
    assert.equal(bytes.length, entry.bytes, `${key} byte count`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256.toLowerCase(), `${key} SHA-256`);
  }
  assert.match(manifest.resolution, /4 pixels\/degree/);
  assert.match(manifest.attribution, /endorsement is not implied/);
});

test('fetch reuses verified local files without making requests', async () => {
  let calls = 0;
  await fetchLola({ fetchImpl: async () => { calls++; throw new Error('unexpected network request'); } });
  assert.equal(calls, 0);
});

test('fetch rejects oversized response streams before buffering unbounded data', async () => {
  const manifest = JSON.parse(await readFile(resolve(root, 'data/lola-manifest.json'), 'utf8'));
  const record = manifest.files.label;
  const chunk = new Uint8Array(1024 * 1024);
  let cancelled = false;
  const fetchImpl = async () => new Response(new ReadableStream({
    pull(controller) { controller.enqueue(chunk); },
    cancel() { cancelled = true; }
  }), { status: 200 });
  await assert.rejects(fetchLola({ force: true, fetchImpl }), /size limit/);
  assert.ok(cancelled);
  assert.equal((await readFile(resolve(root, record.path))).length, record.bytes);
});

test('forced fetch rejects wrong bytes and preserves existing raw files', async () => {
  const manifest = JSON.parse(await readFile(resolve(root, 'data/lola-manifest.json'), 'utf8'));
  const record = manifest.files.label;
  const before = await readFile(resolve(root, record.path));
  const wrongBytes = new Uint8Array(record.bytes);
  await assert.rejects(fetchLola({ force: true, fetchImpl: async () => new Response(wrongBytes) }), /size\/hash mismatch/);
  assert.deepEqual(await readFile(resolve(root, record.path)), before);
});

test('real CLI emits a terrain document from the supplied DEM and loader accepts it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lola-workflow-'));
  try {
    const output = join(dir, 'terrain.json');
    await cli(['--site-id', 'workflow-test', '--lat', '-89.9', '--lon', '0', '--height', '2', '--max-distance', '4000', '--distance-step', '2000', '--output', output]);
    const document = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(document.profile.siteId, 'workflow-test');
    assert.equal(document.profile.model, 'terrain');
    assert.equal(document.profile.dataKind, 'real');
    assert.equal(document.profile.azimuthDeg.length, 72);
    assert.equal(document.profile.elevationDeg.length, 72);
    assert.ok(document.profile.elevationDeg.every(Number.isFinite));
    assert.equal(document.coverage.frame, 'ME_DE421_LOCAL_NORTH_EAST');
    assert.equal(document.coverage.azimuthCoverage, 'full-circle');
    assert.equal(document.provenance.sha256, JSON.parse(await readFile(resolve(root, 'data/lola-manifest.json'), 'utf8')).files.image.sha256.toLowerCase());
    assert.ok(document.profile.warnings.some(w => /coarse/i.test(w)));
    assert.equal(loadTerrainHorizon(document, { siteId: 'workflow-test', observerHeightM: 2, frame: document.coverage.frame, strictTerrain: true }), document.profile);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('synthetic SkySeries integration is mixed and real sky is rejected without provenance', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lola-visibility-'));
  try {
    const skyPath = join(dir, 'sky.json'), output = join(dir, 'result.json');
    const sky = { scenarioId: 'test-scenario', timesUtc: ['2026-01-01T00:00:00Z'], sunAltDeg: [10], sunAzDeg: [0], earthAltDeg: [10], earthAzDeg: [0], sunRadiusDeg: [0.27], quality: { dataKind: 'synthetic', model: 'test-only', frame: 'ME_DE421_LOCAL_NORTH_EAST', warnings: ['Synthetic test fixture; not ephemeris data.'] } };
    await (await import('node:fs/promises')).writeFile(skyPath, JSON.stringify(sky));
    await cli(['--site-id', 'workflow-test', '--lat', '-89.9', '--lon', '0', '--height', '2', '--max-distance', '4000', '--distance-step', '2000', '--sky', skyPath, '--output', output]);
    const result = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(result.visibility.quality.dataKind, 'mixed');
    assert.equal(result.visibility.scenarioId, 'test-scenario');
    await (await import('node:fs/promises')).writeFile(skyPath, JSON.stringify({ ...sky, quality: { ...sky.quality, dataKind: 'real' } }));
    await assert.rejects(cli(['--site-id', 'workflow-test', '--lat', '-89.9', '--lon', '0', '--height', '2', '--max-distance', '4000', '--distance-step', '2000', '--sky', skyPath, '--output', output]), /provenance/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
