import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPolarCoverage, polarDemDefinition, validatePolarDemDefinition } from '../polar/coverage.mjs';

const covered = { latDeg: -85, lonDeg: 270, pixel: { column: 100, row: 200 }, sample: { status: 'valid', rawValue: 0 }, projectionVerified: true, frameVerified: true };

test('definition is immutable and records unknown NoData, provenance, and distinction from geographic mask', () => {
  assert.equal(Object.isFrozen(polarDemDefinition), true);
  assert.equal(Object.isFrozen(polarDemDefinition.dimensions), true);
  assert.equal(polarDemDefinition.nodataSentinel, null);
  assert.equal(polarDemDefinition.rectangleIsGeographicMask, false);
  assert.equal(validatePolarDemDefinition().ok, true);
  assert.equal(validatePolarDemDefinition({ ...polarDemDefinition, nodataSentinel: -32768 }).ok, false);
  assert.equal(validatePolarDemDefinition({ ...polarDemDefinition, referenceFrame: 'wrong' }).ok, false);
  assert.equal(validatePolarDemDefinition({ ...polarDemDefinition, projection: 'wrong' }).ok, false);
  assert.equal(validatePolarDemDefinition({ ...polarDemDefinition, approximateLatitudeRangeDeg: [-89, -80] }).ok, false);
  assert.equal(validatePolarDemDefinition({ ...polarDemDefinition, rectangleIsGeographicMask: true }).ok, false);
  assert.equal(validatePolarDemDefinition({ ...polarDemDefinition, sourceLabel: 'https://wrong.example/label' }).ok, false);
  assert.equal(validatePolarDemDefinition().provenance, 'primary-label-inspected; raster-not-verified');
});

test('coordinates normalize supported longitude domain and reject invalid coordinate values', () => {
  assert.equal(classifyPolarCoverage(covered).longitudeDeg, -90);
  assert.equal(classifyPolarCoverage({ ...covered, latDeg: '-85' }).status, 'usable-dem');
  assert.equal(classifyPolarCoverage({ ...covered, lonDeg: 180 }).longitudeDeg, -180);
  for (const latDeg of [91, -91, NaN, Infinity, '', ' ', 'no', null, true, false, [], {}]) assert.equal(classifyPolarCoverage({ ...covered, latDeg }).status, 'invalid-coordinate');
  for (const lonDeg of [361, -181, NaN, Infinity, '', ' ', 'no']) assert.equal(classifyPolarCoverage({ ...covered, lonDeg }).status, 'invalid-coordinate');
});

test('geographic coverage includes pole while observer analysis there is unsupported', () => {
  const pole = classifyPolarCoverage({ latDeg: -90, lonDeg: 0 });
  assert.equal(pole.status, 'unsupported-coordinate');
  assert.equal(pole.reason, 'observer-analysis-unsupported-at-pole');
  assert.equal(classifyPolarCoverage({ latDeg: -80, lonDeg: 0 }).status, 'footprint-unverified');
  const outsideCoverage = classifyPolarCoverage({ latDeg: -79.999, lonDeg: 0 });
  assert.equal(outsideCoverage.status, 'unsupported-coordinate');
  assert.equal(outsideCoverage.reason, 'outside-geographic-coverage');
});

test('raster location is not guessed and requires verified projection/frame and supplied valid sample', () => {
  assert.equal(classifyPolarCoverage({ latDeg: -85, lonDeg: 0 }).status, 'footprint-unverified');
  assert.equal(classifyPolarCoverage({ ...covered, pixel: { column: 7600, row: 200 } }).status, 'outside-raster');
  assert.equal(classifyPolarCoverage({ ...covered, pixel: { column: -1, row: 200 } }).status, 'outside-raster');
  assert.equal(classifyPolarCoverage({ ...covered, pixel: { column: 1.5, row: 200 } }).status, 'footprint-unverified');
  assert.equal(classifyPolarCoverage({ ...covered, projectionVerified: false }).status, 'footprint-unverified');
  assert.equal(classifyPolarCoverage({ ...covered, frameVerified: false }).status, 'footprint-unverified');
  assert.equal(classifyPolarCoverage({ ...covered, sample: { status: 'missing' } }).status, 'missing-dem');
  assert.equal(classifyPolarCoverage({ ...covered, sample: { status: 'nodata' } }).status, 'nodata');
  assert.equal(classifyPolarCoverage({ ...covered, sample: { status: 'unknown' } }).status, 'footprint-unverified');
  for (const rawValue of [undefined, 32768, -32769, 1.5, '0']) assert.equal(classifyPolarCoverage({ ...covered, sample: { status: 'valid', rawValue } }).status, 'footprint-unverified');
});

test('four-neighbour margin distinguishes raster edge; interior usable sample is not horizon support', () => {
  for (const pixel of [{ column: 0, row: 50 }, { column: 50, row: 0 }, { column: 7599, row: 50 }, { column: 50, row: 7599 }]) {
    assert.equal(classifyPolarCoverage({ ...covered, pixel }).status, 'dem-edge');
  }
  const result = classifyPolarCoverage({ ...covered, independentValidationAvailable: true });
  assert.equal(result.status, 'usable-dem');
  assert.equal(result.radiusM, 1737400);
  assert.equal(result.surfaceElevationM, 0);
  assert.equal(result.independentValidation, 'available');
  assert.equal(result.illumination, 'unknown');
  assert.equal(classifyPolarCoverage({ ...covered, independentValidationAvailable: 'yes' }).status, 'invalid-coordinate');
});
