import { angularRadiusDeg, createLocalSkyProjector, type Vec3 } from './coordinates.ts';

export const SOLAR_RADIUS_KM = 695700;
export const SOLAR_FRAME = 'MOON_ME_DE421' as const;
export interface SolarVectorDataset {
  schemaVersion: '1.0.0';
  timesUtc: string[];
  sunPositionMoonFixedKm: Vec3[];
  /** Moon-centre distance, NOT observer-relative distance. */
  sunDistanceKm: number[];
  /** Moon-centre angular radius, NOT topocentric angular radius. */
  sunAngularRadiusDeg: number[];
  frame: typeof SOLAR_FRAME;
  ephemerisKernel: 'DE421';
  aberrationCorrection: 'NONE';
  dataKind: 'real';
  origin: 'MOON';
  direction: 'MOON_TO_SUN';
  units: 'km';
  source: { name: string; url: string; kernelHashes: Record<string, string> };
  coverage: { startUtc: string; endUtc: string };
  warnings: string[];
  numericalLimitations?: string[];
}
export type SolarErrorCode = 'EPHEMERIS_INVALID_DATASET' | 'EPHEMERIS_INVALID_DATE' |
  'EPHEMERIS_FRAME_MISMATCH' | 'EPHEMERIS_INVALID_VECTOR' | 'EPHEMERIS_OUT_OF_RANGE' |
  'EPHEMERIS_MISSING_EPOCH' | 'EPHEMERIS_INVALID_SAMPLING' | 'EPHEMERIS_INVALID_OBSERVER';
export class SolarEphemerisError extends RangeError {
  readonly code: SolarErrorCode;
  constructor(code: SolarErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.code = code;
    this.name = 'SolarEphemerisError';
  }
}
export function solarFail(code: SolarErrorCode, message: string): never {
  throw new SolarEphemerisError(code, message);
}
/** Accept seconds and 1–3 fractional digits only; reject normalization, leap seconds and invalid calendar dates. */
export function parseSolarUtc(value: unknown): number {
  if (typeof value !== 'string' || value.startsWith('0000-') || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    return solarFail('EPHEMERIS_INVALID_DATE', 'Expected canonical UTC seconds with optional 1–3 fractional digits and Z');
  }
  const ms = Date.parse(value);
  const [whole, fraction = ''] = value.slice(0, -1).split('.');
  if (!Number.isSafeInteger(ms) || new Date(ms).toISOString() !== `${whole}.${fraction.padEnd(3, '0')}Z`) {
    return solarFail('EPHEMERIS_INVALID_DATE', `Invalid calendar date: ${value}`);
  }
  return ms;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function fields(value: Record<string, unknown>, required: string[], optional: string[] = []): void {
  if (required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) {
    solarFail('EPHEMERIS_INVALID_DATASET', 'Missing or unknown contract fields');
  }
}
function text(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function strings(value: unknown): boolean {
  return Array.isArray(value) && Array.from(value).every(item => typeof item === 'string');
}
/** 64 * binary64 epsilon relative to scale: arithmetic roundoff allowance, NOT scientific uncertainty. */
function equalRoundoff(a: number, b: number): boolean {
  return Number.isFinite(a) && Math.abs(a - b) <= 64 * Number.EPSILON * Math.max(Math.abs(a), Math.abs(b), Number.MIN_VALUE);
}
function validateSolarGeometry(vector: unknown, distance: number, radius: number): asserts vector is Vec3 {
  if (!record(vector)) solarFail('EPHEMERIS_INVALID_VECTOR', 'Expected Cartesian vector');
  fields(vector, ['x', 'y', 'z']);
  if (![vector.x, vector.y, vector.z].every(v => typeof v === 'number' && Number.isFinite(v))) {
    solarFail('EPHEMERIS_INVALID_VECTOR', 'Vector components must be finite');
  }
  const norm = Math.hypot(vector.x as number, vector.y as number, vector.z as number);
  if (norm < 130e6 || norm > 170e6 || !Number.isFinite(norm) || !equalRoundoff(distance, norm) || !equalRoundoff(radius, angularRadiusDeg(SOLAR_RADIUS_KM, norm))) {
    solarFail('EPHEMERIS_INVALID_VECTOR', 'Solar norm must be 130e6..170e6 km; centre distance and radius must agree with vector');
  }
}
export function validateSolarVectorDataset(value: unknown): asserts value is SolarVectorDataset {
  if (!record(value)) solarFail('EPHEMERIS_INVALID_DATASET', 'Expected solar dataset object');
  fields(value, ['schemaVersion', 'timesUtc', 'sunPositionMoonFixedKm', 'sunDistanceKm', 'sunAngularRadiusDeg', 'frame', 'ephemerisKernel', 'aberrationCorrection', 'dataKind', 'origin', 'direction', 'units', 'source', 'coverage', 'warnings'], ['numericalLimitations']);
  if (value.frame !== SOLAR_FRAME) solarFail('EPHEMERIS_FRAME_MISMATCH', 'Only MOON_ME_DE421 is accepted; no implicit frame conversion');
  const literals = { schemaVersion: '1.0.0', ephemerisKernel: 'DE421', aberrationCorrection: 'NONE', dataKind: 'real', origin: 'MOON', direction: 'MOON_TO_SUN', units: 'km' };
  for (const [key, expected] of Object.entries(literals)) if (value[key] !== expected) solarFail('EPHEMERIS_INVALID_DATASET', `Invalid ${key}`);
  if (!record(value.source)) solarFail('EPHEMERIS_INVALID_DATASET', 'Missing source');
  fields(value.source, ['name', 'url', 'kernelHashes']);
  const kernels = ['moon_080317.tf', 'moon_pa_de421_1900-2050.bpc', 'naif0012.tls', 'de421.bsp'];
  // Syntax/provenance metadata checks cannot authenticate source claims or verify kernel bytes.
  if (!text(value.source.name) || !text(value.source.url) || !record(value.source.kernelHashes)) solarFail('EPHEMERIS_INVALID_DATASET', 'Source name, URL and kernel hashes required');
  fields(value.source.kernelHashes, kernels);
  if (!Object.values(value.source.kernelHashes).every(hash => typeof hash === 'string' && /^[a-fA-F0-9]{64}$/.test(hash))) solarFail('EPHEMERIS_INVALID_DATASET', 'Expected four SHA-256 kernel hashes');
  try {
    const url = new URL(value.source.url as string);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Invalid protocol');
  } catch { solarFail('EPHEMERIS_INVALID_DATASET', 'Source URL must be absolute HTTP(S)'); }
  if (!record(value.coverage)) solarFail('EPHEMERIS_INVALID_DATASET', 'Missing coverage');
  fields(value.coverage, ['startUtc', 'endUtc']);
  const start = parseSolarUtc(value.coverage.startUtc), end = parseSolarUtc(value.coverage.endUtc);
  if (start > end || !strings(value.warnings) || (value.numericalLimitations !== undefined && !strings(value.numericalLimitations))) solarFail('EPHEMERIS_INVALID_DATASET', 'Invalid coverage or warnings');
  const arrays = [value.timesUtc, value.sunPositionMoonFixedKm, value.sunDistanceKm, value.sunAngularRadiusDeg];
  if (!arrays.every(Array.isArray) || !(value.timesUtc as unknown[]).length || (value.timesUtc as unknown[]).length > 100000 || !arrays.every(a => (a as unknown[]).length === (value.timesUtc as unknown[]).length)) solarFail('EPHEMERIS_INVALID_DATASET', 'Nonempty aligned arrays required');
  let previous = -Infinity;
  for (let i = 0; i < (value.timesUtc as unknown[]).length; i++) {
    const time = parseSolarUtc((value.timesUtc as unknown[])[i]);
    if (time <= previous || time < start || time > end) solarFail('EPHEMERIS_INVALID_DATASET', 'Times must strictly increase within coverage');
    previous = time;
    validateSolarGeometry((value.sunPositionMoonFixedKm as unknown[])[i], (value.sunDistanceKm as number[])[i], (value.sunAngularRadiusDeg as number[])[i]);
  }
}
export interface SolarVectorSample {
  timeUtc: string;
  frame: typeof SOLAR_FRAME;
  sunPositionMoonFixedKm: Vec3;
  sunDistanceKm: number;
  sunAngularRadiusDeg: number;
}
/** Exact epochs only, with defensive copies. No interpolation, extrapolation or frame transformation. */
export function createSolarVectorLookup(dataset: SolarVectorDataset): (timeUtc: string) => SolarVectorSample {
  validateSolarVectorDataset(dataset);
  const start = parseSolarUtc(dataset.coverage.startUtc), end = parseSolarUtc(dataset.coverage.endUtc);
  const samples = new Map(dataset.timesUtc.map((timeUtc, i) => [parseSolarUtc(timeUtc), {
    timeUtc, frame: SOLAR_FRAME, sunPositionMoonFixedKm: { ...dataset.sunPositionMoonFixedKm[i] },
    sunDistanceKm: dataset.sunDistanceKm[i], sunAngularRadiusDeg: dataset.sunAngularRadiusDeg[i],
  }]));
  return timeUtc => {
    const ms = parseSolarUtc(timeUtc);
    if (ms < start || ms > end) solarFail('EPHEMERIS_OUT_OF_RANGE', 'Epoch outside coverage');
    const sample = samples.get(ms);
    if (!sample) solarFail('EPHEMERIS_MISSING_EPOCH', 'Exact epoch unavailable; interpolation is not supported');
    return { ...sample, sunPositionMoonFixedKm: { ...sample.sunPositionMoonFixedKm } };
  };
}
export interface SolarObserver { latDeg: number; lonDeg: number; surfaceElevationM: number; observerHeightM: number }
/** Frame-agnostic ENU math, only after exact frame agreement. Spherical radial observer: 1737.4 km + elevations. */
export function projectSolarVector(sample: SolarVectorSample, terrainFrame: string, observer: SolarObserver) {
  if (!sample || sample.frame !== SOLAR_FRAME || terrainFrame !== sample.frame) solarFail('EPHEMERIS_FRAME_MISMATCH', 'Solar and terrain frames must both be MOON_ME_DE421; no conversion is performed');
  parseSolarUtc(sample.timeUtc);
  if (!observer || !Number.isFinite(observer.observerHeightM) || observer.observerHeightM < 0) solarFail('EPHEMERIS_INVALID_OBSERVER', 'Finite nonnegative observer height is required');
  validateSolarGeometry(sample.sunPositionMoonFixedKm, sample.sunDistanceKm, sample.sunAngularRadiusDeg);
  const sky = createLocalSkyProjector(observer.latDeg, observer.lonDeg, observer.surfaceElevationM, observer.observerHeightM)(sample.sunPositionMoonFixedKm);
  return {
    ...sky, angularRadiusDeg: angularRadiusDeg(SOLAR_RADIUS_KM, sky.distanceKm),
    distanceReference: 'TOPOCENTRIC' as const,
    moonCentreDistanceKm: sample.sunDistanceKm, moonCentreAngularRadiusDeg: sample.sunAngularRadiusDeg,
  };
}
