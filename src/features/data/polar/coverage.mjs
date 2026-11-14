import { normalizeLongitude } from '../validation.mjs';

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** PDS label was inspected for metadata; this does not verify a local raster. Rectangle is not a geographic mask. */
export const polarDemDefinition = deepFreeze({
  product: 'LDEM_80S_80M V2.1',
  dimensions: { columns: 7600, rows: 7600 },
  postingM: 80,
  projection: 'south-polar stereographic',
  referenceFrame: 'MEAN EARTH/POLAR AXIS OF DE421',
  encoding: { type: 'signed 16-bit integer', scaleM: 0.5, offsetM: 1737400 },
  approximateLatitudeRangeDeg: [-90, -80],
  rectangleIsGeographicMask: false,
  sourceLabel: 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/jp2/ldem_80s_80m_jp2.lbl',
  sourceLabelVerified: true,
  sourceLabelInspectedOn: '2026-11-14',
  sourceLabelVerification: { dimensions: '7600 x 7600', postingM: 80, poleIncluded: true, referenceFrame: 'MEAN EARTH/POLAR AXIS OF DE421', coordinateSystem: 'PLANETOCENTRIC/EAST', sampleEncoding: 'signed 16-bit integer', scaleM: 0.5, offsetM: 1737400, latitudeRangeDeg: [-90, -80], mapOffsetPixels: { sample: 3799.5, line: 3799.5 }, nodataSentinel: null },
  nodataSentinel: null,
});

const STATUSES = new Set(['valid', 'nodata', 'missing']);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function base(status, extra = {}) {
  return { status, independentValidation: 'missing', illumination: 'unknown', ...extra };
}

/** Conservative ordering: validate coordinates/flags; distinguish geographic coverage, observer limitations,
 * supplied raster pixel and sample. Never project coordinates, infer pixels, or infer a NoData sentinel.
 * usable-dem means only a valid supplied sample, not bilinear/ray-path/horizon coverage.
 */
export function classifyPolarCoverage(input) {
  if (!isObject(input)) return base('invalid-coordinate', { reason: 'invalid-input' });
  let latitude;
  let longitude;
  try {
    const lat = input.latDeg;
    if (typeof lat === 'string') {
      if (!lat.trim() || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(lat.trim())) throw new RangeError();
    } else if (typeof lat !== 'number') throw new RangeError();
    latitude = Number(lat);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new RangeError();
    longitude = normalizeLongitude(input.lonDeg);
  } catch {
    return base('invalid-coordinate');
  }

  for (const key of ['projectionVerified', 'frameVerified', 'independentValidationAvailable']) {
    if (input[key] !== undefined && typeof input[key] !== 'boolean') return base('invalid-coordinate', { reason: `invalid-${key}` });
  }
  const independentValidation = input.independentValidationAvailable === true ? 'available' : 'missing';
  // -80 is a coarse geographic candidate boundary, not a raster footprint test.
  if (latitude > -80) return base('unsupported-coordinate', { reason: 'outside-geographic-coverage', latitudeDeg: latitude, longitudeDeg: longitude, independentValidation });
  // Pole has geographic coverage, but consumers cannot define observer azimuth there.
  if (latitude === -90) return base('unsupported-coordinate', { reason: 'observer-analysis-unsupported-at-pole', latitudeDeg: latitude, longitudeDeg: longitude, independentValidation });

  if (!isObject(input.pixel) || !Number.isSafeInteger(input.pixel.column) || !Number.isSafeInteger(input.pixel.row)) {
    return base('footprint-unverified', { latitudeDeg: latitude, longitudeDeg: longitude, independentValidation });
  }
  const { column, row } = input.pixel;
  if (column < 0 || row < 0 || column >= 7600 || row >= 7600) return base('outside-raster', { pixel: { column, row }, latitudeDeg: latitude, longitudeDeg: longitude, independentValidation });
  if (!isObject(input.sample) || !STATUSES.has(input.sample.status)) return base('footprint-unverified', { latitudeDeg: latitude, longitudeDeg: longitude, independentValidation });
  if (input.sample.status === 'missing') return base('missing-dem', { latitudeDeg: latitude, longitudeDeg: longitude, independentValidation });
  if (input.sample.status === 'nodata') {
    if (input.sample.rawValue !== undefined && (!Number.isInteger(input.sample.rawValue) || input.sample.rawValue < -32768 || input.sample.rawValue > 32767)) return base('footprint-unverified', { reason: 'invalid-signed-16-bit-sample', latitudeDeg: latitude, longitudeDeg: longitude, independentValidation });
    return base('nodata', { latitudeDeg: latitude, longitudeDeg: longitude, independentValidation });
  }
  if (!Number.isInteger(input.sample.rawValue) || input.sample.rawValue < -32768 || input.sample.rawValue > 32767) return base('footprint-unverified', { reason: 'invalid-signed-16-bit-sample', latitudeDeg: latitude, longitudeDeg: longitude, independentValidation });
  if (input.projectionVerified !== true || input.frameVerified !== true) return base('footprint-unverified', { reason: 'projection-or-frame-unverified', latitudeDeg: latitude, longitudeDeg: longitude, independentValidation });
  // Four-neighbour consumers require a one-pixel interior margin; do not claim edge support.
  if (column < 1 || row < 1 || column >= 7599 || row >= 7599) return base('dem-edge', { pixel: { column, row }, latitudeDeg: latitude, longitudeDeg: longitude, independentValidation });
  return base('usable-dem', { pixel: { column, row }, radiusM: input.sample.rawValue * 0.5 + 1737400, surfaceElevationM: input.sample.rawValue * 0.5, latitudeDeg: latitude, longitudeDeg: longitude, independentValidation });
}

/** Validate supplied metadata against inspected PDS label values; this does not verify any local raster. */
export function validatePolarDemDefinition(definition = polarDemDefinition) {
  if (!isObject(definition)) return { ok: false, errors: ['definition must be an object'] };
  const valid = definition.product === polarDemDefinition.product && definition.dimensions?.columns === 7600 && definition.dimensions?.rows === 7600 && definition.postingM === 80 && definition.projection === 'south-polar stereographic' && definition.referenceFrame === 'MEAN EARTH/POLAR AXIS OF DE421' && definition.encoding?.type === 'signed 16-bit integer' && definition.encoding?.scaleM === 0.5 && definition.encoding?.offsetM === 1737400 && Array.isArray(definition.approximateLatitudeRangeDeg) && definition.approximateLatitudeRangeDeg.length === 2 && definition.approximateLatitudeRangeDeg[0] === -90 && definition.approximateLatitudeRangeDeg[1] === -80 && definition.rectangleIsGeographicMask === false && definition.sourceLabel === polarDemDefinition.sourceLabel && definition.nodataSentinel === null && definition.sourceLabelVerified === true && definition.sourceLabelInspectedOn === '2026-11-14' && definition.sourceLabelVerification?.coordinateSystem === 'PLANETOCENTRIC/EAST' && definition.sourceLabelVerification?.referenceFrame === 'MEAN EARTH/POLAR AXIS OF DE421' && definition.sourceLabelVerification?.poleIncluded === true;
  return valid ? { ok: true, value: definition, provenance: 'primary-label-inspected; raster-not-verified' } : { ok: false, errors: ['definition does not match inspected primary-label metadata'] };
}
