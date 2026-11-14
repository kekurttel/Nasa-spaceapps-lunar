import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { sites, sources, dataManifest, validateScenario } from '../index.mjs';

// Verified Agent 2 snapshot: 84d02a566ae38d4f785720d3d2e4a4531daaa23e.
// Structural contract only; no catalog-frame transformation or accuracy claim.
const root = process.env.EPHEMERIS_MODULE_ROOT;
if (!root) {
  test('ephemeris cross-branch contract (set EPHEMERIS_MODULE_ROOT)', { skip: 'EPHEMERIS_MODULE_ROOT is unset' }, () => {});
} else {
  const ephemeris = await import(pathToFileURL(path.resolve(root, 'index.ts')).href);
  const fixture = await import(pathToFileURL(path.resolve(root, 'fixtures/real-moon-vectors.json')).href, { with: { type: 'json' } });
  const dataset = fixture.default;
  const startUtc = dataset.samples[0].timeUtc;
  const endUtc = dataset.samples.at(-1).timeUtc;
  // Explicitly map the external vector dataset, not the coordinate catalog's dates.
  const coverageManifest = {
    id: dataset.id,
    version: '84d02a566ae38d4f785720d3d2e4a4531daaa23e',
    dataKind: dataset.dataKind,
    dateCoverage: { startUtc, endUtc },
    locationCoverage: { latMinDeg: -89, latMaxDeg: 89, lonMinDeg: -180, lonMaxDeg: 180 },
    sourceIds: [dataset.id],
  };
  const customSite = { id: 'custom-iau-moon', name: 'Custom IAU_MOON test point', latDeg: 0, lonDeg: 0,
    surfaceElevationM: null, observerHeightM: 0, kind: 'custom', sourceIds: [] };
  const scenario = (start, end, stepSeconds = 3600, site = customSite) => ({ id: 'ephemeris-contract', site, startUtc: start, endUtc: end, stepSeconds });
  const validate = (input, maxSamples = 10000, manifest = coverageManifest) => validateScenario(input, { manifest, maxSamples });
  const durationSeconds = (result, requestedEndUtc, stepSeconds) => result.timesUtc.reduce((sum, time) => {
    const t = Date.parse(time), end = Date.parse(requestedEndUtc);
    return sum + Math.max(0, Math.min(end, t + stepSeconds * 1000) - t) / 1000;
  }, 0);

  test('canonicalizes seconds UTC, validates actual custom site, and computes real fixture', () => {
    assert.equal(dataManifest.dataKind, 'real');
    const catalogSite = sites.find(site => site.id === 'apollo-11');
    assert.ok(sources.some(source => source.id === catalogSite.sourceIds[0]));
    const catalogMapping = validate(scenario('2026-01-01T00:00:00.000Z', '2026-01-01T01:00:00.000Z', 3600, catalogSite));
    assert.equal(catalogMapping.ok, true, JSON.stringify(catalogMapping.errors));
    const input = scenario('2026-01-01T00:00:00Z', '2026-01-01T01:00:00Z');
    const original = structuredClone(input);
    const validated = validate(input);
    assert.equal(validated.ok, true, JSON.stringify(validated.errors));
    assert.deepEqual(input, original);
    assert.equal(validated.value.startUtc, '2026-01-01T00:00:00.000Z');
    assert.equal(validated.value.endUtc, '2026-01-01T01:00:00.000Z');
    assert.deepEqual(validated.value.site, customSite);
    const result = ephemeris.computeSkySeries(validated.value, dataset);
    assert.equal(result.timesUtc.length, 2);
    assert.equal(result.quality.dataKind, 'real');
    for (const field of ['sunAltDeg', 'sunAzDeg', 'earthAltDeg', 'earthAzDeg', 'sunRadiusDeg']) {
      assert.equal(result[field].length, result.timesUtc.length);
      assert.ok(result[field].every(Number.isFinite), `${field} must be finite`);
    }
  });

  test('Agent 1 budget matches Agent 2 inclusive endpoint count', () => {
    const input = scenario('2026-01-01T00:00:00.000Z', '2026-01-01T01:00:00.000Z', 60);
    assert.equal(validate(input, 60).ok, false);
    const accepted = validate(input, 61);
    assert.equal(accepted.ok, true, JSON.stringify(accepted.errors));
    const result = ephemeris.computeSkySeries(accepted.value, dataset);
    assert.equal(result.timesUtc.length, 61);
    assert.equal(durationSeconds(result, input.endUtc, 60), 3600);
  });

  test('irregular last step clips to requested duration and unsupported dates fail closed', () => {
    const input = scenario('2026-01-01T00:00:00.000Z', '2026-01-01T02:30:00.000Z', 3600);
    const validated = validate(input);
    assert.equal(validated.ok, true, JSON.stringify(validated.errors));
    const result = ephemeris.computeSkySeries(validated.value, dataset);
    assert.deepEqual(result.timesUtc, ['2026-01-01T00:00:00.000Z', '2026-01-01T01:00:00.000Z', '2026-01-01T02:00:00.000Z']);
    assert.equal(durationSeconds(result, input.endUtc, 3600), 9000);
    const boundary = validate(scenario('2026-01-01T23:00:00Z', '2026-01-02T00:00:00Z'));
    assert.equal(boundary.ok, true, JSON.stringify(boundary.errors));
    assert.equal(ephemeris.computeSkySeries(boundary.value, dataset).timesUtc.at(-1), '2026-01-02T00:00:00.000Z');
    const unsupported = scenario('2026-01-03T00:00:00.000Z', '2026-01-03T01:00:00.000Z');
    assert.equal(validate(unsupported).ok, false);
    assert.equal(validate(unsupported).errors[0].code, 'outside_coverage');
    assert.throws(() => ephemeris.computeSkySeries(unsupported, dataset), error => error.code === 'EPHEMERIS_OUT_OF_RANGE');
    assert.throws(() => ephemeris.computeSkySeries(unsupported), error => error.code === 'EPHEMERIS_DATA_UNAVAILABLE');
  });
}
