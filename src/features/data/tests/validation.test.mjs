import test from 'node:test';
import assert from 'node:assert/strict';
import { createCustomSite, normalizeLongitude, validateScenario, validateSite } from '../validation.mjs';

const site = { id: 's1', name: 'Test', latDeg: '0', lonDeg: '270', surfaceElevationM: null, observerHeightM: '1.5', kind: 'landed', sourceIds: ['src'] };
const manifest = { id: 'm1', version: '1', dataKind: 'synthetic', sourceIds: ['src'], dateCoverage: { startUtc: '2025-01-01T00:00:00Z', endUtc: '2025-01-02T00:00:00Z' }, locationCoverage: { latMinDeg: -90, latMaxDeg: 90, lonMinDeg: -180, lonMaxDeg: 180 } };
const scenario = { id: 'sc1', site, startUtc: '2025-01-01T00:00:00Z', endUtc: '2025-01-01T01:00:00Z', stepSeconds: 60 };
const options = { manifest };

test('longitude normalizes expected bounds and rejects invalid inputs', () => {
  assert.equal(normalizeLongitude(270), -90); assert.equal(normalizeLongitude(180), -180); assert.equal(normalizeLongitude('180'), -180);
  assert.equal(normalizeLongitude(23.47314), 23.47314);
  for (const value of [-180, -90, 0, 23.47314, 179.999, 180, 270, 360]) {
    const normalized = normalizeLongitude(value);
    assert.equal(normalizeLongitude(normalized), normalized);
  }
  for (const value of [NaN, Infinity, -181, 361, '0x10', '']) assert.throws(() => normalizeLongitude(value), RangeError);
});
test('site rejects malformed shapes and invalid required strings', () => {
  for (const value of [null, 4, 'x', []]) assert.equal(validateSite(value).ok, false);
  for (const field of ['id', 'name']) for (const value of ['', ' ', null, 3]) assert.equal(validateSite({ ...site, [field]: value }).ok, false);
});
test('site validates finite in-range coordinates and decimal strings', () => {
  const good = validateSite(site); assert.equal(good.ok, true); assert.equal(good.value.lonDeg, -90);
  for (const latDeg of [91, -91, NaN, Infinity, '', '0x10']) assert.equal(validateSite({ ...site, latDeg }).ok, false);
  for (const lonDeg of [361, -181, NaN, '', '0x10']) assert.equal(validateSite({ ...site, lonDeg }).ok, false);
});
test('site preserves null elevation and validates heights', () => {
  assert.equal(validateSite(site).value.surfaceElevationM, null);
  for (const surfaceElevationM of [NaN, Infinity, '', '0x10']) assert.equal(validateSite({ ...site, surfaceElevationM }).ok, false);
  for (const observerHeightM of [-1, NaN, '', '0x10']) assert.equal(validateSite({ ...site, observerHeightM }).ok, false);
});
test('site validates kind and source IDs including custom exception', () => {
  for (const kind of ['other', '', null]) assert.equal(validateSite({ ...site, kind }).ok, false);
  for (const sourceIds of [null, 'src', [''], ['a', 'a'], [1]]) assert.equal(validateSite({ ...site, sourceIds }).ok, false);
  assert.equal(validateSite({ ...site, sourceIds: [] }).ok, false);
  assert.equal(validateSite({ ...site, kind: 'custom', sourceIds: [] }).ok, true);
});
test('custom site forces kind while preserving coordinates', () => {
  const result = createCustomSite({ ...site, latDeg: 12, lonDeg: 34 });
  assert.equal(result.ok, true); assert.equal(result.value.kind, 'custom'); assert.equal(result.value.latDeg, 12); assert.equal(result.value.lonDeg, 34);
  assert.equal(createCustomSite(null).ok, false);
});
test('scenario contract requires Site object and returns its normalized value', () => {
  const result = validateScenario(scenario, options);
  assert.equal(result.ok, true); assert.equal(typeof result.value.site, 'object'); assert.equal(result.value.site.lonDeg, -90); assert.equal(result.value.site.surfaceElevationM, null);
  assert.equal(validateScenario({ ...scenario, site: 's1' }, options).ok, false);
  assert.equal(validateScenario({ ...scenario, site: { ...site, latDeg: 91 } }, options).ok, false);
  assert.equal(validateScenario({ ...scenario, site: { ...site, kind: 'custom', sourceIds: [] } }, options).ok, true);
});
test('scenario rejects malformed input, options and required ID', () => {
  for (const value of [null, 4, 'x', []]) assert.equal(validateScenario(value).ok, false);
  for (const value of [null, 4, 'x', []]) assert.equal(validateScenario(scenario, value).ok, false);
  for (const id of ['', ' ', null, 3]) assert.equal(validateScenario({ ...scenario, id }, options).ok, false);
});
test('UTC accepts seconds and milliseconds and rejects malformed calendar dates', () => {
  assert.equal(validateScenario(scenario, options).ok, true);
  assert.equal(validateScenario({ ...scenario, startUtc: '2025-01-01T00:00:00.123Z', endUtc: '2025-01-01T01:00:00.123Z' }, options).ok, true);
  for (const value of ['2025-01-01T00:00:00', '2025-01-01T00:00:00.12Z', '2025-02-30T00:00:00Z', '2025-13-01T00:00:00Z', 'bad']) assert.equal(validateScenario({ ...scenario, startUtc: value }, options).ok, false);
});
test('scenario interval ordering and inclusive date coverage', () => {
  assert.equal(validateScenario({ ...scenario, endUtc: manifest.dateCoverage.endUtc }, options).ok, true);
  assert.equal(validateScenario({ ...scenario, endUtc: scenario.startUtc }, options).ok, false);
  assert.equal(validateScenario({ ...scenario, endUtc: '2024-12-31T23:59:00Z' }, options).ok, false);
  assert.equal(validateScenario({ ...scenario, startUtc: manifest.dateCoverage.endUtc }, options).ok, false);
});
test('manifest requires id, version, valid kind and unique sources', () => {
  for (const field of ['id', 'version']) for (const value of ['', ' ', 3]) assert.equal(validateScenario(scenario, { manifest: { ...manifest, [field]: value } }).ok, false);
  for (const dataKind of ['bad', null]) assert.equal(validateScenario(scenario, { manifest: { ...manifest, dataKind } }).ok, false);
  for (const sourceIds of [null, ['a', 'a'], ['']]) assert.equal(validateScenario(scenario, { manifest: { ...manifest, sourceIds } }).ok, false);
});
test('manifest date coverage must be valid, ordered and non-null', () => {
  for (const dateCoverage of [null, {}, { startUtc: '2025-02-30T00:00:00Z', endUtc: manifest.dateCoverage.endUtc }, { startUtc: manifest.dateCoverage.endUtc, endUtc: manifest.dateCoverage.startUtc }]) assert.equal(validateScenario(scenario, { manifest: { ...manifest, dateCoverage } }).ok, false);
});
test('location bounds are checked and antimeridian crossing rejected', () => {
  for (const locationCoverage of [null, { latMinDeg: -91, latMaxDeg: 90, lonMinDeg: -180, lonMaxDeg: 180 }, { latMinDeg: 10, latMaxDeg: -10, lonMinDeg: -180, lonMaxDeg: 180 }, { latMinDeg: -90, latMaxDeg: 90, lonMinDeg: 170, lonMaxDeg: -170 }, { latMinDeg: -90, latMaxDeg: 90, lonMinDeg: -180, lonMaxDeg: NaN }]) assert.equal(validateScenario(scenario, { manifest: { ...manifest, locationCoverage } }).ok, false);
  const narrow = { ...manifest, locationCoverage: { latMinDeg: -1, latMaxDeg: 1, lonMinDeg: -1, lonMaxDeg: 1 } };
  assert.equal(validateScenario(scenario, { manifest: narrow }).errors[0].code, 'outside_location_coverage');
});
test('step and maxSamples bounds; fractional duration rounds sample budget up', () => {
  for (const stepSeconds of [0, -1, NaN, Infinity, '', '0x10']) assert.equal(validateScenario({ ...scenario, stepSeconds }, options).ok, false);
  const short = { ...scenario, endUtc: '2025-01-01T00:00:02.001Z', stepSeconds: 1 };
  assert.equal(validateScenario(short, { ...options, maxSamples: 3 }).ok, true);
  assert.equal(validateScenario(short, { ...options, maxSamples: 2 }).ok, false);
  for (const maxSamples of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(validateScenario(scenario, { ...options, maxSamples }).ok, false);
});
test('synthetic/mixed warn and real data does not warn', () => {
  for (const dataKind of ['synthetic', 'mixed']) assert.ok(validateScenario(scenario, { manifest: { ...manifest, dataKind } }).warnings.length > 0);
  assert.deepEqual(validateScenario(scenario, { manifest: { ...manifest, dataKind: 'real' } }).warnings, []);
});
