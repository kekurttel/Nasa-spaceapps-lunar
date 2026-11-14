/**
 * Stable error codes exposed as `code` on coordinate validation errors.
 * EPHEMERIS_POLAR_AZIMUTH indicates that north/azimuth is undefined at a pole.
 */
export type EphemerisErrorCode =
  | 'EPHEMERIS_INVALID_VALUE'
  | 'EPHEMERIS_LATITUDE_RANGE'
  | 'EPHEMERIS_LONGITUDE_RANGE'
  | 'EPHEMERIS_POLAR_AZIMUTH'
  | 'EPHEMERIS_OBSERVER_RADIUS'
  | 'EPHEMERIS_ZERO_DIRECTION'
  | 'EPHEMERIS_RADIUS_RANGE'
  | 'EPHEMERIS_DISTANCE_RANGE';

export class EphemerisCoordinateError extends RangeError {
  readonly code: EphemerisErrorCode;

  constructor(code: EphemerisErrorCode, message: string) {
    super(message);
    this.name = 'EphemerisCoordinateError';
    this.code = code;
  }
}

/** Cartesian vector in the Moon-fixed frame, in kilometres. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Mean lunar reference radius used by this spherical observer model. */
export const LUNAR_REFERENCE_RADIUS_KM = 1737.4;

export interface LocalSkyDirection {
  /** Elevation above the observer's local tangent plane, in degrees. */
  altitude: number;
  /** Bearing clockwise from north, in [0, 360) degrees. */
  azimuth: number;
  /** Observer-to-target distance in kilometres. */
  distanceKm: number;
}

/**
 * Convert a Moon-fixed target position to a spherical Moon observer's local
 * north-east-up frame. Longitude is east-positive. No refraction or terrain
 * horizon is applied. Exact poles are rejected because north is undefined.
 */
export function localSkyDirection(
  targetMoonFixedKm: Vec3,
  latDeg: number,
  lonDeg: number,
  surfaceElevationM: number,
  observerHeightM: number,
): LocalSkyDirection {
  assertFinite('targetMoonFixedKm.x', targetMoonFixedKm?.x);
  assertFinite('targetMoonFixedKm.y', targetMoonFixedKm?.y);
  assertFinite('targetMoonFixedKm.z', targetMoonFixedKm?.z);
  assertFinite('latDeg', latDeg);
  assertFinite('lonDeg', lonDeg);
  assertFinite('surfaceElevationM', surfaceElevationM);
  assertFinite('observerHeightM', observerHeightM);
  if (latDeg < -90 || latDeg > 90) throw new EphemerisCoordinateError('EPHEMERIS_LATITUDE_RANGE', 'latDeg must be in [-90, 90]');
  if (lonDeg < -180 || lonDeg > 180) throw new EphemerisCoordinateError('EPHEMERIS_LONGITUDE_RANGE', 'lonDeg must be in [-180, 180]');
  if (latDeg === 90 || latDeg === -90) throw new EphemerisCoordinateError('EPHEMERIS_POLAR_AZIMUTH', 'Azimuth is undefined at an exact pole');

  const lat = radians(latDeg);
  const lon = radians(lonDeg);
  const radiusKm = LUNAR_REFERENCE_RADIUS_KM + (surfaceElevationM + observerHeightM) / 1_000;
  if (radiusKm <= 0) throw new EphemerisCoordinateError('EPHEMERIS_OBSERVER_RADIUS', 'Observer radius must be positive');
  const cosLat = Math.cos(lat);
  const observer = {
    x: radiusKm * cosLat * Math.cos(lon),
    y: radiusKm * cosLat * Math.sin(lon),
    z: radiusKm * Math.sin(lat),
  };
  const dx = targetMoonFixedKm.x - observer.x;
  const dy = targetMoonFixedKm.y - observer.y;
  const dz = targetMoonFixedKm.z - observer.z;
  const distanceKm = Math.hypot(dx, dy, dz);
  if (distanceKm === 0) throw new EphemerisCoordinateError('EPHEMERIS_ZERO_DIRECTION', 'Target vector coincides with observer (zero direction)');

  const north = -Math.sin(lat) * Math.cos(lon) * dx
    - Math.sin(lat) * Math.sin(lon) * dy + Math.cos(lat) * dz;
  const east = -Math.sin(lon) * dx + Math.cos(lon) * dy;
  const up = cosLat * Math.cos(lon) * dx + cosLat * Math.sin(lon) * dy + Math.sin(lat) * dz;
  const horizontal = Math.hypot(north, east);
  const altitude = Math.atan2(up, horizontal) * 180 / Math.PI;
  const azimuth = ((Math.atan2(east, north) * 180 / Math.PI) % 360 + 360) % 360;
  return { altitude, azimuth, distanceKm };
}

/** Angular radius in degrees for a sphere of radius radiusKm at distanceKm. */
export function angularRadiusDeg(radiusKm: number, distanceKm: number): number {
  assertFinite('radiusKm', radiusKm);
  assertFinite('distanceKm', distanceKm);
  if (radiusKm < 0) throw new EphemerisCoordinateError('EPHEMERIS_RADIUS_RANGE', 'radiusKm must be non-negative');
  if (distanceKm <= 0) throw new EphemerisCoordinateError('EPHEMERIS_DISTANCE_RANGE', 'distanceKm must be positive');
  if (radiusKm > distanceKm) throw new EphemerisCoordinateError('EPHEMERIS_RADIUS_RANGE', 'radiusKm cannot exceed distanceKm');
  return Math.asin(radiusKm / distanceKm) * 180 / Math.PI;
}

function assertFinite(name: string, value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new EphemerisCoordinateError('EPHEMERIS_INVALID_VALUE', `${name} must be a finite number`);
  }
}

function radians(degrees: number): number {
  return degrees * Math.PI / 180;
}
