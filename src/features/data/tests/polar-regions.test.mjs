import test from 'node:test';
import assert from 'node:assert/strict';
import { polarRegions, polarRegionSources, validatePolarRegions } from '../polar/regions.mjs';

test('catalog has the four requested named polar regions with source provenance', () => {
  assert.deepEqual(polarRegions.map(region => region.id), ['shackleton-rim', 'de-gerlache-rim', 'malapert-massif', 'nobile']);
  assert.deepEqual(validatePolarRegions(), { ok: true });
  for (const region of polarRegions) {
    assert.ok(region.sourceIds.length);
    assert.ok(region.coordinateProvenance.sourceId);
    assert.ok(region.coordinateProvenance.sourceCoordinateVerbatim);
    assert.ok(region.coordinateProvenance.derivation);
    assert.ok(region.limitations.length);
  }
});

test('all records and nested provenance are deeply frozen', () => {
  assert.ok(Object.isFrozen(polarRegions));
  assert.ok(Object.isFrozen(polarRegionSources));
  assert.ok(Object.isFrozen(polarRegions[0].demSupport.limitations));
  assert.ok(Object.isFrozen(polarRegionSources[0]));
});

test('crater centres are explicitly representative, never rim coordinates', () => {
  for (const region of polarRegions.filter(({ requestedRegionType }) => requestedRegionType === 'crater-rim')) {
    assert.match(region.name, /centre marker; rim unlocated/);
    assert.equal(region.regionType, 'crater');
    assert.equal(region.coordinateProvenance.kind, 'representative-feature-centre');
    assert.match(region.coordinateProvenance.derivation, /not a rim coordinate/);
    assert.match(region.limitations.join(' '), /not the requested rim/);
  }
});

test('unsourced Malapert location remains null and cannot claim geographic DEM support', () => {
  const region = polarRegions.find(({ id }) => id === 'malapert-massif');
  assert.equal(region.latDeg, null);
  assert.equal(region.lonDeg, null);
  assert.equal(region.demSupport.geographicCandidate, false);
  assert.equal(region.demSupport.localTerrainAnalysis, 'unsupported');
});

test('Nobile uses current LDEM_80S_80M candidate policy, not the separate 5 m site index', () => {
  const region = polarRegions.find(({ id }) => id === 'nobile');
  assert.equal(region.demSupport.geographicCandidate, true);
  assert.equal(region.demSupport.localTerrainAnalysis, 'conditional');
  assert.match(region.demSupport.limitations.join(' '), /planetographic/);
  assert.match(region.demSupport.limitations.join(' '), /MOON_ME DE421/);
  assert.match(region.demSupport.limitations.join(' '), /conversion/);
});

test('validator rejects malformed and unlocated-but-geographic candidate data', () => {
  assert.equal(validatePolarRegions(null).ok, false);
  const malformed = structuredClone(polarRegions);
  malformed[2].demSupport.geographicCandidate = true;
  assert.equal(validatePolarRegions(malformed).ok, false);
  const outOfRange = structuredClone(polarRegions);
  outOfRange[0].lonDeg = 180;
  assert.equal(validatePolarRegions(outOfRange).ok, false);
  const missingProvenance = structuredClone(polarRegions);
  missingProvenance[0].coordinateProvenance = {};
  assert.equal(validatePolarRegions(missingProvenance).ok, false);
  const badUrl = structuredClone(polarRegionSources);
  badUrl[0].url = 'javascript:alert(1)';
  assert.equal(validatePolarRegions(polarRegions, badUrl).ok, false);
  const badDate = structuredClone(polarRegionSources);
  badDate[0].accessedDate = '2026-02-30';
  assert.equal(validatePolarRegions(polarRegions, badDate).ok, false);
  const emptyLimitations = structuredClone(polarRegions);
  emptyLimitations[0].limitations = ['  '];
  assert.equal(validatePolarRegions(emptyLimitations).ok, false);
  const outsideCap = structuredClone(polarRegions);
  outsideCap[3].latDeg = 0;
  assert.equal(validatePolarRegions(outsideCap).ok, false);
  const unlinkedProvenance = structuredClone(polarRegions);
  unlinkedProvenance[0].sourceIds = ['nasa-pgda-south-pole-dem'];
  assert.equal(validatePolarRegions(unlinkedProvenance).ok, false);
});
