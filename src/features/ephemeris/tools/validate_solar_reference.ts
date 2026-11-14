import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSolarVectorLookup, projectSolarVector, validateSolarVectorDataset } from '../solarVectors.ts';

const report = JSON.parse(readFileSync(new URL('../fixtures/de421-solar-validation.json', import.meta.url), 'utf8'));
const data: unknown = report.actualNewGeneratorOutput;
validateSolarVectorDataset(data);
const lookup = createSolarVectorLookup(data);
const maximumResiduals = { azDeg: 0, altDeg: 0, radiusDeg: 0, topocentricDistanceKm: 0 };
for (const row of report.rawComparisons) {
  const local = projectSolarVector(lookup(row.utc), 'MOON_ME_DE421', {
    latDeg: row.latitudeDeg, lonDeg: row.longitudeDeg, surfaceElevationM: 0, observerHeightM: 2,
  });
  const residuals = {
    azDeg: Math.abs(((local.azimuth - row.registeredActual.azDeg + 540) % 360) - 180),
    altDeg: Math.abs(local.altitude - row.registeredActual.altDeg),
    radiusDeg: Math.abs(local.angularRadiusDeg - row.registeredActual.radiusDeg),
    topocentricDistanceKm: Math.abs(local.distanceKm - row.registeredActual.topocentricDistanceKm),
  };
  for (const key of Object.keys(residuals) as (keyof typeof residuals)[]) {
    maximumResiduals[key] = Math.max(maximumResiduals[key], residuals[key]);
    assert.ok(residuals[key] <= report.tolerancesChosenBeforeEvaluation[key], `${key} exceeds predeclared implementation tolerance`);
  }
}
console.log(JSON.stringify({ sourcePin: report.sourcePin, scope: 'TypeScript projection of real Python solar vectors vs actual pinned Agent3',
  sampleCount: report.rawComparisons.length, maximumResiduals, passed: true }, null, 2));
