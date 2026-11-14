import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSolarVectorLookup, projectSolarVector, validateSolarVectorDataset } from '../solarVectors.ts';

// Saved real SPICE output and actual pinned Agent3 results. Refresh is explicit Python tool.
const report = JSON.parse(readFileSync(new URL('../fixtures/de421-solar-validation.json', import.meta.url), 'utf8'));

test('actual Python DE421 vectors pass TypeScript contract and reproduce 64 Agent3 polar directions', () => {
  const data: unknown = report.actualNewGeneratorOutput;
  validateSolarVectorDataset(data);
  const lookup = createSolarVectorLookup(data);
  assert.equal(report.sampleCount, 64);
  assert.equal(report.passed, true);
  for (const row of report.rawComparisons) {
    const local = projectSolarVector(lookup(row.utc), 'MOON_ME_DE421', {
      latDeg: row.latitudeDeg, lonDeg: row.longitudeDeg, surfaceElevationM: 0, observerHeightM: 2,
    });
    const reference = row.registeredActual;
    const residuals = {
      azDeg: Math.abs(((local.azimuth - reference.azDeg + 540) % 360) - 180),
      altDeg: Math.abs(local.altitude - reference.altDeg),
      radiusDeg: Math.abs(local.angularRadiusDeg - reference.radiusDeg),
      topocentricDistanceKm: Math.abs(local.distanceKm - reference.topocentricDistanceKm),
    };
    for (const [key, error] of Object.entries(residuals)) {
      assert.ok(error <= report.tolerancesChosenBeforeEvaluation[key], `${row.utc} ${key}: ${error}`);
    }
  }
});

test('real coverage includes measured 19-year study; exact missing epochs never interpolate', () => {
  const data: unknown = report.actualNewGeneratorOutput;
  validateSolarVectorDataset(data);
  const lookup = createSolarVectorLookup(data);
  const coverage = JSON.parse(readFileSync(new URL('../fixtures/de421-coverage-report.json', import.meta.url), 'utf8'));
  assert.equal(coverage.verifiedStudy.supported, true);
  assert.ok(coverage.verifiedStudy.durationJulianYears >= 18.6);
  assert.deepEqual(data.coverage, {
    startUtc: coverage.conservativeUtcIntervals[0].startUtc,
    endUtc: coverage.conservativeUtcIntervals[0].endUtc,
  });
  assert.throws(() => lookup('2000-01-01T00:00:00.001Z'), { code: 'EPHEMERIS_MISSING_EPOCH' });
  assert.throws(() => lookup('2051-01-01T00:00:00Z'), { code: 'EPHEMERIS_OUT_OF_RANGE' });
});
