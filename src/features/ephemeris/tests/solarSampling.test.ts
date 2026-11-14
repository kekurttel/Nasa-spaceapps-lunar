import test from 'node:test';
import assert from 'node:assert/strict';
import { planEpochChunks, planRequestedEpochChunks, refineTransitionWindows } from '../solarSampling.ts';

// All samples are SYNTHETIC SOFTWARE TEST ONLY, not astronomical event predictions.
const start = '2024-02-29T00:00:00Z', end = '2024-02-29T00:00:10Z';
const coverage = { startUtc: start, endUtc: end };
const iso = (seconds: number) => new Date(Date.parse(start) + seconds * 1000).toISOString();
test('synthetic software test only: bounded chunks include exact endpoints without overshoot', () => {
  assert.deepEqual([...planEpochChunks(start, end, 3000, coverage, 2)], [[iso(0), iso(3)], [iso(6), iso(9)], [iso(10)]]);
  assert.deepEqual([...planEpochChunks(start, start, 1, coverage)], [[iso(0)]]);
  assert.deepEqual([...planEpochChunks(start, end, 20000, coverage)], [[iso(0), iso(10)]]);
  for (const step of [0, -1, 0.5, Infinity, NaN]) assert.throws(() => [...planEpochChunks(start, end, step, coverage)]);
  assert.throws(() => [...planEpochChunks(start, end, 1000, coverage, 100001)]);
  assert.throws(() => [...planEpochChunks(start, iso(11), 1000, coverage)]);
  assert.throws(() => [...planEpochChunks(end, start, 1000, coverage)]);
});
test('synthetic software test only: lazy >=18.6 year plan supports >100000 total epochs', () => {
  const longEnd = '2044-02-29T00:00:00Z';
  const plan = planEpochChunks(start, longEnd, 1000, { startUtc: start, endUtc: longEnd }, 10);
  assert.equal(plan.next().value?.length, 10);
  assert.equal(plan.next().value?.[0], iso(10));
  plan.return(undefined);
  let count = 0, previous = -Infinity;
  for (const chunk of planEpochChunks(start, longEnd, 3600000, { startUtc: start, endUtc: longEnd }, 8192)) {
    assert.ok(chunk.length <= 8192);
    for (const t of chunk) { assert.ok(Date.parse(t) > previous); previous = Date.parse(t); count++; }
  }
  assert.ok(count > 100000); assert.equal(previous, Date.parse(longEnd));
});
test('synthetic software test only: explicit dense intervals merge duplicate epochs increasingly', () => {
  const chunks = [...planRequestedEpochChunks([
    { startUtc: iso(3), endUtc: iso(7), stepMs: 1000 },
    { ...coverage, stepMs: 3000 },
    { startUtc: iso(3), endUtc: iso(7), stepMs: 2000 },
  ], coverage, 3)];
  assert.deepEqual(chunks.flat(), [0, 3, 4, 5, 6, 7, 9, 10].map(iso));
  assert.ok(chunks.every(c => c.length <= 3));
  assert.throws(() => [...planRequestedEpochChunks([{ startUtc: start, endUtc: iso(11), stepMs: 1000 }], coverage)]);
});
test('synthetic software test only: crossing and tangent risk brackets clipped and merged, not event claims', () => {
  const times = [0, 2, 4, 6, 8, 10].map(iso);
  const cross = refineTransitionWindows(times, [-3, -2, -1, 1, 2, 3], 1000);
  assert.deepEqual(cross.windows, [{ startUtc: iso(3), endUtc: iso(7) }]);
  const tangent = refineTransitionWindows(times, [3, 2, 1, 2, 3, 4], 10000);
  assert.deepEqual(tangent.windows, [{ startUtc: iso(0), endUtc: iso(10) }]);
  assert.match(tangent.limitations.join(' '), /can miss/);
  assert.deepEqual(refineTransitionWindows(times, [1, 2, 3, 4, 5, 6], 0).windows, []);
  assert.equal(refineTransitionWindows(times, [-2, -1, 0, 1, 2, 3], 0).windows.length, 1);
  for (const padding of [-1, 0.1, Infinity]) assert.throws(() => refineTransitionWindows(times, [1, 2, 3, 4, 5, 6], padding));
  assert.throws(() => refineTransitionWindows(times, [1], 0));
  assert.throws(() => refineTransitionWindows([iso(0), iso(0)], [1, 2], 0));
  assert.throws(() => refineTransitionWindows([iso(0), iso(1)], [1, NaN], 0));
});
