import test from 'node:test';
import assert from 'node:assert/strict';
import { sites, sources, dataManifest, validateCatalog, validateSite, createCustomSite, normalizeLongitude, validateScenario, getSiteById, getSourcesForSite } from '../index.mjs';

const manifest = {
  id: 'acceptance-only', version: '1.0.0', dataKind: 'synthetic', sourceIds: [],
  dateCoverage: { startUtc: '2026-01-01T00:00:00Z', endUtc: '2026-02-01T00:00:00Z' },
  locationCoverage: { latMinDeg: -90, latMaxDeg: 90, lonMinDeg: -180, lonMaxDeg: 180 },
};
const scenario = () => ({ id: 'acceptance', site: getSiteById('apollo-11'), startUtc: '2026-01-01T00:00:00Z', endUtc: '2026-01-01T01:00:00Z', stepSeconds: 60 });

test('acceptance: at least six real linked locations and a south-pole CLPS example', () => {
  assert.ok(sites.length >= 6);
  assert.equal(dataManifest.dataKind, 'real');
  assert.equal(dataManifest.dateCoverage, null);
  assert.ok(sites.some(s => s.id.startsWith('apollo-')));
  assert.ok(sites.some(s => s.id === 'im-1-odysseus' && s.latDeg < -80));
  assert.equal(validateCatalog().ok, true);
  for (const site of sites) {
    assert.equal(validateSite(site).ok, true, site.id);
    assert.ok(site.sourceIds.every(id => sources.some(source => source.id === id)));
  }
});

test('acceptance: every normalized longitude is canonical and preserves angle', () => {
  for (let i = 0; i <= 10000; i++) {
    const input = -180 + 540 * i / 10000;
    const result = normalizeLongitude(input);
    assert.ok(result >= -180 && result < 180);
    assert.ok(Math.abs((input - result) / 360 - Math.round((input - result) / 360)) < 1e-12);
  }
  assert.equal(normalizeLongitude(270), -90);
  assert.equal(normalizeLongitude(180), -180);
  assert.equal(normalizeLongitude(360), 0);
});

test('acceptance: custom coordinate remains custom and unknown elevation remains unknown', () => {
  const original = { ...sites[0], id: 'user-coordinate', kind: 'landed', lonDeg: '270', surfaceElevationM: null, sourceIds: [] };
  const copy = structuredClone(original);
  const result = createCustomSite(original);
  assert.equal(result.ok, true);
  assert.equal(result.value.kind, 'custom');
  assert.equal(result.value.id, 'user-coordinate');
  assert.equal(result.value.lonDeg, -90);
  assert.equal(result.value.surfaceElevationM, null);
  assert.deepEqual(original, copy);
});

test('acceptance: fixed Scenario embeds Site, no options.site and no input mutation', () => {
  const input = scenario();
  const original = structuredClone(input);
  const result = validateScenario(input, { manifest, maxSamples: 60 });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.value.site, input.site);
  assert.deepEqual(input, original);
  assert.notEqual(result.value.site, input.site);
  assert.ok(result.warnings.some(w => /synthetic/i.test(w)));
  assert.equal(validateScenario(input, { manifest, maxSamples: 59 }).ok, false);
  assert.equal(validateScenario({ ...input, site: input.site.id }, { manifest }).ok, false);
});

test('acceptance: real coordinates do not imply real sky date coverage', () => {
  const result = validateScenario(scenario(), { manifest: dataManifest });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.field.includes('dateCoverage')));
});

test('acceptance: calendar, UTC suffix and date interval checks', () => {
  for (const startUtc of ['2026-02-30T00:00:00Z', '2026-01-01T24:00:00Z', '2026-01-01T00:00:00+00:00', '', '2026-01-01']) {
    assert.equal(validateScenario({ ...scenario(), startUtc }, { manifest }).ok, false, startUtc);
  }
  assert.equal(validateScenario({ ...scenario(), endUtc: '2026-01-01T00:00:00Z' }, { manifest }).ok, false);
  assert.equal(validateScenario({ ...scenario(), startUtc: '2025-12-31T23:59:59Z' }, { manifest }).ok, false);
});

test('acceptance: invalid numeric fields and malformed options never silently coerce', () => {
  for (const latDeg of [91, -91, NaN, Infinity, '', ' ', null, true, '0x10', [], {}]) {
    assert.equal(validateSite({ ...sites[0], latDeg }).ok, false, String(latDeg));
  }
  for (const stepSeconds of [0, -1, NaN, Infinity, '', null, true]) {
    assert.equal(validateScenario({ ...scenario(), stepSeconds }, { manifest }).ok, false);
  }
  for (const options of [null, [], 'bad']) assert.equal(validateScenario(scenario(), options).ok, false);
});

test('acceptance: source/site lookup values cannot corrupt shared catalogue', () => {
  const site = getSiteById(sites[0].id);
  site.sourceIds.length = 0;
  assert.ok(getSiteById(sites[0].id).sourceIds.length > 0);
  const referenced = getSourcesForSite(sites[0].id);
  referenced[0].agency = 'changed';
  assert.notEqual(getSourcesForSite(sites[0].id)[0].agency, 'changed');
  assert.equal(getSiteById('missing'), null);
  assert.deepEqual(getSourcesForSite('missing'), []);
  assert.ok(Object.isFrozen(sites) && Object.isFrozen(sites[0].sourceIds));
});
