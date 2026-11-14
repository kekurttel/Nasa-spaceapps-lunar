/**
 * Integration boundary: supported terrain is real geometric terrain expressed in
 * IAU_MOON, relative to the 1,737,400 m reference sphere. ME/PA conversion is
 * not performed here; callers must transform terrain before this gate.
 *
 * The flat default horizon is a local tangent-plane horizon, not a terrain model.
 */
export const computationPolicy = Object.freeze({
  onFailure: 'error',
  syntheticFallback: false,
  defaultHorizon: 'flat',
  terrainRequiresFrameValidation: true,
  supportedTerrain: Object.freeze({
    dataKind: 'real',
    frame: 'IAU_MOON',
    referenceRadiusM: 1737400,
    heightReference: 'radial-above-reference-sphere',
    geometry: 'geometric',
  }),
} as const);

export type TerrainIntegrationMetadata = {
  frame: string;
  referenceRadiusM: number;
  heightReference: string;
  dataKind: 'real' | 'synthetic' | 'mixed';
};

export type TerrainCompatibilityErrorCode = 'EPHEMERIS_FRAME_MISMATCH' | 'HEIGHT_REFERENCE_MISMATCH' | 'EPHEMERIS_INVALID_METADATA';

export class TerrainCompatibilityError extends Error {
  readonly code: TerrainCompatibilityErrorCode;

  constructor(code: TerrainCompatibilityErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'TerrainCompatibilityError';
    this.code = code;
  }
}

/** Reject incompatible terrain metadata without modifying or relabeling input. */
export function assertCompatibleTerrain(skyFrame: string, terrain: TerrainIntegrationMetadata): void {
  if (!terrain || typeof terrain !== 'object') {
    throw new TerrainCompatibilityError('EPHEMERIS_INVALID_METADATA', 'terrain metadata is required');
  }
  if (skyFrame !== 'IAU_MOON' || terrain.frame !== 'IAU_MOON') {
    throw new TerrainCompatibilityError('EPHEMERIS_FRAME_MISMATCH', 'sky and terrain must both use IAU_MOON; frame transformation is not performed');
  }
  if (terrain.referenceRadiusM !== 1737400 || terrain.heightReference !== 'radial-above-reference-sphere') {
    throw new TerrainCompatibilityError('HEIGHT_REFERENCE_MISMATCH', 'terrain must use the 1,737,400 m reference sphere and radial-above-reference-sphere heights');
  }
  if (terrain.dataKind !== 'real') {
    throw new TerrainCompatibilityError('EPHEMERIS_INVALID_METADATA', 'terrain dataKind must be real; synthetic fallback is not supported');
  }
}
