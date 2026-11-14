import test from 'node:test';
import assert from 'node:assert/strict';
import {
  polarRegions, polarRegionSources, polarEvidenceSources, polarDemDefinition,
  validatePolarRegions, validatePolarEvidence, validatePolarDemDefinition,
  classifyPolarCoverage, sites, dataManifest,
} from '../index.mjs';

test('polar public API links sources and preserves the existing landing catalogue', () => {
  assert.equal(validatePolarRegions().ok, true);
  assert.equal(validatePolarEvidence().ok, true);
  assert.equal(validatePolarDemDefinition().ok, true);
  assert.equal(sites.length, 9);
  assert.equal(dataManifest.dateCoverage, null);
  const sources = new Set(polarRegionSources.map(source => source.id));
  for (const region of polarRegions) {
    assert.ok(region.sourceIds.every(id => sources.has(id)));
    assert.ok(sources.has(region.coordinateProvenance.sourceId));
    assert.ok(region.limitations.length);
    assert.equal(Object.hasOwn(region, 'permanentlyShadowed'), false);
    if (region.latDeg === null) assert.equal(region.demSupport.localTerrainAnalysis, 'unsupported');
  }
  const allIds = [...polarRegionSources, ...polarEvidenceSources].map(source => source.id);
  assert.equal(new Set(allIds).size, allIds.length);
});

test('polar coverage never invents an illumination result, including valid zero elevation', () => {
  const valid = { latDeg: -85, lonDeg: 270, pixel: { column: 3800, row: 3800 }, projectionVerified: true, frameVerified: true, sample: { status: 'valid', rawValue: 0 } };
  const result = classifyPolarCoverage(valid);
  assert.equal(result.status, 'usable-dem');
  assert.equal(result.longitudeDeg, -90);
  assert.equal(result.surfaceElevationM, 0);
  assert.equal(result.radiusM, 1737400);
  const states = [result, classifyPolarCoverage({ ...valid, pixel: { column: 7600, row: 1 } }), classifyPolarCoverage({ ...valid, sample: { status: 'nodata' } }), classifyPolarCoverage({ ...valid, sample: { status: 'missing' } }), classifyPolarCoverage({ ...valid, pixel: { column: 0, row: 5 } }), classifyPolarCoverage({ latDeg: -85, lonDeg: 0 }), classifyPolarCoverage({ ...valid, latDeg: -79 }), classifyPolarCoverage({ ...valid, latDeg: null })];
  assert.deepEqual(states.map(item => item.status), ['usable-dem', 'outside-raster', 'nodata', 'missing-dem', 'dem-edge', 'footprint-unverified', 'unsupported-coordinate', 'invalid-coordinate']);
  for (const item of states) {
    assert.equal(item.illumination, 'unknown');
    assert.equal(item.independentValidation, 'missing');
  }
  assert.equal(classifyPolarCoverage({ ...valid, independentValidationAvailable: true }).illumination, 'unknown');
  assert.equal(polarDemDefinition.rectangleIsGeographicMask, false);
  assert.equal(polarDemDefinition.nodataSentinel, null);
});

test('independent evidence availability is explicitly absent, not a scientific validation verdict', () => {
  assert.ok(polarEvidenceSources.some(source => source.evidenceType === 'thermal-observation'));
  assert.ok(polarEvidenceSources.some(source => source.evidenceType === 'ultraviolet-observation'));
  assert.ok(polarEvidenceSources.some(source => source.evidenceType === 'model-derived'));
  for (const source of polarEvidenceSources) {
    assert.equal(source.localDataAvailable, false);
    assert.equal(new URL(source.url).protocol, 'https:');
    assert.match(source.provenance, /./);
  }
});
