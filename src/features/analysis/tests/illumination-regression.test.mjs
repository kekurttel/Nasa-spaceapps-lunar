import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIllumination } from '../illumination.mjs';

const grid = { width: 1, height: 1, units: 'm', crs: 'LOCAL_METRIC', originXM: 0, originYM: 0, pixelSizeXM: 1, pixelSizeYM: 1 };
function series(frames) {
  return { schemaVersion: 'temporal-illumination/v1', grid, startUtc: '2026-01-01T00:00:00Z', endUtc: '2026-01-01T00:00:10Z', frames: frames.map(([startUtc, endUtc, fraction]) => ({ startUtc, endUtc, fractions: [fraction] })) };
}

test('caps floating-point coverage at one when adjacent intervals add slightly over duration', () => {
  const result = analyzeIllumination(series([
    ['2026-01-01T00:00:00Z', '2026-01-01T00:00:03.333Z', 0],
    ['2026-01-01T00:00:03.333Z', '2026-01-01T00:00:06.667Z', 0],
    ['2026-01-01T00:00:06.667Z', '2026-01-01T00:00:10Z', 1],
  ])).cells[0];
  assert.equal(result.metrics.illuminationCoverageFraction, 1);
  assert.equal(result.longTermAssessment.nodalCycleDurationSatisfied, false);
});

test('does not predict next sunlight across an uncovered interval', () => {
  const result = analyzeIllumination(series([
    ['2026-01-01T00:00:00Z', '2026-01-01T00:00:02Z', 0],
    ['2026-01-01T00:00:05Z', '2026-01-01T00:00:10Z', 1],
  ]), { atUtc: '2026-01-01T00:00:01Z' }).cells[0];
  assert.equal(result.metrics.timeToNextSunlightSeconds, null);
  assert.equal(result.metrics.uncertaintyClass, 'INCOMPLETE_TEMPORAL_COVERAGE');
});
