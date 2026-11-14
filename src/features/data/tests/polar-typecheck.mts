import {
  polarRegions, polarEvidenceSources, polarDemDefinition, classifyPolarCoverage,
  validatePolarRegions, validatePolarEvidence, validatePolarDemDefinition,
  type PolarCoverageInput, type PolarCoverageStatus,
} from '../index.mjs';
const input: PolarCoverageInput = { latDeg: -85, lonDeg: 270, sample: { status: 'valid', rawValue: 0 } };
const output = classifyPolarCoverage(input);
const status: PolarCoverageStatus = output.status;
const unknown: 'unknown' = output.illumination;
const id: string = polarRegions[0].id;
const latitude: number | null = polarRegions[0].latDeg;
const local: false = polarEvidenceSources[0].localDataAvailable;
const nodata: null = polarDemDefinition.nodataSentinel;
validatePolarRegions(); validatePolarEvidence(); validatePolarDemDefinition();
// @ts-expect-error frozen catalog cannot be mutated
polarRegions[0].latDeg = -88;
// @ts-expect-error no illumination prediction is exported
const illuminated: 'lit' = output.illumination;
void [status, unknown, id, latitude, local, nodata, illuminated];
