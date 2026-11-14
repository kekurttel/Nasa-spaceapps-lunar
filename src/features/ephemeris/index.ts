import { createLocalSkyProjector, angularRadiusDeg } from './coordinates.ts';
export { createLocalSkyProjector } from './coordinates.ts';
import { datasetWarnings } from './dataQuality.ts';
import { buildScenarioTimes } from './scenario.ts';
import type { Scenario } from './scenario.ts';
import { createMoonFixedSampler } from './vectorData.ts';
export { createMoonFixedSampler, sampleMoonFixedVectors } from './vectorData.ts';
import type { MoonFixedDataset } from './vectorData.ts';

export type { Site, Scenario } from './scenario.ts';
export { sampleDurationsSeconds } from './intervals.ts';
export { assertCompatibleTerrain, computationPolicy, TerrainCompatibilityError } from './integrationPolicy.ts';
export type { TerrainIntegrationMetadata, TerrainCompatibilityErrorCode } from './integrationPolicy.ts';
export type { MoonFixedDataset, MoonFixedSample, Vector3 } from './vectorData.ts';

export interface SkySeries {
  scenarioId: string;
  timesUtc: string[];
  sunAltDeg: number[];
  sunAzDeg: number[];
  earthAltDeg: number[];
  earthAzDeg: number[];
  sunRadiusDeg: number[];
  quality: {
    dataKind: 'real' | 'synthetic' | 'mixed';
    model: string;
    frame: string;
    warnings: string[];
  };
}

export class EphemerisError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'EphemerisError';
    this.code = code;
  }
}

/** Pure offline API. No implicit network calls, synthetic fallback or extrapolation. */
export function computeSkySeries(scenario: Scenario, dataset?: MoonFixedDataset): SkySeries {
  const timesUtc = buildScenarioTimes(scenario);
  if (!dataset) {
    throw new EphemerisError('EPHEMERIS_DATA_UNAVAILABLE',
      'Supply a sourced IAU_MOON vector dataset; no production dataset is bundled.');
  }
  const sampleVectors = createMoonFixedSampler(dataset);
  const warnings = [
    'Spherical Moon radius 1737.4 km; local tangent plane, not terrain horizon.',
    'Geometric vectors: no light-time, aberration or atmospheric refraction.',
    'Lunar orientation/libration and UTC time conversion must be resolved by the source dataset provider.',
    'Linear vector interpolation; cadence-dependent error has not been independently validated.',
    'Dataset provenance is supplied by its provider; real does not imply independent accuracy validation. See bundled validation reports for tested dates, sites and interpolation errors.',
  ];
  warnings.push(...datasetWarnings(dataset));
  if (scenario.site.surfaceElevationM === null) {
    warnings.push('Unknown surface elevation: assumed 0 m relative to the 1737.4 km reference sphere.');
  }
  if (dataset.dataKind === 'synthetic') warnings.push('Synthetic test data: not a real sky prediction.');
  const result: SkySeries = {
    scenarioId: scenario.id, timesUtc,
    sunAltDeg: [], sunAzDeg: [], earthAltDeg: [], earthAzDeg: [], sunRadiusDeg: [],
    quality: {
      dataKind: dataset.dataKind,
      model: `${dataset.source}; Moon-fixed vectors with linear interpolation (${dataset.id})`,
      frame: dataset.frame,
      warnings,
    },
  };
  let project: ReturnType<typeof createLocalSkyProjector> | undefined;
  let warnedZenith = false;
  for (const time of timesUtc) {
    const sample = sampleVectors(time);
    project ??= createLocalSkyProjector(scenario.site.latDeg, scenario.site.lonDeg,
      scenario.site.surfaceElevationM ?? 0, scenario.site.observerHeightM);
    const sun = project(sample.sunKm);
    const earth = project(sample.earthKm);
    if (!warnedZenith && (Math.abs(sun.altitude) > 89.999999 || Math.abs(earth.altitude) > 89.999999)) {
      warnings.push('Azimuth is undefined at zenith/nadir; output uses the atan2 numerical convention, not a meaningful compass bearing.');
      warnedZenith = true;
    }
    result.sunAltDeg.push(sun.altitude);
    result.sunAzDeg.push(sun.azimuth);
    result.earthAltDeg.push(earth.altitude);
    result.earthAzDeg.push(earth.azimuth);
    result.sunRadiusDeg.push(angularRadiusDeg(695700, sun.distanceKm));
  }
  return result;
}
