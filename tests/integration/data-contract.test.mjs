import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCustomSite,
  getSiteById,
  getSourcesForSite,
  normalizeLongitude,
  validateCatalog,
  validateScenario,
} from '../../src/features/data/index.mjs';

const manifest = {
  id: 'integration-fixture',
  version: '1',
  dataKind: 'synthetic',
  sourceIds: [],
  dateCoverage: {
    startUtc: '2030-01-01T00:00:00.000Z',
    endUtc: '2030-01-02T00:00:00.000Z',
  },
  locationCoverage: {
    latMinDeg: -90,
    latMaxDeg: 90,
    lonMinDeg: -180,
    lonMaxDeg: 180,
  },
};

test('data API normalizes custom site while preserving unknown elevation', () => {
  assert.equal(normalizeLongitude(270), -90);
  const site = createCustomSite({
    id: 'custom-1',
    name: 'User location',
    latDeg: 12,
    lonDeg: 270,
    surfaceElevationM: null,
    observerHeightM: 0,
    sourceIds: [],
  });
  assert.equal(site.ok, true);
  assert.equal(site.value.lonDeg, -90);
  assert.equal(site.value.surfaceElevationM, null);
  assert.equal(site.value.kind, 'custom');
});

test('data API rejects local times and impossible UTC calendar dates', () => {
  const site = {
    id: 'custom-1', name: 'User location', latDeg: 12, lonDeg: 0,
    surfaceElevationM: null, observerHeightM: 0, kind: 'custom', sourceIds: [],
  };
  for (const startUtc of ['2030-01-01T00:00:00', '2030-02-30T00:00:00Z']) {
    const result = validateScenario({
      id: 'invalid-time', site, startUtc,
      endUtc: '2030-01-01T00:10:00.000Z', stepSeconds: 60,
    }, { manifest });
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, 'invalid_utc');
  }
});

test('data catalog exposes defensive lookup results and validates provenance', () => {
  assert.equal(getSiteById('__missing__'), null);
  assert.deepEqual(getSourcesForSite('__missing__'), []);
  assert.equal(validateCatalog().ok, true);
});

test('scenario validates UTC interval, coverage, and keeps elevation unknown', () => {
  const site = {
    id: 'custom-1', name: 'User location', latDeg: 12, lonDeg: 0,
    surfaceElevationM: null, observerHeightM: 1.6, kind: 'custom', sourceIds: [],
  };
  const result = validateScenario({
    id: 'utc-scenario', site,
    startUtc: '2030-01-01T00:00:00.000Z',
    endUtc: '2030-01-01T00:10:00.000Z',
    stepSeconds: 60,
  }, { manifest });
  assert.equal(result.ok, true);
  assert.equal(result.value.site.surfaceElevationM, null);
  assert.deepEqual(result.warnings, ['Scenario uses synthetic data.']);
});
