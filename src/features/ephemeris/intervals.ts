import { ScenarioError } from './scenario.ts';

/**
 * Durations attached to sampled states on [start,end).
 * A grid-aligned end boundary has zero duration. An irregular trailing
 * interval uses the final sampled state until scenario end.
 * This utility defines support intervals, not visibility-event precision.
 */
export function sampleDurationsSeconds(timesUtc: readonly string[], endUtc: string): number[] {
  const end = Date.parse(endUtc);
  if (!Number.isFinite(end) || timesUtc.length === 0) {
    throw new ScenarioError('EPHEMERIS_INVALID_TIME_RANGE', 'Nonempty sample times and valid scenario end are required');
  }
  const times = timesUtc.map(time => Date.parse(time));
  for (let i = 0; i < times.length; i++) {
    if (!Number.isFinite(times[i]) || times[i] > end || (i > 0 && times[i] <= times[i - 1])) {
      throw new ScenarioError('EPHEMERIS_INVALID_TIME_RANGE', 'Sample times must be finite, strictly ascending and not beyond scenario end');
    }
  }
  return times.map((time, i) => ((times[i + 1] ?? end) - time) / 1000);
}
