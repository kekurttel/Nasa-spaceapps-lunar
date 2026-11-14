import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeSkySeries } from '../index.ts';
const dataset = JSON.parse(readFileSync(new URL('../fixtures/real-moon-vectors.json', import.meta.url), 'utf8'));
const report = JSON.parse(readFileSync(new URL('../fixtures/validation-report.json', import.meta.url), 'utf8'));
test('bundled real SPICE data computes offline and names its source', () => {
  const result = computeSkySeries({ id: 'real-demo', site: { id: 'equator', name: 'Equator', latDeg: 0,
    lonDeg: 0, surfaceElevationM: 0, observerHeightM: 2, kind: 'custom', sourceIds: [] },
    startUtc: '2026-01-01T00:00:00.000Z', endUtc: '2026-01-02T00:00:00.000Z', stepSeconds: 3600 }, dataset);
  assert.equal(result.quality.dataKind, 'real');
  assert.ok(result.quality.model.includes(dataset.source));
  assert.equal(result.timesUtc.length, 25);
  assert.ok(result.sunAltDeg.every(Number.isFinite));
});
test('saved independent comparison covers 78 directions including between-hour times below 0.1 degree', () => {
  assert.equal(report.measurements.length, 78);
  assert.ok(report.measurements.every((m: { separationDeg: number }) => Number.isFinite(m.separationDeg) && m.separationDeg < 0.1));
});
