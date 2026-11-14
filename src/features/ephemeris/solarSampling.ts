import { parseSolarUtc, solarFail } from './solarVectors.ts';

export interface EpochCoverage { startUtc: string; endUtc: string }
export interface EpochInterval extends EpochCoverage { stepMs: number }
export const MAX_EPOCH_CHUNK_SIZE = 100000;
function positiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) solarFail('EPHEMERIS_INVALID_SAMPLING', `${name} must be a positive safe integer`);
}
function bounds(start: string, end: string, coverage: EpochCoverage): [number, number] {
  const a = parseSolarUtc(start), b = parseSolarUtc(end);
  const c = parseSolarUtc(coverage.startUtc), d = parseSolarUtc(coverage.endUtc);
  if (a > b || c > d) solarFail('EPHEMERIS_INVALID_SAMPLING', 'Reversed interval');
  if (a < c || b > d) solarFail('EPHEMERIS_OUT_OF_RANGE', 'Requested interval exceeds coverage');
  return [a, b];
}
function* epochs(a: number, b: number, step: number): Generator<number> {
  let t = a;
  yield t;
  // Difference comparison avoids overflowing the next timestamp or stepping beyond end.
  while (b - t > step) { t += step; yield t; }
  if (t !== b) yield b;
}
/** Lazy, bounded chunks over arbitrarily long coverage (including >=18.6 years).
 * Step is integer milliseconds. Both exact endpoints are included, even when the last step is shorter.
 * Validation occurs on first iteration; no ephemeris interpolation or event guarantee is implied.
 */
export function* planEpochChunks(startUtc: string, endUtc: string, stepMs: number, coverage: EpochCoverage, chunkSize = 4096): Generator<string[]> {
  positiveInteger(stepMs, 'stepMs'); positiveInteger(chunkSize, 'chunkSize');
  if (chunkSize > MAX_EPOCH_CHUNK_SIZE) solarFail('EPHEMERIS_INVALID_SAMPLING', 'Chunk size exceeds 100000');
  const [a, b] = bounds(startUtc, endUtc, coverage);
  let chunk: string[] = [];
  for (const t of epochs(a, b, stepMs)) {
    chunk.push(new Date(t).toISOString());
    if (chunk.length === chunkSize) { yield chunk; chunk = []; }
  }
  if (chunk.length) yield chunk;
}
/** Explicit user-requested dense intervals only. Streaming k-way merge deduplicates all epochs.
 * Memory is O(interval count + chunk size), not O(total epoch count).
 */
export function* planRequestedEpochChunks(intervals: readonly EpochInterval[], coverage: EpochCoverage, chunkSize = 4096): Generator<string[]> {
  positiveInteger(chunkSize, 'chunkSize');
  if (chunkSize > MAX_EPOCH_CHUNK_SIZE) solarFail('EPHEMERIS_INVALID_SAMPLING', 'Chunk size exceeds 100000');
  const streams = intervals.map(interval => {
    positiveInteger(interval.stepMs, 'stepMs');
    const [a, b] = bounds(interval.startUtc, interval.endUtc, coverage);
    return epochs(a, b, interval.stepMs);
  });
  const heads = streams.map(stream => stream.next());
  let chunk: string[] = [];
  while (true) {
    let next = Infinity;
    for (const head of heads) if (!head.done && head.value < next) next = head.value;
    if (next === Infinity) break;
    chunk.push(new Date(next).toISOString());
    for (let i = 0; i < heads.length; i++) if (!heads[i].done && heads[i].value === next) heads[i] = streams[i].next();
    if (chunk.length === chunkSize) { yield chunk; chunk = []; }
  }
  if (chunk.length) yield chunk;
}
export interface TransitionRefinementPlan {
  windows: EpochCoverage[];
  limitations: string[];
}
/** Heuristic brackets from supplied local altitude samples, not detected event times.
 * Sign crossings, exact zeros and sampled slope reversals (possible tangencies) are candidates.
 * Padding is integer milliseconds and clipped to the supplied sample span. No samples are invented.
 */
export function refineTransitionWindows(timesUtc: readonly string[], altitudes: readonly number[], paddingMs: number): TransitionRefinementPlan {
  if (!Number.isSafeInteger(paddingMs) || paddingMs < 0 || timesUtc.length !== altitudes.length || timesUtc.length < 2) solarFail('EPHEMERIS_INVALID_SAMPLING', 'Need aligned samples and nonnegative integer padding');
  const times = Array.from(timesUtc, parseSolarUtc);
  for (let i = 0; i < times.length; i++) {
    if (!Number.isFinite(altitudes[i]) || Math.abs(altitudes[i]) > 90 || (i > 0 && times[i] <= times[i - 1])) solarFail('EPHEMERIS_INVALID_SAMPLING', 'Altitudes must be finite degrees in [-90,90], epochs strictly ascending');
  }
  const candidates: [number, number][] = [];
  const add = (a: number, b: number) => candidates.push([
    a - Math.min(paddingMs, a - times[0]), b + Math.min(paddingMs, times[times.length - 1] - b),
  ]);
  for (let i = 1; i < times.length; i++) {
    const a = altitudes[i - 1], b = altitudes[i];
    if (a === 0 || b === 0 || Math.sign(a) !== Math.sign(b)) add(times[i - 1], times[i]);
    if (i + 1 < times.length) {
      const before = b - a, after = altitudes[i + 1] - b;
      if (before === 0 || after === 0 || Math.sign(before) !== Math.sign(after)) add(times[i - 1], times[i + 1]);
    }
  }
  candidates.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const candidate of candidates) {
    const last = merged[merged.length - 1];
    if (last && candidate[0] <= last[1]) last[1] = Math.max(last[1], candidate[1]);
    else merged.push([...candidate]);
  }
  return {
    windows: merged.map(([a, b]) => ({ startUtc: new Date(a).toISOString(), endUtc: new Date(b).toISOString() })),
    limitations: [
      'Coarse samples can miss crossings, short events and tangencies between epochs; no completeness or event timing is claimed.',
      'Windows are heuristic refinement requests only, based on supplied local altitude relative to zero; terrain horizons and solar disk contacts are not evaluated.',
      'Sampled slope reversals flag tangent risks conservatively, even far from zero; unsampled extrema remain unknown.',
    ],
  };
}
