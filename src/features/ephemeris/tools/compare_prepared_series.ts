import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { computeSkySeries, type MoonFixedDataset, type Scenario } from '../index.ts';

const baselineCommit = 'f4252d39970d2a5cf458a96541a4b28247fc563f';
const gitSource = (file: string) => execFileSync('git', ['show', `${baselineCommit}:src/features/ephemeris/${file}`], { encoding: 'utf8' });
const moduleUrl = (source: string) => `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: 'strip' })).toString('base64')}`;
const oldCoordinates = moduleUrl(gitSource('coordinates.ts'));
const oldIndex = gitSource('index.ts').replace(/(['"])(\.\/[^'"]+\.ts)\1/g, (_match, _quote, path: string) =>
  JSON.stringify(path === './coordinates.ts' ? oldCoordinates : new URL(`../${path.slice(2)}`, import.meta.url).href));
const oldModule = await import(moduleUrl(oldIndex)) as { computeSkySeries: typeof computeSkySeries };
const real = JSON.parse(readFileSync(new URL('../fixtures/real-moon-vectors.json', import.meta.url), 'utf8')) as MoonFixedDataset;
let matchedSeries = 0;
for (const [latDeg, lonDeg, surfaceElevationM, observerHeightM] of [
  [0, 0, 0, 0], [45, 180, -1200, 2], [-45, -180, 2300, 100], [89.999999, 45, -100, 4], [-89.999999, -90, 0, 10],
]) {
  const scenario: Scenario = { id: 'comparison', site: { id: 'site', name: 'Site', kind: 'custom', sourceIds: [],
    latDeg, lonDeg, surfaceElevationM, observerHeightM }, startUtc: '2026-01-01T00:00:00Z',
    endUtc: '2026-01-02T00:00:00Z', stepSeconds: 60 };
  assert.deepEqual(computeSkySeries(scenario, real), oldModule.computeSkySeries(scenario, real));
  matchedSeries++;
}
const scenario: Scenario = { id: 'zenith', site: { id: 'site', name: 'Site', kind: 'custom', sourceIds: [], latDeg: 0,
  lonDeg: 0, surfaceElevationM: 0, observerHeightM: 0 }, startUtc: '2026-01-01T00:00:00Z', endUtc: '2026-01-01T01:00:00Z', stepSeconds: 60 };
for (const [sun, earth] of [[true, false], [false, true], [true, true]]) {
  for (const sign of [1, -1]) {
    const data = structuredClone(real);
    for (const sample of data.samples) {
      if (sun) sample.sunKm = { x: sign * 150000000, y: 0, z: 0 };
      if (earth) sample.earthKm = { x: sign * 380000, y: 0, z: 0 };
    }
    assert.deepEqual(computeSkySeries(scenario, data), oldModule.computeSkySeries(scenario, data));
    matchedSeries++;
  }
}
function errorCode(fn: () => unknown): unknown {
  try { fn(); } catch (error) { return (error as { code?: string }).code; }
  assert.fail('expected computation failure');
}
let matchedErrors = 0;
for (const startUtc of ['2026-01-01T00:00:00Z', '2026-01-03T00:00:00Z']) {
  const invalid: Scenario = { ...scenario, startUtc, endUtc: startUtc,
    site: { ...scenario.site, surfaceElevationM: Number.MAX_VALUE, observerHeightM: Number.MAX_VALUE } };
  assert.equal(errorCode(() => computeSkySeries(invalid, real)), errorCode(() => oldModule.computeSkySeries(invalid, real)));
  matchedErrors++;
}
console.log(JSON.stringify({ baselineCommit, matchedSeries, matchedErrors, comparison: 'exact complete SkySeries including warning arrays', passed: true }));
