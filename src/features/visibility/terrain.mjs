import { validateHorizonProfile } from './horizon.mjs';

function finiteNonNegative(value) {
  return Number.isFinite(value) && value >= 0;
}

function validateRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new TypeError('A horizon request is required');
  if (request.strictTerrain !== undefined && typeof request.strictTerrain !== 'boolean') throw new TypeError('strictTerrain must be a boolean');
  if (typeof request.siteId !== 'string' || !request.siteId.trim() ||
      !finiteNonNegative(request.observerHeightM) ||
      typeof request.frame !== 'string' || !request.frame.trim()) {
    throw new TypeError('Request siteId, finite non-negative observerHeightM, and non-empty frame are required');
  }
}

export function createFlatHorizon({ siteId, observerHeightM = 0 }) {
  if (typeof siteId !== 'string' || !siteId.trim()) throw new TypeError('siteId must be a non-empty string');
  if (!finiteNonNegative(observerHeightM)) throw new TypeError('observerHeightM must be finite and non-negative');
  return {
    siteId,
    azimuthDeg: [0, 90, 180, 270],
    elevationDeg: [0, 0, 0, 0],
    model: 'flat',
    dataKind: 'synthetic',
    sourceIds: [],
    observerHeightM,
    warnings: ['Flat synthetic horizon assumption; no terrain data was used.']
  };
}

export function loadTerrainHorizon(document, request) {
  if (!document || typeof document !== 'object') throw new TypeError('Terrain document is required');
  validateRequest(request);
  const { profile, coverage, sources } = document;
  if (!profile || profile.model !== 'terrain') throw new TypeError('A terrain HorizonProfile is required');
  if (!coverage || !Array.isArray(sources)) throw new TypeError('Terrain coverage and declared sources are required');
  if (profile.siteId !== request.siteId || profile.observerHeightM !== request.observerHeightM ||
      coverage.siteId !== request.siteId || coverage.observerHeightM !== request.observerHeightM || coverage.frame !== request.frame ||
      coverage.azimuthCoverage !== 'full-circle') {
    throw new RangeError('Terrain profile coverage does not match the requested site, height, frame, or full-circle coverage');
  }
  const declared = new Set();
  for (const source of sources) {
    if (!source || typeof source.id !== 'string' || !source.id.trim() ||
        typeof source.url !== 'string' || !source.url.trim() ||
        typeof source.description !== 'string' || !source.description.trim()) {
      throw new TypeError('Each terrain source must have a non-empty id, URL, and description');
    }
    let protocol;
    try {
      protocol = new URL(source.url).protocol;
    } catch {
      throw new TypeError('Terrain source URL must be a valid HTTP or HTTPS URL');
    }
    if (protocol !== 'http:' && protocol !== 'https:') throw new TypeError('Terrain source URL must use HTTP or HTTPS');
    if (declared.has(source.id)) throw new TypeError(`Duplicate terrain source id: ${source.id}`);
    declared.add(source.id);
  }
  if (!Array.isArray(profile.sourceIds) || profile.sourceIds.length === 0 || profile.sourceIds.some(id => !declared.has(id))) {
    throw new TypeError('Terrain profile must reference declared sources');
  }
  if (!validateHorizonProfile(profile)) throw new TypeError('Invalid terrain HorizonProfile');
  return profile;
}

export function selectHorizon(documentOrNull, request) {
  validateRequest(request);
  if (documentOrNull != null) return loadTerrainHorizon(documentOrNull, request);
  if (request.strictTerrain === true) throw new Error('Terrain horizon required but no terrain document was provided');
  const horizon = createFlatHorizon({ siteId: request.siteId, observerHeightM: request.observerHeightM });
  horizon.warnings.push(`Terrain horizon unavailable for ${request.siteId} at ${request.observerHeightM} m in ${request.frame}; explicitly falling back to a flat synthetic horizon.`);
  return horizon;
}
