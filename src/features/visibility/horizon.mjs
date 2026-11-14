export function validateHorizonProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return false;
  if (typeof profile.siteId !== 'string' || profile.siteId.trim() === '') return false;
  if (!Array.isArray(profile.azimuthDeg) || !Array.isArray(profile.elevationDeg)) return false;
  if (profile.azimuthDeg.length < 2 || profile.azimuthDeg.length !== profile.elevationDeg.length) return false;
  if (Array.from(profile.azimuthDeg).some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v >= 360)) return false;
  if (Array.from(profile.elevationDeg).some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < -90 || v > 90)) return false;
  for (let i = 1; i < profile.azimuthDeg.length; i++) {
    if (profile.azimuthDeg[i] <= profile.azimuthDeg[i - 1]) return false;
  }
  if (profile.model !== 'terrain' && profile.model !== 'flat') return false;
  if (!['real', 'synthetic', 'mixed'].includes(profile.dataKind)) return false;
  if (profile.model === 'flat' && (profile.dataKind !== 'synthetic' || profile.elevationDeg.some((v) => v !== 0))) return false;
  if (!Array.isArray(profile.sourceIds) || Array.from(profile.sourceIds).some((v) => typeof v !== 'string' || v.trim() === '')) return false;
  if (profile.model === 'terrain' && profile.sourceIds.length === 0) return false;
  if (typeof profile.observerHeightM !== 'number' || !Number.isFinite(profile.observerHeightM) || profile.observerHeightM < 0) return false;
  if (!Array.isArray(profile.warnings) || Array.from(profile.warnings).some((v) => typeof v !== 'string')) return false;
  return true;
}

export function interpolateHorizon(profile, azimuthDeg) {
  if (!validateHorizonProfile(profile)) throw new TypeError('Invalid horizon profile');
  if (typeof azimuthDeg !== 'number' || !Number.isFinite(azimuthDeg)) throw new TypeError('azimuthDeg must be finite');
  const azimuth = ((azimuthDeg % 360) + 360) % 360;
  const az = profile.azimuthDeg;
  const el = profile.elevationDeg;
  let right = az.findIndex((sample) => sample >= azimuth);
  if (right < 0) right = az.length;
  const left = (right - 1 + az.length) % az.length;
  const r = right % az.length;
  let leftAz = az[left];
  let rightAz = az[r];
  let query = azimuth;
  if (right === 0) leftAz -= 360;
  if (right === az.length) rightAz += 360;
  if (query < leftAz) query += 360;
  const fraction = (query - leftAz) / (rightAz - leftAz);
  return el[left] + fraction * (el[r] - el[left]);
}
