import test from 'node:test';
import assert from 'node:assert/strict';
import { createCustomSite } from '../../src/features/data/index.mjs';
import { computeSkySeries } from '../../src/features/ephemeris/index.ts';
import dataset from '../../src/features/ephemeris/fixtures/real-moon-vectors.json' with { type: 'json' };
import { createFlatHorizon } from '../../src/features/visibility/terrain.mjs';
import { computeVisibility } from '../../src/features/visibility/visibility.mjs';
import { analyzeVisibility, compareScenarios, serializeComparisonCsv } from '../../src/features/analysis/index.mjs';

function run(id, endUtc) {
  const checked = createCustomSite({ id: 'acceptance-location', name: 'Software acceptance example', latDeg: -85.29, lonDeg: 31.95, surfaceElevationM: 0, observerHeightM: 2, sourceIds: [] });
  assert.equal(checked.ok, true);
  const scenario = { id, site: checked.value, startUtc: '2026-01-01T00:00:00Z', endUtc, stepSeconds: 3600 };
  const sky = computeSkySeries(scenario, dataset);
  const horizon = createFlatHorizon({ siteId: scenario.site.id, observerHeightM: 2 });
  const series = computeVisibility(sky, horizon, { siteId: scenario.site.id, observerHeightM: 2, frame: sky.quality.frame, horizonFrame: sky.quality.frame });
  series.quality.model = sky.quality.model;
  series.quality.frame = sky.quality.frame;
  const analysis = analyzeVisibility(scenario, series);
  return { scenario, series, sky, analysis };
}

test('real bundled sky plus explicitly synthetic flat horizon stays mixed and totals 24h, not 25h', () => {
  const { sky, analysis } = run('full', '2026-01-02T00:00:00Z');
  assert.equal(sky.timesUtc.length, 25);
  assert.equal(analysis.metrics.durationSeconds, 86400);
  assert.equal(analysis.quality.dataKind, 'mixed');
  assert.equal(analysis.quality.horizonModel, 'flat');
  for (const field of ['sunAnyFraction', 'sunEquivalentFraction', 'earthVisibleFraction', 'bothFraction']) assert.ok(analysis.metrics[field] >= 0 && analysis.metrics[field] <= 1);
  for (const windows of Object.values(analysis.windows)) assert.ok(windows.reduce((sum, w) => sum + w.durationSeconds, 0) <= 86400);
});

test('unaligned end contributes only final half hour and comparison CSV retains model/frame', () => {
  const full = run('full', '2026-01-02T00:00:00Z');
  const partial = run('partial', '2026-01-01T23:30:00Z');
  assert.equal(partial.sky.timesUtc.length, 24);
  assert.equal(partial.analysis.metrics.durationSeconds, 84600);
  const entries = [full, partial].map(({ scenario, series }) => ({ scenario, series }));
  assert.equal(compareScenarios(entries).comparisons.length, 2);
  const csv = serializeComparisonCsv(entries);
  assert.match(csv, /IAU_MOON/);
  assert.match(csv, /mixed/);
  assert.match(csv, /84600/);
});
