import test from 'node:test';
import assert from 'node:assert/strict';
import { validateHorizonProfile, interpolateHorizon } from '../src/features/visibility/horizon.mjs';

const valid = {
  siteId: 'site-1', azimuthDeg: [0, 180], elevationDeg: [10, 30],
  model: 'terrain', dataKind: 'synthetic', sourceIds: ['fixture-synthetic-1'],
  observerHeightM: 2, warnings: [],
};

test('accepts a well-formed horizon profile', () => {
  assert.equal(validateHorizonProfile(valid), true);
});

test('rejects malformed profile values and metadata', () => {
  for (const patch of [
    { azimuthDeg: [0] }, { azimuthDeg: [0, 0] }, { azimuthDeg: [180, 0] },
    { azimuthDeg: [0, 360] }, { azimuthDeg: [0, NaN] },
    { elevationDeg: [0, 91] }, { elevationDeg: [0, -91] },
    { elevationDeg: [0] }, { elevationDeg: [0, Infinity] },
    { siteId: '' }, { model: 'other' }, { dataKind: 'unknown' },
    { sourceIds: [''] }, { observerHeightM: -1 }, { observerHeightM: NaN },
    { warnings: [3] },
    { azimuthDeg: [0, , 180], elevationDeg: [0, 1, 2] },
    { elevationDeg: [0, , 1] },
    { azimuthDeg: [0, 120, 240], elevationDeg: [0, , 1] },
    { model: 'flat', elevationDeg: [0, 1], dataKind: 'synthetic' },
    { model: 'flat', elevationDeg: [0, 0], dataKind: 'real' },
    { model: 'flat', elevationDeg: [0, 0], dataKind: 'mixed' },
    { model: 'terrain', sourceIds: [] },
  ]) assert.equal(validateHorizonProfile({ ...valid, ...patch }), false, JSON.stringify(patch));
});

test('interpolates across the circular 359-to-0 seam', () => {
  const profile = { ...valid, azimuthDeg: [1, 359], elevationDeg: [20, 0] };
  assert.equal(interpolateHorizon(profile, 0), 10);
  assert.equal(interpolateHorizon(profile, 360), 10);
});

test('interpolates an irregular grid linearly and returns exact knots', () => {
  const profile = { ...valid, azimuthDeg: [15, 80, 210, 330], elevationDeg: [2, 15, -11, 25] };
  assert.equal(interpolateHorizon(profile, 15), 2);
  assert.equal(interpolateHorizon(profile, 80), 15);
  assert.equal(interpolateHorizon(profile, 145), 2);
  assert.equal(interpolateHorizon(profile, 270), 7);
});

test('normalizes negative and over-360-degree queries across asymmetric seam boundaries', () => {
  const profile = { ...valid, azimuthDeg: [30, 120, 250], elevationDeg: [10, 40, -20] };
  assert.ok(Math.abs(interpolateHorizon(profile, 15) - 95 / 14) < 1e-12);
  assert.ok(Math.abs(interpolateHorizon(profile, 25) - 125 / 14) < 1e-12);
  assert.ok(Math.abs(interpolateHorizon(profile, 350) - 10 / 7) < 1e-12);
  assert.ok(Math.abs(interpolateHorizon(profile, -10) - 10 / 7) < 1e-12);
  assert.ok(Math.abs(interpolateHorizon(profile, 375) - 95 / 14) < 1e-12);
  assert.equal(interpolateHorizon(profile, 30), 10);
  assert.equal(interpolateHorizon(profile, 390), 10);
});

test('interpolates between samples and rejects invalid input', () => {
  assert.equal(interpolateHorizon(valid, 90), 20);
  assert.throws(() => interpolateHorizon(valid, NaN), TypeError);
  assert.throws(() => interpolateHorizon({ ...valid, azimuthDeg: [0] }, 0), TypeError);
});
