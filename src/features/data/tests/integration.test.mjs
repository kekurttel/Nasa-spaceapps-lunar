import test from 'node:test';
import assert from 'node:assert/strict';
import { createCustomSite, getSiteById, getSourcesForSite, normalizeLongitude, sites, sources, validateCatalog, validateScenario } from '../index.mjs';

const manifest = { id: 'fixture', version: '1', dataKind: 'synthetic', sourceIds: [], dateCoverage: { startUtc: '2030-01-01T00:00:00.000Z', endUtc: '2030-01-02T00:00:00.000Z' }, locationCoverage: { latMinDeg: -90, latMaxDeg: 90, lonMinDeg: -180, lonMaxDeg: 180 } };

test('public exports provide normalized custom coordinates and preserve unknown elevation', () => {
  assert.equal(normalizeLongitude(270), -90);
  const result = createCustomSite({ id: 'personal', name: 'Personal location', latDeg: 12, lonDeg: 270, surfaceElevationM: null, observerHeightM: 0, sourceIds: [] });
  assert.equal(result.ok, true);
  assert.equal(result.value.lonDeg, -90);
  assert.equal(result.value.surfaceElevationM, null);
  assert.equal(result.value.kind, 'custom');
});

test('catalog lookup handles unknown ids and returned values cannot mutate catalog state', () => {
  assert.equal(getSiteById('__missing__'), null);
  assert.deepEqual(getSourcesForSite('__missing__'), []);
  assert.equal(validateCatalog().ok, true);
  if (sites.length) {
    const original = sites[0].name;
    const copy = getSiteById(sites[0].id);
    copy.name = 'tampered';
    copy.sourceIds.push('tampered');
    assert.equal(getSiteById(sites[0].id).name, original);
    const copies = getSourcesForSite(sites[0].id);
    assert.ok(copies.every(source => sources.some(item => item.id === source.id)));
    if (copies.length) { const before = sources.find(source => source.id === copies[0].id).agency; copies[0].agency = 'tampered'; assert.equal(sources.find(source => source.id === copies[0].id).agency, before); }
  }
  if (sources.length) {
    const copy = getSourcesForSite(sites.find(site => site.sourceIds.includes(sources[0].id))?.id ?? '');
    if (copy.length) { copy[0].id = 'tampered'; assert.notEqual(sources[0].id, 'tampered'); }
  }
});

test('scenario enforces date coverage and permits explicit synthetic fixtures', () => {
  const value = { id: 'scenario', site: { id: 'personal', name: 'Personal location', latDeg: 12, lonDeg: -90, surfaceElevationM: null, observerHeightM: 0, kind: 'custom', sourceIds: [] }, startUtc: '2030-01-01T00:00:00.000Z', endUtc: '2030-01-01T00:10:00.000Z', stepSeconds: 60 };
  const result = validateScenario(value, { manifest });
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.value.site, value.site);
  assert.equal(validateScenario(value, { manifest: { ...manifest, dateCoverage: null } }).ok, false);
  assert.equal(validateScenario({ ...value, endUtc: '2030-01-03T00:00:00.000Z' }, { manifest }).ok, false);
});
