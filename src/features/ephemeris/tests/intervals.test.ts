import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScenarioTimes } from '../scenario.ts';
import { sampleDurationsSeconds } from '../intervals.ts';
const site = { id: 'test', name: 'Test', latDeg: 0, lonDeg: 0, surfaceElevationM: 0,
  observerHeightM: 2, kind: 'custom', sourceIds: [] };

test('24 hours at two-hour steps produces 13 boundaries but exactly 24 hours duration', () => {
  const scenario = { id: 'day', site, startUtc: '2026-01-01T00:00:00.000Z',
    endUtc: '2026-01-02T00:00:00.000Z', stepSeconds: 7200 };
  const times = buildScenarioTimes(scenario);
  const durations = sampleDurationsSeconds(times, scenario.endUtc);
  assert.equal(times.length, 13);
  assert.equal(durations.at(-1), 0);
  assert.equal(durations.reduce((a, b) => a + b, 0), 86400);
});
test('irregular last interval preserves exact scenario duration', () => {
  const times = ['2026-01-01T00:00:00Z', '2026-01-01T02:00:00Z'];
  assert.deepEqual(sampleDurationsSeconds(times, '2026-01-01T03:00:00Z'), [7200, 3600]);
});
test('invalid or reversed boundary arrays fail rather than producing negative durations', () => {
  assert.throws(() => sampleDurationsSeconds([], '2026-01-01T03:00:00Z'));
  assert.throws(() => sampleDurationsSeconds(['2026-01-02T00:00:00Z'], '2026-01-01T03:00:00Z'));
  assert.throws(() => sampleDurationsSeconds(['bad'], '2026-01-01T03:00:00Z'));
  assert.throws(() => sampleDurationsSeconds(['2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'], '2026-01-01T03:00:00Z'));
  assert.throws(() => sampleDurationsSeconds(['2026-01-01T02:00:00Z', '2026-01-01T01:00:00Z'], '2026-01-01T03:00:00Z'));
  assert.deepEqual(sampleDurationsSeconds(['2026-01-01T00:00:00Z'], '2026-01-01T00:00:00Z'), [0]);
});
