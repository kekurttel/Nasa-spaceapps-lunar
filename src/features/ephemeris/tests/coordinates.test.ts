import test from 'node:test';
import assert from 'node:assert/strict';
import { angularRadiusDeg, localSkyDirection, LUNAR_REFERENCE_RADIUS_KM } from '../coordinates.ts';

test('observer-relative vector gives cardinal directions at lunar equator', () => {
  const r = LUNAR_REFERENCE_RADIUS_KM;
  const north = localSkyDirection({ x: r, y: 0, z: 1 }, 0, 0, 0, 0);
  assert.ok(Math.abs(north.altitude) < 1e-10);
  assert.ok(Math.abs(north.azimuth) < 1e-10);
  assert.ok(Math.abs(north.distanceKm - 1) < 1e-10);

  const east = localSkyDirection({ x: r, y: 1, z: 0 }, 0, 0, 0, 0);
  assert.ok(Math.abs(east.altitude) < 1e-10);
  assert.ok(Math.abs(east.azimuth - 90) < 1e-10);
  const up = localSkyDirection({ x: r + 1, y: 0, z: 0 }, 0, 0, 0, 0);
  assert.ok(Math.abs(up.altitude - 90) < 1e-10);
});

test('east-positive longitude and azimuth wrap are respected', () => {
  const r = LUNAR_REFERENCE_RADIUS_KM;
  const result = localSkyDirection({ x: 0, y: r + 1, z: 0 }, 0, 90, 0, 0);
  assert.ok(Math.abs(result.altitude - 90) < 1e-10);
  assert.ok(result.azimuth >= 0 && result.azimuth < 360);
});

test('1000 m observer height changes distance by exactly 1 km', () => {
  const r = LUNAR_REFERENCE_RADIUS_KM;
  const target = { x: r + 10, y: 0, z: 0 };
  const baseline = localSkyDirection(target, 0, 0, 0, 0);
  const elevated = localSkyDirection(target, 0, 0, 0, 1_000);
  assert.ok(Math.abs(baseline.distanceKm - 10) < 1e-10);
  assert.ok(Math.abs((baseline.distanceKm - elevated.distanceKm) - 1) < 1e-10);
  const belowReference = localSkyDirection(target, 0, 0, -1_000, 0);
  assert.ok(Math.abs(belowReference.distanceKm - 11) < 1e-10);
  assert.ok(Math.abs(angularRadiusDeg(1, 2) - 30) < 1e-12);
});

test('invalid inputs, zero direction and exact poles are explicit errors', () => {
  assert.throws(() => localSkyDirection({ x: 1, y: 0, z: 0 }, 90, 0, 0, 0), (error: any) => error.code === 'EPHEMERIS_POLAR_AZIMUTH');
  assert.throws(() => localSkyDirection({ x: NaN, y: 0, z: 0 }, 0, 0, 0, 0), (error: any) => error.code === 'EPHEMERIS_INVALID_VALUE');
  assert.throws(() => localSkyDirection({ x: LUNAR_REFERENCE_RADIUS_KM, y: 0, z: 0 }, 0, 0, 0, 0), (error: any) => error.code === 'EPHEMERIS_ZERO_DIRECTION');
  assert.throws(() => localSkyDirection({ x: 1, y: 0, z: 0 }, 0, 181, 0, 0), (error: any) => error.code === 'EPHEMERIS_LONGITUDE_RANGE');
  assert.throws(() => localSkyDirection({ x: 1, y: 0, z: 0 }, 0, 0, -1_738_000, 0), (error: any) => error.code === 'EPHEMERIS_OBSERVER_RADIUS');
  assert.throws(() => angularRadiusDeg(1, 0), (error: any) => error.code === 'EPHEMERIS_DISTANCE_RANGE');
});
