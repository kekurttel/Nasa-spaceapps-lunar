import test from 'node:test';
import assert from 'node:assert/strict';
import { angularRadiusDeg } from '../coordinates.ts';
import { createSolarVectorLookup, parseSolarUtc, projectSolarVector, SOLAR_RADIUS_KM, validateSolarVectorDataset, type SolarVectorDataset } from '../solarVectors.ts';

// SYNTHETIC SOFTWARE TEST ONLY: no astronomical accuracy or real provenance asserted.
function fixture(): SolarVectorDataset {
  return {
    schemaVersion: '1.0.0', timesUtc: ['2024-02-29T00:00:00Z', '2024-02-29T00:00:01.1Z'],
    sunPositionMoonFixedKm: [{ x: 150e6, y: 0, z: 0 }, { x: 0, y: 150e6, z: 0 }],
    sunDistanceKm: [150e6, 150e6], sunAngularRadiusDeg: [0, 0].map(() => angularRadiusDeg(SOLAR_RADIUS_KM, 150e6)),
    frame: 'MOON_ME_DE421', ephemerisKernel: 'DE421', aberrationCorrection: 'NONE', dataKind: 'real',
    origin: 'MOON', direction: 'MOON_TO_SUN', units: 'km',
    source: { name: 'SYNTHETIC SOFTWARE TEST ONLY (contract metadata exercise)', url: 'https://example.invalid/test', kernelHashes: Object.fromEntries(['moon_080317.tf', 'moon_pa_de421_1900-2050.bpc', 'naif0012.tls', 'de421.bsp'].map(name => [name, '0'.repeat(64)])) },
    coverage: { startUtc: '2024-02-29T00:00:00Z', endUtc: '2024-02-29T00:00:02Z' }, warnings: ['SYNTHETIC SOFTWARE TEST ONLY'],
  };
}
const code = (expected: string) => (e: unknown) => (e as { code: string }).code === expected;
test('synthetic software test only: strict UTC calendar and precision roundtrip', () => {
  assert.throws(() => parseSolarUtc('0000-01-01T00:00:00Z'), code('EPHEMERIS_INVALID_DATE'));
  for (const s of ['2024-02-29T00:00:00Z', '2024-02-29T00:00:00.1Z', '2024-02-29T00:00:00.12Z', '2024-02-29T00:00:00.123Z']) assert.ok(Number.isSafeInteger(parseSolarUtc(s)));
  for (const s of ['2023-02-29T00:00:00Z', '2024-04-31T00:00:00Z', '2024-01-01T24:00:00Z', '2024-01-01T00:00:60Z', '2024-01-01T00:00:00.1234Z', '2024-01-01T00:00:00+00:00']) assert.throws(() => parseSolarUtc(s), code('EPHEMERIS_INVALID_DATE'));
});
test('synthetic software test only: aligned arrays, metadata, physical distances and derived radii', () => {
  validateSolarVectorDataset(fixture());
  for (const mutate of [
    (d: SolarVectorDataset) => { d.timesUtc.reverse(); },
    (d: SolarVectorDataset) => { d.timesUtc[1] = d.timesUtc[0]; },
    (d: SolarVectorDataset) => { d.sunDistanceKm.pop(); },
    (d: SolarVectorDataset) => { delete d.sunPositionMoonFixedKm[0]; },
    (d: SolarVectorDataset) => { d.sunDistanceKm[0] += 1; },
    (d: SolarVectorDataset) => { (d.sunDistanceKm as any)[0] = '150000000'; },
    (d: SolarVectorDataset) => { (d.sunAngularRadiusDeg as any)[0] = String(d.sunAngularRadiusDeg[0]); },
    (d: SolarVectorDataset) => { d.sunAngularRadiusDeg[0] = NaN; },
    (d: SolarVectorDataset) => { d.source.url = 'javascript:alert(1)'; },
    (d: SolarVectorDataset) => { d.source.kernelHashes['de421.bsp'] = 'forged'; },
    (d: SolarVectorDataset) => { delete d.source.kernelHashes['de421.bsp']; },
    (d: SolarVectorDataset) => { d.source.kernelHashes.extra = '0'.repeat(64); },
    (d: SolarVectorDataset) => { d.timesUtc = new Array(100001).fill(d.timesUtc[0]); },
    (d: SolarVectorDataset) => { d.sunAngularRadiusDeg[0] += 1e-9; },
    (d: SolarVectorDataset) => { d.sunPositionMoonFixedKm[0].x = Infinity; },
    (d: SolarVectorDataset) => { d.sunPositionMoonFixedKm[0].x = 129e6; },
    (d: SolarVectorDataset) => { d.sunPositionMoonFixedKm[0].x = 171e6; },
    (d: SolarVectorDataset) => { (d as any).dataKind = 'synthetic'; },
    (d: SolarVectorDataset) => { (d as any).extra = true; },
  ]) { const d = fixture(); mutate(d); assert.throws(() => validateSolarVectorDataset(d)); }
  for (const distance of [130e6, 170e6]) {
    const d = fixture(); d.sunPositionMoonFixedKm[0].x = distance; d.sunDistanceKm[0] = distance; d.sunAngularRadiusDeg[0] = angularRadiusDeg(SOLAR_RADIUS_KM, distance); validateSolarVectorDataset(d);
  }
  const wrong = fixture(); (wrong as any).frame = 'IAU_MOON'; assert.throws(() => validateSolarVectorDataset(wrong), code('EPHEMERIS_FRAME_MISMATCH'));
});
test('synthetic software test only: exact lookup, no interpolation and defensive copies', () => {
  const d = fixture(), lookup = createSolarVectorLookup(d);
  d.sunPositionMoonFixedKm[0].x = 0;
  const s = lookup('2024-02-29T00:00:00.000Z'); assert.equal(s.sunPositionMoonFixedKm.x, 150e6);
  s.sunPositionMoonFixedKm.x = 0; assert.equal(lookup(d.timesUtc[0]).sunPositionMoonFixedKm.x, 150e6);
  assert.throws(() => lookup('2024-02-29T00:00:00.500Z'), code('EPHEMERIS_MISSING_EPOCH'));
  assert.throws(() => lookup('2024-02-29T00:00:02Z'), code('EPHEMERIS_MISSING_EPOCH'));
  assert.throws(() => lookup('2024-02-29T00:00:03Z'), code('EPHEMERIS_OUT_OF_RANGE'));
});
test('synthetic software test only: known axis, exact pole and frame mismatch', () => {
  const s = createSolarVectorLookup(fixture())('2024-02-29T00:00:00Z');
  const observer = { latDeg: 0, lonDeg: 0, surfaceElevationM: 0, observerHeightM: 0 };
  const p = projectSolarVector(s, s.frame, observer);
  assert.equal(p.altitude, 90); assert.equal(p.distanceKm, 150e6 - 1737.4);
  assert.equal(p.distanceReference, 'TOPOCENTRIC'); assert.ok(p.angularRadiusDeg > p.moonCentreAngularRadiusDeg);
  assert.throws(() => projectSolarVector(s, 'IAU_MOON', observer), code('EPHEMERIS_FRAME_MISMATCH'));
  assert.throws(() => projectSolarVector(s, s.frame, { ...observer, observerHeightM: -1 }), code('EPHEMERIS_INVALID_OBSERVER'));
  assert.throws(() => projectSolarVector(s, s.frame, null as never), code('EPHEMERIS_INVALID_OBSERVER'));
  for (const latDeg of [-90, 90]) assert.throws(() => projectSolarVector(s, s.frame, { ...observer, latDeg }), code('EPHEMERIS_POLAR_AZIMUTH'));
});
test('synthetic software test only: independent ENU inverse roundtrip at southern sites', () => {
  for (const [latDeg, lonDeg] of [[-89.5, 40], [-85, -130], [-45, 170]]) {
    const lat = latDeg * Math.PI / 180, lon = lonDeg * Math.PI / 180;
    const up = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
    const north = [-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat)];
    const east = [-Math.sin(lon), Math.cos(lon), 0];
    const alt = 12 * Math.PI / 180, az = 237 * Math.PI / 180, distance = 150e6;
    const xyz = up.map((u, i) => 1737.4 * u + distance * (Math.sin(alt) * u + Math.cos(alt) * (Math.cos(az) * north[i] + Math.sin(az) * east[i])));
    const norm = Math.hypot(...xyz);
    const s = { timeUtc: '2024-02-29T00:00:00Z', frame: 'MOON_ME_DE421' as const, sunPositionMoonFixedKm: { x: xyz[0], y: xyz[1], z: xyz[2] }, sunDistanceKm: norm, sunAngularRadiusDeg: angularRadiusDeg(SOLAR_RADIUS_KM, norm) };
    const p = projectSolarVector(s, s.frame, { latDeg, lonDeg, surfaceElevationM: 0, observerHeightM: 0 });
    assert.ok(Math.abs(p.altitude - 12) < 1e-10); assert.ok(Math.abs(p.azimuth - 237) < 1e-10); assert.ok(Math.abs(p.distanceKm - distance) < 1e-7);
  }
});
