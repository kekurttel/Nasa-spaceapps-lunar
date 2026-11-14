import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { buildScenarioTimes, type Scenario } from '../scenario.ts';
import { computeSkySeries, sampleDurationsSeconds, type MoonFixedDataset } from '../index.ts';

const dataset = JSON.parse(readFileSync(new URL('../fixtures/real-moon-vectors.json', import.meta.url), 'utf8')) as MoonFixedDataset;

type ValidationSuccess = { ok: true; value: Scenario; warnings: string[] };
type ValidationFailure = { ok: false; errors: Array<{ field: string; code: string; message: string }> };
type ValidationResult = ValidationSuccess | ValidationFailure;
type ValidateScenario = (input: unknown, options: unknown) => ValidationResult;

const agent1Commit = 'b258ce0acc250bbe2243942c50e9d3523c54e723';
const agent1ModulePath = 'src/features/data/validation.mjs';
const resolvedCommit = execFileSync('git', ['rev-parse', `${agent1Commit}^{commit}`], { encoding: 'utf8' }).trim();
assert.equal(resolvedCommit, agent1Commit, 'pinned Agent1 source commit must exist');
const moduleSource = execFileSync('git', ['show', `${agent1Commit}:${agent1ModulePath}`], { encoding: 'utf8' });
assert.equal(/^\s*import\s/m.test(moduleSource), false, 'pinned Agent1 validation module must stay dependency-free');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`;
const agent1Module = await import(moduleUrl) as { validateScenario?: ValidateScenario };
assert.equal(typeof agent1Module.validateScenario, 'function', 'pinned Agent1 module must export validateScenario');
const validateScenario = agent1Module.validateScenario as ValidateScenario;

const site: Scenario['site'] = {
  id: 'apollo-11', name: 'Apollo 11 Lunar Module', latDeg: 0.67416, lonDeg: 23.47314,
  surfaceElevationM: null, observerHeightM: 1.6, kind: 'landed', sourceIds: ['nasa-nssdc-apollo'],
};
const manifest = {
  id: 'test-real-data', version: '1.0.0', dataKind: 'real', sourceIds: ['nasa-nssdc-apollo'],
  dateCoverage: { startUtc: '2026-01-01T00:00:00Z', endUtc: '2026-01-02T00:00:00Z' },
  locationCoverage: { latMinDeg: -90, latMaxDeg: 90, lonMinDeg: -180, lonMaxDeg: 180 },
};
function assertValid(result: ValidationResult): asserts result is ValidationSuccess {
  assert.equal(result.ok, true, JSON.stringify(result.ok ? [] : result.errors));
}

test('pinned Agent1 validation feeds ephemeris series using bundled real data', () => {
  const input: Scenario = {
    id: 'apollo-contract', site,
    startUtc: '2026-01-01T00:00:00Z', endUtc: '2026-01-01T02:00:00Z', stepSeconds: 3600,
  };
  const validation = validateScenario(input, { manifest });
  assertValid(validation);
  assert.deepEqual(validation.value, input);
  const expectedTimes = [
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T01:00:00.000Z',
    '2026-01-01T02:00:00.000Z',
  ];
  assert.deepEqual(buildScenarioTimes(validation.value), expectedTimes);
  const actual = computeSkySeries(validation.value, dataset);
  assert.deepEqual(actual.timesUtc, expectedTimes);
  assert.equal(actual.scenarioId, input.id);
  assert.equal(actual.quality.dataKind, 'real');
  for (const values of [actual.sunAltDeg, actual.sunAzDeg, actual.earthAltDeg, actual.earthAzDeg, actual.sunRadiusDeg]) {
    assert.equal(values.length, 3);
    assert.ok(values.every(Number.isFinite));
  }
});

test('Agent1 rejects scenario beyond real dataset manifest coverage', () => {
  const outsideCoverage: Scenario = {
    id: 'outside-dataset', site,
    startUtc: '2026-01-02T00:00:00Z', endUtc: '2026-01-02T01:00:00Z', stepSeconds: 3600,
  };
  const result = validateScenario(outsideCoverage, { manifest });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.errors[0]?.code, 'outside_coverage');
});

test('duration budget boundary is explicit; endpoint-inclusive point count exceeds Agent1 maxSamples', () => {
  const input: Scenario = {
    id: 'budget-boundary', site,
    startUtc: '2026-01-01T00:00:00Z', endUtc: '2026-01-02T00:00:00Z', stepSeconds: 60,
  };
  const allowedByDurationBudget = validateScenario(input, { manifest, maxSamples: 1440 });
  assertValid(allowedByDurationBudget);
  assert.equal(Math.ceil(86400 / input.stepSeconds), 1440);
  assert.equal(buildScenarioTimes(allowedByDurationBudget.value).length, 1441);
  const series = computeSkySeries(allowedByDurationBudget.value, dataset);
  const durations = sampleDurationsSeconds(series.timesUtc, allowedByDurationBudget.value.endUtc);
  assert.equal(series.timesUtc.length, 1441);
  assert.equal(durations.reduce((sum, duration) => sum + duration, 0), 86400);
  assert.equal(durations.at(-1), 0);
  const stricterPointBudget = validateScenario(input, { manifest, maxSamples: 1439 });
  assert.equal(stricterPointBudget.ok, false);
});

test('irregular end validates, samples real ephemeris and assigns trailing duration', () => {
  const input: Scenario = {
    id: 'irregular-end', site,
    startUtc: '2026-01-01T00:00:00Z', endUtc: '2026-01-01T00:00:02.500Z', stepSeconds: 1,
  };
  const validation = validateScenario(input, { manifest });
  assertValid(validation);
  const series = computeSkySeries(validation.value, dataset);
  assert.deepEqual(series.timesUtc, [
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:01.000Z',
    '2026-01-01T00:00:02.000Z',
  ]);
  const durations = sampleDurationsSeconds(series.timesUtc, validation.value.endUtc);
  assert.deepEqual(durations, [1, 1, 0.5]);
  assert.equal(durations.reduce((sum, duration) => sum + duration, 0), 2.5);
});
