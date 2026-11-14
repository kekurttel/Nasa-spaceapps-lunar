import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSkySeries } from '../index.ts';
import type { Scenario, MoonFixedDataset } from '../index.ts';

const dataset: MoonFixedDataset = {
  id: 'synthetic-integration-only', frame: 'IAU_MOON',
  source: 'Analytical axes for software testing, not astronomical observations',
  sourceUrl: 'https://example.invalid/synthetic-test', timeScale: 'UTC',
  corrections: 'geometric', dataKind: 'synthetic',
  samples: ['2026-01-01T00:00:00.000Z', '2026-01-01T00:02:00.000Z'].map(timeUtc => ({
    timeUtc, sunKm: { x: 149597870, y: 2000000, z: 1000000 },
    earthKm: { x: 384400, y: 3000, z: -2000 },
  })),
};
function scenario(latDeg = 0, lonDeg = 0): Scenario {
  return { id: 'test', site: { id: 'custom', name: 'Test', latDeg, lonDeg,
    surfaceElevationM: null, observerHeightM: 2, kind: 'custom', sourceIds: [] },
  startUtc: '2026-01-01T00:00:00.000Z', endUtc: '2026-01-01T00:02:00.000Z', stepSeconds: 60 };
}

test('three sites x three times: deterministic aligned finite arrays, not accuracy validation', () => {
  const outputs = [[0, 0], [45, 30], [-89.5, 45]].map(([lat, lon]) => {
    const input = scenario(lat, lon);
    const result = computeSkySeries(input, dataset);
    assert.deepEqual(result, computeSkySeries(input, dataset));
    assert.equal(result.timesUtc.length, 3);
    for (const key of ['sunAltDeg', 'sunAzDeg', 'earthAltDeg', 'earthAzDeg', 'sunRadiusDeg'] as const) {
      assert.equal(result[key].length, 3);
      assert.ok(result[key].every(Number.isFinite));
    }
    assert.ok(result.sunAzDeg.every(a => a >= 0 && a < 360));
    assert.ok(result.earthAzDeg.every(a => a >= 0 && a < 360));
    assert.equal(result.quality.dataKind, 'synthetic');
    assert.ok(result.quality.warnings.some(w => w.includes('independent accuracy validation')));
    assert.ok(result.quality.warnings.some(w => w.includes('Unknown surface')));
    assert.ok(result.sunRadiusDeg.every(a => a > 0.26 && a < 0.28));
    return result;
  });
  assert.notEqual(outputs[0].sunAltDeg[0], outputs[1].sunAltDeg[0]);
  assert.notEqual(outputs[1].earthAltDeg[0], outputs[2].earthAltDeg[0]);
});

test('absent production data fails explicitly instead of silently returning test data', () => {
  assert.throws(() => computeSkySeries(scenario()), { code: 'EPHEMERIS_DATA_UNAVAILABLE' });
});

test('height changes nearby Earth direction (observer parallax)', () => {
  const low = scenario(45, 30);
  low.site.surfaceElevationM = 0;
  const high = structuredClone(low);
  high.site.observerHeightM = 10000;
  assert.notEqual(computeSkySeries(low, dataset).earthAltDeg[0], computeSkySeries(high, dataset).earthAltDeg[0]);
});
