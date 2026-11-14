import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { datasetWarnings } from '../dataQuality.ts';
import { computeSkySeries } from '../index.ts';
import type { MoonFixedDataset } from '../index.ts';
const real: MoonFixedDataset = JSON.parse(readFileSync(new URL('../fixtures/real-moon-vectors.json', import.meta.url), 'utf8'));

test('bundled real data has no conservative physical outlier warnings', () => {
  assert.deepEqual(datasetWarnings(real), []);
});

test('direction discontinuity is flagged without changing supplied vectors', () => {
  const dataset = structuredClone(real);
  dataset.samples[1].earthKm = { x: -dataset.samples[0].earthKm.x,
    y: -dataset.samples[0].earthKm.y, z: -dataset.samples[0].earthKm.z };
  const before = structuredClone(dataset);
  assert.ok(datasetWarnings(dataset).some(w => w.includes('discontinuity')));
  assert.deepEqual(dataset, before);
});

test('exact zenith gives explicit azimuth warning while keeping SkySeries numeric contract', () => {
  const dataset = structuredClone(real);
  for (const sample of dataset.samples) sample.sunKm = { x: 150000000, y: 0, z: 0 };
  const result = computeSkySeries({ id: 'zenith', site: { id: 'test', name: 'Test', latDeg: 0,
    lonDeg: 0, surfaceElevationM: 0, observerHeightM: 0, kind: 'custom', sourceIds: [] },
    startUtc: '2026-01-01T00:00:00.000Z', endUtc: '2026-01-01T00:00:00.000Z', stepSeconds: 60 }, dataset);
  assert.equal(result.sunAltDeg[0], 90);
  assert.ok(Number.isFinite(result.sunAzDeg[0]));
  assert.ok(result.quality.warnings.some(w => w.includes('undefined at zenith/nadir')));
});
