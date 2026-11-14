import test from 'node:test';
import assert from 'node:assert/strict';
import { dataManifest, sites, sources, validateCatalog } from '../catalog.mjs';

test('catalog has sourced real sites across Apollo and CLPS, and valid provenance', () => {
  assert.equal(sites.length >= 6, true);
  assert.equal(sites.filter(site => site.id.startsWith('apollo-')).length, 6);
  assert.equal(sites.some(site => site.id === 'im-1-odysseus' && site.kind === 'landed'), true);
  assert.equal(sites.some(site => site.id === 'blue-ghost-m1' && site.kind === 'landed'), true);
  assert.equal(sources.some(source => source.id === 'nasa-viper-mons-mouton'), true);
  assert.equal(sites.some(site => site.id === 'viper-mons-mouton-region' && site.kind === 'planned-region'), true);
  assert.deepEqual(validateCatalog(), { ok: true, value: { sites, sources }, warnings: [] });
});

test('manifest is real, global, immutable, and has no implied date coverage', () => {
  assert.deepEqual(dataManifest, {
    id: 'lunar-site-catalog', version: '1.0.0', dataKind: 'real',
    sourceIds: sources.map(source => source.id), dateCoverage: null,
    locationCoverage: { latMinDeg: -90, latMaxDeg: 90, lonMinDeg: -180, lonMaxDeg: 180 },
    metadata: dataManifest.metadata,
  });
  assert.equal(Object.isFrozen(sites), true);
  assert.equal(Object.isFrozen(sites[0]), true);
  assert.equal(Object.isFrozen(sites[0].sourceIds), true);
  assert.equal(Object.isFrozen(sources[0]), true);
  assert.equal(Object.isFrozen(dataManifest.locationCoverage), true);
});

test('unknown Apollo elevations remain null; elevations supplied by source retained', () => {
  assert.equal(sites.filter(site => site.id.startsWith('apollo-')).every(site => site.surfaceElevationM === null), true);
  assert.equal(sites.find(site => site.id === 'im-1-odysseus').surfaceElevationM, 2579);
  assert.equal(sites.find(site => site.id === 'blue-ghost-m1').surfaceElevationM, -3650);
  const region = sites.find(site => site.id === 'viper-mons-mouton-region');
  assert.deepEqual([region.latDeg, region.lonDeg, region.surfaceElevationM, region.kind], [-84.6, 31, null, 'planned-region']);
  assert.deepEqual(region.sourceIds, ['nasa-viper-mons-mouton', 'usgs-mons-mouton']);
});

test('catalog validation rejects duplicate site identifiers and missing provenance links', () => {
  const duplicate = { ...sites[0] };
  const duplicateResult = validateCatalog([...sites, duplicate], sources);
  assert.equal(duplicateResult.ok, false);
  assert.equal(duplicateResult.errors.some(error => error.code === 'duplicate_id'), true);

  const missingLink = { ...sites[0], id: 'orphan', sourceIds: ['missing-source'] };
  const missingResult = validateCatalog([missingLink], sources);
  assert.equal(missingResult.ok, false);
  assert.equal(missingResult.errors.some(error => error.code === 'unknown_source'), true);
});

test('catalog validation rejects invalid coordinates, elevation, and empty source data', () => {
  const bad = { ...sites[0], id: 'bad', latDeg: 91, lonDeg: 180, surfaceElevationM: Number.NaN };
  const result = validateCatalog([bad], sources);
  assert.equal(result.ok, false);
  assert.equal(result.errors.some(error => error.field === 'sites[0].latDeg'), true);
  assert.equal(result.errors.some(error => error.field === 'sites[0].lonDeg'), true);
  assert.equal(result.errors.some(error => error.field === 'sites[0].surfaceElevationM'), true);
  assert.equal(validateCatalog([], []).ok, true);
});

test('catalog validation requires absolute source URLs, ISO dates, and unique source ids', () => {
  const badSource = { ...sources[0], url: 'javascript:bad()', accessedDate: '2026-99-99' };
  const result = validateCatalog([], [badSource, { ...badSource }]);
  assert.equal(result.ok, false);
  assert.equal(result.errors.some(error => error.code === 'invalid_url'), true);
  assert.equal(result.errors.some(error => error.code === 'invalid_date'), true);
  assert.equal(result.errors.some(error => error.code === 'duplicate_id'), true);
});
