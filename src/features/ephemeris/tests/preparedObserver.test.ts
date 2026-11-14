import test from 'node:test';
import assert from 'node:assert/strict';
import { localSkyDirection, angularRadiusDeg } from '../coordinates.ts';
import type { Vec3 } from '../coordinates.ts';
import { createLocalSkyProjector, createMoonFixedSampler, computeSkySeries } from '../index.ts';
import type { Scenario, MoonFixedDataset } from '../index.ts';

// Independent pre-refactor formula: preserve grouping, subtraction and wrap exactly.
function legacy(target: Vec3, latDeg: number, lonDeg: number, elevation: number, height: number) {
  const lat = latDeg * Math.PI / 180;
  const lon = lonDeg * Math.PI / 180;
  const radiusKm = 1737.4 + (elevation + height) / 1_000;
  const cosLat = Math.cos(lat);
  const observer = {
    x: radiusKm * cosLat * Math.cos(lon),
    y: radiusKm * cosLat * Math.sin(lon),
    z: radiusKm * Math.sin(lat),
  };
  const dx = target.x - observer.x;
  const dy = target.y - observer.y;
  const dz = target.z - observer.z;
  const distanceKm = Math.hypot(dx, dy, dz);
  const north = -Math.sin(lat) * Math.cos(lon) * dx
    - Math.sin(lat) * Math.sin(lon) * dy + Math.cos(lat) * dz;
  const east = -Math.sin(lon) * dx + Math.cos(lon) * dy;
  const up = cosLat * Math.cos(lon) * dx + cosLat * Math.sin(lon) * dy + Math.sin(lat) * dz;
  const horizontal = Math.hypot(north, east);
  const altitude = Math.atan2(up, horizontal) * 180 / Math.PI;
  const azimuth = ((Math.atan2(east, north) * 180 / Math.PI) % 360 + 360) % 360;
  return { altitude, azimuth, distanceKm };
}

test('1000 deterministic vectors/sites/heights match independent legacy formula exactly', () => {
  let seed = 0x12345678;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let i = 0; i < 1000; i++) {
    const lat = i % 5 === 0 ? (i % 2 ? -1 : 1) * 89.999999999 : random() * 179.99 - 89.995;
    const lon = i % 3 === 0 ? (i % 2 ? -180 : 180) : random() * 360 - 180;
    const elevation = random() * 20000 - 10000;
    const height = random() * 100000;
    const project = createLocalSkyProjector(lat, lon, elevation, height);
    for (const target of [
      { x: (random() - 0.5) * 3e8, y: (random() - 0.5) * 3e8, z: (random() - 0.5) * 3e8 },
      { x: 0, y: -0, z: 0 },
    ]) {
      const expected = legacy(target, lat, lon, elevation, height);
      assert.deepEqual(project(target), expected);
      assert.deepEqual(localSkyDirection(target, lat, lon, elevation, height), expected);
    }
  }
  const project = createLocalSkyProjector(0, 0, -1000, 2000);
  for (const target of [
    { x: 1738.4, y: 1e8, z: 0 }, // horizon
    { x: 1e8, y: 1e-9, z: 1e-9 }, // near zenith
    { x: -1e8, y: 1e-9, z: -1e-9 }, // near nadir
  ]) assert.deepEqual(project(target), legacy(target, 0, 0, -1000, 2000));
});

test('projector snapshots primitive site inputs and reads each target anew', () => {
  const site = { lat: 12, lon: -180, elevation: -2000, height: 30 };
  const project = createLocalSkyProjector(site.lat, site.lon, site.elevation, site.height);
  const target = { x: 3e8, y: 2e7, z: -1e6 };
  const expected = legacy(target, 12, -180, -2000, 30);
  Object.assign(site, { lat: 80, lon: 90, elevation: 1000, height: 10000 });
  assert.deepEqual(project(target), expected);
  target.y = -2e7;
  assert.deepEqual(project(target), legacy(target, 12, -180, -2000, 30));
});

test('invalid targets/sites retain coordinate codes and target-first wrapper precedence', () => {
  const target = { x: 1e8, y: 0, z: 0 };
  const project = createLocalSkyProjector(0, 0, 0, 0);
  for (const bad of [null, undefined, {}, { x: NaN, y: 0, z: 0 },
    { x: 0, y: Infinity, z: 0 }, { x: 0, y: 0, z: '0' }]) {
    assert.throws(() => project(bad as Vec3), { code: 'EPHEMERIS_INVALID_VALUE' });
    assert.throws(() => localSkyDirection(bad as Vec3, 91, 181, NaN, NaN), { code: 'EPHEMERIS_INVALID_VALUE' });
  }
  const cases: [number, number, number, number, string][] = [
    [NaN, 0, 0, 0, 'EPHEMERIS_INVALID_VALUE'],
    [0, Infinity, 0, 0, 'EPHEMERIS_INVALID_VALUE'],
    [0, 0, NaN, 0, 'EPHEMERIS_INVALID_VALUE'],
    [0, 0, 0, Infinity, 'EPHEMERIS_INVALID_VALUE'],
    [91, 0, 0, 0, 'EPHEMERIS_LATITUDE_RANGE'],
    [-91, 0, 0, 0, 'EPHEMERIS_LATITUDE_RANGE'],
    [0, 181, 0, 0, 'EPHEMERIS_LONGITUDE_RANGE'],
    [0, -181, 0, 0, 'EPHEMERIS_LONGITUDE_RANGE'],
    [90, 0, 0, 0, 'EPHEMERIS_POLAR_AZIMUTH'],
    [-90, 0, 0, 0, 'EPHEMERIS_POLAR_AZIMUTH'],
    [0, 0, -1737400, 0, 'EPHEMERIS_OBSERVER_RADIUS'],
    [0, 0, -1738000, 0, 'EPHEMERIS_OBSERVER_RADIUS'],
    [0, 0, Number.MAX_VALUE, Number.MAX_VALUE, 'EPHEMERIS_OBSERVER_RADIUS'],
  ];
  for (const [lat, lon, elevation, height, code] of cases) {
    assert.throws(() => createLocalSkyProjector(lat, lon, elevation, height), { code });
    assert.throws(() => localSkyDirection(target, lat, lon, elevation, height), { code });
  }
  assert.throws(() => project({ x: 1737.4, y: 0, z: 0 }), { code: 'EPHEMERIS_ZERO_DIRECTION' });
  assert.throws(() => project({ x: Number.MAX_VALUE, y: Number.MAX_VALUE, z: Number.MAX_VALUE }), { code: 'EPHEMERIS_DISTANCE_RANGE' });
  assert.throws(() => angularRadiusDeg(-1, 1), { code: 'EPHEMERIS_RADIUS_RANGE' });
  assert.throws(() => angularRadiusDeg(2, 1), { code: 'EPHEMERIS_RADIUS_RANGE' });
  assert.throws(() => angularRadiusDeg(1, 0), { code: 'EPHEMERIS_DISTANCE_RANGE' });
  assert.throws(() => angularRadiusDeg(NaN, 1), { code: 'EPHEMERIS_INVALID_VALUE' });
});

function inputs(): { scenario: Scenario; dataset: MoonFixedDataset } {
  const startUtc = '2026-01-01T00:00:00.000Z';
  const endUtc = '2026-01-01T00:02:00.000Z';
  return {
    scenario: { id: 'prepared', site: { id: 'site', name: 'Site', latDeg: 0, lonDeg: 0,
      surfaceElevationM: 0, observerHeightM: 0, kind: 'custom', sourceIds: [] },
      startUtc, endUtc, stepSeconds: 1 },
    dataset: { id: 'prepared', frame: 'IAU_MOON', source: 'Software test',
      sourceUrl: 'https://example.invalid/test', timeScale: 'UTC', corrections: 'geometric', dataKind: 'synthetic',
      samples: [startUtc, endUtc].map(timeUtc => ({ timeUtc,
        sunKm: { x: 1.5e8, y: 1e7, z: 1e6 }, earthKm: { x: 384400, y: 1000, z: 1000 } })) },
  };
}

test('sampler snapshots original dataset and primitive interpolation inputs', () => {
  const { dataset } = inputs();
  const sample = createMoonFixedSampler(dataset);
  const time = '2026-01-01T00:01:00.000Z';
  const expected = sample(time);
  dataset.samples[0].sunKm.x = 0;
  dataset.samples[1].earthKm.z = 0;
  dataset.samples[0].timeUtc = '2000-01-01T00:00:00.000Z';
  assert.deepEqual(sample(time), expected);
});

test('series preserves first sample out-of-coverage precedence over invalid combined radius', () => {
  const { scenario, dataset } = inputs();
  scenario.site.surfaceElevationM = Number.MAX_VALUE;
  scenario.site.observerHeightM = Number.MAX_VALUE;
  scenario.startUtc = '2025-12-31T23:59:59.000Z';
  assert.throws(() => computeSkySeries(scenario, dataset), { code: 'EPHEMERIS_OUT_OF_RANGE' });
  scenario.startUtc = dataset.samples[0].timeUtc;
  assert.throws(() => computeSkySeries(scenario, dataset), { code: 'EPHEMERIS_OBSERVER_RADIUS' });
});

test('series matches legacy arrays exactly and keeps projector local to each series', () => {
  for (const [lat, lon, elevation, height] of [[0, -180, -2000, 20], [89.999999, 180, -1000, 10000]]) {
    const { scenario, dataset } = inputs();
    Object.assign(scenario.site, { latDeg: lat, lonDeg: lon, surfaceElevationM: elevation, observerHeightM: height });
    const result = computeSkySeries(scenario, dataset);
    const sample = createMoonFixedSampler(dataset);
    result.timesUtc.forEach((time, i) => {
      const vectors = sample(time);
      const sun = legacy(vectors.sunKm, lat, lon, elevation, height);
      const earth = legacy(vectors.earthKm, lat, lon, elevation, height);
      assert.deepEqual([result.sunAltDeg[i], result.sunAzDeg[i], result.earthAltDeg[i], result.earthAzDeg[i], result.sunRadiusDeg[i]],
        [sun.altitude, sun.azimuth, earth.altitude, earth.azimuth, Math.asin(695700 / sun.distanceKm) * 180 / Math.PI]);
    });
  }
});

test('zenith/nadir warning threshold matches legacy altitude on both sides for either body', () => {
  const threshold = 89.999999;
  const warning = 'Azimuth is undefined at zenith/nadir; output uses the atan2 numerical convention, not a meaningful compass bearing.';
  for (const body of ['sunKm', 'earthKm'] as const) {
    for (const sign of [-1, 1]) {
      for (const offset of [-1e-10, 0, 1e-10]) {
        const { scenario, dataset } = inputs();
        const angle = sign * (threshold + offset) * Math.PI / 180;
        const distance = 1.5e8;
        const target = { x: 1737.4 + distance * Math.sin(angle), y: distance * Math.cos(angle), z: 0 };
        const expectedAltitude = legacy(target, 0, 0, 0, 0).altitude;
        const expectedWarning = Math.abs(expectedAltitude) > threshold;
        if (offset < 0) assert.equal(expectedWarning, false);
        if (offset > 0) assert.equal(expectedWarning, true);
        for (const sample of dataset.samples) sample[body] = { ...target };
        const result = computeSkySeries(scenario, dataset);
        const altitudes = body === 'sunKm' ? result.sunAltDeg : result.earthAltDeg;
        assert.ok(altitudes.every(altitude => Object.is(altitude, expectedAltitude)));
        assert.equal(result.quality.warnings.filter(w => w === warning).length, expectedWarning ? 1 : 0);
      }
    }
  }
});

test('many Sun-only and Earth-only zenith/nadir samples emit unchanged warning once', () => {
  const warning = 'Azimuth is undefined at zenith/nadir; output uses the atan2 numerical convention, not a meaningful compass bearing.';
  for (const body of ['sunKm', 'earthKm'] as const) {
    for (const sign of [-1, 1]) {
      const { scenario, dataset } = inputs();
      for (const sample of dataset.samples) sample[body] = { x: sign * 1.5e8, y: 0, z: 0 };
      const result = computeSkySeries(scenario, dataset);
      assert.equal(result.timesUtc.length, 121);
      assert.equal(result.quality.warnings.filter(w => w === warning).length, 1);
    }
  }
  const { scenario, dataset } = inputs();
  assert.ok(!computeSkySeries(scenario, dataset).quality.warnings.includes(warning));
});
