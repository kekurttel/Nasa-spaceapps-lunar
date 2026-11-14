import type { DeepReadonly, ValidationError } from '../index.mjs';

export interface PolarRegionSource {
  id: string; url: string; productId: string; accessedDate: string; agency: string; usageTerms: string;
  coordinateVerbatim: string; derivation: string; coordinateFrame: string; identityLimitations: string;
  [key: string]: unknown;
}
export interface PolarRegion {
  id: string; name: string; latDeg: number | null; lonDeg: number | null; regionType: string; sourceIds: readonly string[];
  coordinateProvenance: { kind: string; sourceId: string; sourceCoordinateVerbatim: string; derivation: string; coordinateFrame: string; accessedDate: string };
  demSupport: { productId: 'LDEM_80S_80M'; geographicCandidate: boolean; localTerrainAnalysis: 'conditional' | 'unsupported'; limitations: readonly string[] };
  limitations: readonly string[];
  [key: string]: unknown;
}
export interface PolarEvidenceSource {
  id: string; title: string; agency: string; url: string; accessedDate: string; productId: string | null;
  metadataUrls?: string[];
  evidenceType: 'thermal-observation' | 'ultraviolet-observation' | 'model-derived';
  provenance: string; coordinateFrame: string; temporalCoverage: string; spatialCoverage: string;
  usageTerms: { url: string; verificationState: string }; localDataAvailable: false;
  [key: string]: unknown;
}
export interface PolarDemDefinition {
  product: 'LDEM_80S_80M V2.1'; dimensions: { columns: 7600; rows: 7600 }; postingM: 80;
  projection: 'south-polar stereographic'; referenceFrame: 'MEAN EARTH/POLAR AXIS OF DE421';
  encoding: { type: 'signed 16-bit integer'; scaleM: 0.5; offsetM: 1737400 };
  approximateLatitudeRangeDeg: readonly [-90, -80]; rectangleIsGeographicMask: false;
  sourceLabel: string; sourceLabelVerified: true; sourceLabelInspectedOn: string; nodataSentinel: null;
  sourceLabelVerification: { [key: string]: unknown };
}
export type PolarCoverageStatus = 'invalid-coordinate' | 'unsupported-coordinate' | 'footprint-unverified' | 'outside-raster' | 'dem-edge' | 'nodata' | 'missing-dem' | 'usable-dem';
export interface PolarCoverageInput {
  latDeg: number | string; lonDeg: number | string;
  pixel?: { column: number; row: number };
  sample?: { status: 'valid' | 'nodata' | 'missing'; rawValue?: number };
  projectionVerified?: boolean; frameVerified?: boolean; independentValidationAvailable?: boolean;
}
export interface PolarCoverageResult {
  status: PolarCoverageStatus; independentValidation: 'available' | 'missing'; illumination: 'unknown'; reason?: string;
  latitudeDeg?: number; longitudeDeg?: number; pixel?: { column: number; row: number };
  radiusM?: number; surfaceElevationM?: number;
}
export type PolarMetadataResult = { ok: true } | { ok: false; errors: (ValidationError | string)[] };
export declare const polarRegions: DeepReadonly<PolarRegion[]>;
export declare const polarRegionSources: DeepReadonly<PolarRegionSource[]>;
export declare const polarEvidenceSources: DeepReadonly<PolarEvidenceSource[]>;
export declare const polarDemDefinition: DeepReadonly<PolarDemDefinition>;
export declare const psrValidationOptions: DeepReadonly<{
  acceptedEvidenceTypes: string[]; requiredFamilies: string[];
  requireExplicitCoordinateFrame: boolean; requireProductIdOrNull: boolean;
}>;
export declare function classifyPolarCoverage(input: unknown): PolarCoverageResult;
export declare function validatePolarRegions(regions?: unknown, sources?: unknown): PolarMetadataResult;
export declare function validatePolarEvidence(sources?: unknown, options?: unknown): PolarMetadataResult;
export declare function validatePolarDemDefinition(definition?: unknown): PolarMetadataResult;
