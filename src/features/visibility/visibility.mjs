import { validateHorizonProfile, interpolateHorizon } from './horizon.mjs';

const DATA_KINDS = new Set(['real', 'synthetic', 'mixed']);
const GEOMETRIC_WARNING = 'Geometric Earth visibility is not a communication-link guarantee.';
const PROVENANCE_WARNING = 'Terrain provenance is caller-declared; source authenticity is not verified.';

function assertFinite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
}

function mergeDataKinds(...kinds) {
  if (kinds.some((kind) => !DATA_KINDS.has(kind))) throw new TypeError('invalid dataKind');
  return new Set(kinds).size === 1 ? kinds[0] : 'mixed';
}

function isValidUtc(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?Z$/.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute, second] = match;
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) return false;
  const date = new Date(millis);
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day) && date.getUTCHours() === Number(hour) &&
    date.getUTCMinutes() === Number(minute) && date.getUTCSeconds() === Number(second);
}

function validateSky(sky) {
  if (!sky || typeof sky !== 'object' || Array.isArray(sky)) throw new TypeError('sky is required');
  if (typeof sky.scenarioId !== 'string' || !sky.scenarioId.trim()) throw new TypeError('scenarioId must be nonempty');
  if (!sky.quality || typeof sky.quality !== 'object' || Array.isArray(sky.quality)) throw new TypeError('quality is required');
  if (typeof sky.quality.model !== 'string' || !sky.quality.model.trim()) throw new TypeError('quality.model must be nonempty');
  if (!Array.isArray(sky.quality.warnings) || Array.from(sky.quality.warnings).some((warning) => typeof warning !== 'string')) throw new TypeError('quality warnings must be an array of strings');
  if (!Array.isArray(sky.timesUtc)) throw new TypeError('timesUtc must be an array');
  const n = sky.timesUtc.length;
  for (const field of ['sunAltDeg', 'sunAzDeg', 'earthAltDeg', 'earthAzDeg', 'sunRadiusDeg']) {
    if (!Array.isArray(sky[field]) || sky[field].length !== n) throw new TypeError(`${field} length must match timesUtc`);
    for (const value of sky[field]) assertFinite(value, field);
  }
  for (const field of ['sunAltDeg', 'earthAltDeg']) {
    if (sky[field].some((value) => value < -90 || value > 90)) throw new RangeError(`${field} altitude must be in [-90, 90]`);
  }
  if (sky.sunAzDeg.some((value) => value < 0 || value >= 360) || sky.earthAzDeg.some((value) => value < 0 || value >= 360)) throw new RangeError('azimuths must be in [0, 360)');
  let previous = -Infinity;
  for (const time of sky.timesUtc) {
    if (!isValidUtc(time)) throw new TypeError('timesUtc must contain valid UTC timestamps');
    const instant = Date.parse(time);
    if (instant <= previous) throw new TypeError('timesUtc must be strictly increasing');
    previous = instant;
  }
}

/** Approximate a locally straight horizon across a flat circular solar disk. */
export function solarVisibleFraction(centerAltitudeDeg, horizonElevationDeg, radiusDeg) {
  assertFinite(centerAltitudeDeg, 'center altitude');
  assertFinite(horizonElevationDeg, 'horizon elevation');
  assertFinite(radiusDeg, 'solar radius');
  if (radiusDeg <= 0) throw new RangeError('solar radius must be positive');
  const x = Math.max(-1, Math.min(1, (centerAltitudeDeg - horizonElevationDeg) / radiusDeg));
  return Math.max(0, Math.min(1, (Math.acos(-x) + x * Math.sqrt(Math.max(0, 1 - x * x))) / Math.PI));
}

/**
 * frame contract: HorizonProfile has no frame field, so options.horizonFrame
 * is required and must match options.frame and sky.quality.frame.
 * Earth visibility is geometric center visibility, not a communication-link guarantee.
 */
export function computeVisibility(sky, horizon, options = {}) {
  validateSky(sky);
  if (!validateHorizonProfile(horizon)) throw new TypeError('Invalid horizon profile');
  const { siteId, observerHeightM, frame, horizonFrame, marginDeg = 0, strictTerrain = false } = options;
  if (siteId !== horizon.siteId) throw new TypeError('siteId does not match horizon');
  assertFinite(observerHeightM, 'observerHeightM');
  if (observerHeightM !== horizon.observerHeightM) throw new TypeError('observerHeightM does not match horizon');
  if (typeof frame !== 'string' || !frame || horizonFrame !== frame || sky.quality.frame !== frame) throw new TypeError('frame must match sky.quality.frame and horizonFrame');
  assertFinite(marginDeg, 'marginDeg');
  if (typeof strictTerrain !== 'boolean') throw new TypeError('strictTerrain must be boolean');
  if (strictTerrain && horizon.model !== 'terrain') throw new TypeError('strictTerrain requires terrain horizon');
  const sunVisibleFraction = [];
  const earthVisible = [];
  for (let i = 0; i < sky.timesUtc.length; i++) {
    sunVisibleFraction.push(solarVisibleFraction(sky.sunAltDeg[i], interpolateHorizon(horizon, sky.sunAzDeg[i]), sky.sunRadiusDeg[i]));
    earthVisible.push(sky.earthAltDeg[i] > interpolateHorizon(horizon, sky.earthAzDeg[i]) + marginDeg);
  }
  const warnings = [...sky.quality.warnings, ...horizon.warnings];
  if (horizon.model === 'flat' && !warnings.some((warning) => /flat horizon/i.test(warning))) {
    warnings.push('Flat horizon is an explicit assumption; terrain obstruction is not represented.');
  }
  warnings.push(GEOMETRIC_WARNING);
  if (horizon.model === 'terrain') warnings.push(PROVENANCE_WARNING);
  return {
    scenarioId: sky.scenarioId,
    timesUtc: [...sky.timesUtc],
    sunVisibleFraction,
    earthVisible,
    bothAvailable: sunVisibleFraction.map((fraction, i) => fraction > 0 && earthVisible[i]),
    quality: { dataKind: mergeDataKinds(sky.quality.dataKind, horizon.dataKind), horizonModel: horizon.model, earthRule: 'center', warnings }
  };
}
