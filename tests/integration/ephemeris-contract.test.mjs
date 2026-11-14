import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSkySeries } from '../../src/features/ephemeris/index.ts';
import { buildScenarioTimes, ScenarioError } from '../../src/features/ephemeris/scenario.ts';
import { readFile } from 'node:fs/promises';

const realDataset = JSON.parse(await readFile(new URL('../../src/features/ephemeris/fixtures/real-moon-vectors.json', import.meta.url), 'utf8'));
const scenario = {
  id: 'real-demo',
  site: { id: 'site', name: 'Equator', latDeg: 0, lonDeg: 0, surfaceElevationM: 0, observerHeightM: 2, kind: 'test', sourceIds: [] },
  startUtc: '2026-01-01T00:00:00Z', endUtc: '2026-01-01T02:00:00Z', stepSeconds: 3600,
};

test('real packaged dataset supplies aligned finite IAU_MOON SkySeries over documented coverage', () => {
  const series = computeSkySeries(scenario, realDataset);
  assert.equal(series.quality.dataKind, 'real');
  assert.equal(series.quality.frame, 'IAU_MOON');
  assert.deepEqual(series.timesUtc, ['2026-01-01T00:00:00.000Z', '2026-01-01T01:00:00.000Z', '2026-01-01T02:00:00.000Z']);
  for (const values of [series.sunAltDeg, series.sunAzDeg, series.earthAltDeg, series.earthAzDeg, series.sunRadiusDeg]) {
    assert.equal(values.length, series.timesUtc.length);
    assert.ok(values.every(Number.isFinite));
  }
});

test('UTC accepts seconds with no milliseconds and end boundary is grid-inclusive only', () => {
  assert.deepEqual(buildScenarioTimes(scenario), ['2026-01-01T00:00:00.000Z', '2026-01-01T01:00:00.000Z', '2026-01-01T02:00:00.000Z']);
  assert.deepEqual(buildScenarioTimes({ ...scenario, endUtc: '2026-01-01T02:00:01Z' }), ['2026-01-01T00:00:00.000Z', '2026-01-01T01:00:00.000Z', '2026-01-01T02:00:00.000Z']);
});

test('out-of-coverage and missing dataset fail, never synthesize a result', () => {
  assert.throws(() => computeSkySeries({ ...scenario, startUtc: '2026-01-02T00:00:01Z', endUtc: '2026-01-02T00:00:01Z' }, realDataset), { code: 'EPHEMERIS_OUT_OF_RANGE' });
  assert.throws(() => computeSkySeries(scenario), { code: 'EPHEMERIS_DATA_UNAVAILABLE' });
  assert.throws(() => buildScenarioTimes({ ...scenario, startUtc: '2026-01-01T00:00:00+00:00' }), (error) => error instanceof ScenarioError && error.code === 'EPHEMERIS_INVALID_UTC');
});
