import test from 'node:test';
import assert from 'node:assert/strict';
import { solarVisibleFraction, computeVisibility } from '../src/features/visibility/visibility.mjs';

const horizon = {
  siteId: 'site-a', azimuthDeg: [0, 180], elevationDeg: [0, 0], model: 'flat',
  dataKind: 'synthetic', sourceIds: [], observerHeightM: 0, warnings: ['synthetic test horizon']
};
const sky = (overrides = {}) => ({
  scenarioId: 'scenario-a', timesUtc: ['2025-01-01T00:00:00Z'],
  sunAltDeg: [0], sunAzDeg: [359], earthAltDeg: [1], earthAzDeg: [1], sunRadiusDeg: [0.25],
  quality: { dataKind: 'synthetic', model: 'test-model', frame: 'local', warnings: ['synthetic sky'] },
  ...overrides
});
const options = { siteId: 'site-a', observerHeightM: 0, frame: 'local', horizonFrame: 'local' };

function snapshot(value) { return JSON.stringify(value); }

test('flat local-disk fraction is bounded, partial at the horizon and gives half at centerline', () => {
  assert.equal(solarVisibleFraction(90, 0, 0.25), 1);
  assert.equal(solarVisibleFraction(-90, 0, 0.25), 0);
  assert.equal(solarVisibleFraction(0, 0, 0.25), 0.5);
  const partial = solarVisibleFraction(0.1, 0, 0.25);
  assert.ok(partial > 0 && partial < 1);
  assert.throws(() => solarVisibleFraction(0, 0, 0));
});

test('validates solar radius even for empty series and rejects sparse arrays', () => {
  for (const radius of [0, -0.25]) assert.throws(() => computeVisibility(sky({ sunRadiusDeg: [radius] }), horizon, options), /positive/);
  const sparse = [];
  sparse.length = 1;
  assert.throws(() => computeVisibility(sky({ earthAltDeg: sparse }), horizon, options), /finite/);
  const sparseWarnings = [];
  sparseWarnings.length = 1;
  assert.throws(() => computeVisibility(sky({ quality: { ...sky().quality, warnings: sparseWarnings } }), horizon, options), /warning/);
  const empty = sky({ timesUtc: [], sunAltDeg: [], sunAzDeg: [], earthAltDeg: [], earthAzDeg: [], sunRadiusDeg: [] });
  assert.deepEqual(computeVisibility(empty, horizon, options).bothAvailable, []);
});

test('computes visibility with explicit frame contract and mandatory geometric-link warning', () => {
  const result = computeVisibility(sky(), horizon, options);
  assert.deepEqual(result.sunVisibleFraction, [0.5]);
  assert.deepEqual(result.earthVisible, [true]);
  assert.deepEqual(result.bothAvailable, [true]);
  assert.equal(result.quality.dataKind, 'synthetic');
  assert.equal(result.quality.earthRule, 'center');
  assert.ok(result.quality.warnings.includes('Geometric Earth visibility is not a communication-link guarantee.'));
  assert.ok(result.quality.warnings.includes('synthetic sky'));
  assert.ok(result.quality.warnings.includes('synthetic test horizon'));
});

test('rejects incompatible and malformed metadata, arrays, UTC and values', () => {
  assert.throws(() => computeVisibility(sky(), horizon, { ...options, siteId: 'other' }), /siteId/);
  assert.throws(() => computeVisibility(sky(), horizon, { ...options, observerHeightM: 2 }), /observerHeightM/);
  assert.throws(() => computeVisibility(sky(), horizon, { ...options, horizonFrame: 'body' }), /frame/);
  assert.throws(() => computeVisibility(sky({ scenarioId: '' }), horizon, options), /scenarioId/);
  assert.throws(() => computeVisibility(sky({ quality: { ...sky().quality, model: '' } }), horizon, options), /model/);
  assert.throws(() => computeVisibility(sky({ quality: { ...sky().quality, warnings: ['ok', 1] } }), horizon, options), /warning/);
  const sparseWarnings = [];
  sparseWarnings.length = 1;
  assert.throws(() => computeVisibility(sky({ quality: { ...sky().quality, warnings: sparseWarnings } }), horizon, options), /warning/);
  assert.throws(() => computeVisibility(sky({ sunAltDeg: [91] }), horizon, options), /altitude/);
  assert.throws(() => computeVisibility(sky({ sunAltDeg: [NaN] }), horizon, options), /finite/);
  assert.throws(() => computeVisibility(sky({ sunAzDeg: [] }), horizon, options), /length/);
  assert.throws(() => computeVisibility(sky({ timesUtc: ['2026-02-30T00:00:00Z'] }), horizon, options), /UTC/);
  assert.throws(() => computeVisibility(sky({ timesUtc: ['2025-01-01T00:00:01Z', '2025-01-01T00:00:00Z'], sunAltDeg: [0, 0], sunAzDeg: [0, 0], earthAltDeg: [0, 0], earthAzDeg: [0, 0], sunRadiusDeg: [0.25, 0.25] }), horizon, options), /strictly increasing/);
  assert.throws(() => computeVisibility(sky({ timesUtc: ['2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z'], sunAltDeg: [0, 0], sunAzDeg: [0, 0], earthAltDeg: [0, 0], earthAzDeg: [0, 0], sunRadiusDeg: [0.25, 0.25] }), horizon, options), /strictly increasing/);
  assert.throws(() => computeVisibility(sky(), { ...horizon, observerHeightM: -1 }, options), /horizon profile/);
  assert.throws(() => computeVisibility(sky(), horizon, { ...options, strictTerrain: 'yes' }), /strictTerrain/);
});

test('checks Earth center visibility strictly above, equal to, and below a nonzero terrain-plus-margin threshold', () => {
  const terrain = { ...horizon, model: 'terrain', elevationDeg: [1, 1], dataKind: 'synthetic', sourceIds: ['caller-source'] };
  const values = [3, 2, 1].map((earthAltDeg) => computeVisibility(sky({ earthAltDeg: [earthAltDeg] }), terrain, { ...options, marginDeg: 1 }).earthVisible[0]);
  assert.deepEqual(values, [true, false, false]);
});

test('integrated disk-area approximation agrees with independent horizontal-strip sampling', () => {
  const center = 0.01;
  const radius = 0.25;
  const strips = 200_000;
  let visible = 0;
  for (let i = 0; i < strips; i++) {
    const y = -radius + (i + 0.5) * (2 * radius / strips);
    if (y < -center) continue;
    visible += 2 * Math.sqrt(radius * radius - y * y) * (2 * radius / strips);
  }
  const numericalFraction = visible / (Math.PI * radius * radius);
  assert.ok(Math.abs(solarVisibleFraction(center, 0, radius) - numericalFraction) < 5e-4);
});

test('reports declared-provenance disclaimer and preserves all nine dataKind merge outcomes', () => {
  const kinds = ['real', 'synthetic', 'mixed'];
  for (const skyKind of kinds) {
    for (const horizonKind of kinds) {
      const terrain = { ...horizon, model: 'terrain', dataKind: horizonKind, sourceIds: ['caller-source'] };
      const result = computeVisibility(sky({ quality: { ...sky().quality, dataKind: skyKind } }), terrain, options);
      assert.equal(result.quality.dataKind, skyKind === horizonKind ? skyKind : 'mixed');
      assert.ok(result.quality.warnings.some((warning) => /caller-declared; source authenticity is not verified/i.test(warning)));
    }
  }
});

test('merges provenance and clearly labels flat-horizon assumption', () => {
  const result = computeVisibility(sky({ quality: { ...sky().quality, dataKind: 'real' } }), { ...horizon, warnings: [] }, options);
  assert.equal(result.quality.dataKind, 'mixed');
  assert.ok(result.quality.warnings.some((warning) => /flat horizon/i.test(warning)));
});

test('handles 359-to-0 horizon interpolation continuously', () => {
  const profile = { ...horizon, model: 'terrain', sourceIds: ['synthetic-ridge'], azimuthDeg: [1, 180, 359], elevationDeg: [0, 10, 0] };
  const at359 = computeVisibility(sky({ sunAzDeg: [359] }), profile, options).sunVisibleFraction[0];
  const at0 = computeVisibility(sky({ sunAzDeg: [0] }), profile, options).sunVisibleFraction[0];
  const at1 = computeVisibility(sky({ sunAzDeg: [1] }), profile, options).sunVisibleFraction[0];
  assert.equal(at359, at0);
  assert.equal(at0, at1);
  const asymmetric = { ...profile, azimuthDeg: [10, 180, 350], elevationDeg: [0.1, 0.1, 0] };
  const nearNorth = computeVisibility(sky({ sunAltDeg: [0.05], sunAzDeg: [359] }), asymmetric, options).sunVisibleFraction[0];
  const justPastNorth = computeVisibility(sky({ sunAltDeg: [0.05], sunAzDeg: [1] }), asymmetric, options).sunVisibleFraction[0];
  assert.notEqual(nearNorth, justPastNorth);
});

test('is deterministic and does not mutate input or output fractions beyond bounds', () => {
  const inputSky = sky({ sunAltDeg: [0.1] });
  const inputHorizon = { ...horizon, azimuthDeg: [...horizon.azimuthDeg], elevationDeg: [...horizon.elevationDeg], warnings: [...horizon.warnings] };
  const before = snapshot([inputSky, inputHorizon, options]);
  const first = computeVisibility(inputSky, inputHorizon, options);
  const second = computeVisibility(inputSky, inputHorizon, options);
  assert.deepEqual(first, second);
  assert.equal(snapshot([inputSky, inputHorizon, options]), before);
  assert.ok(first.sunVisibleFraction.every((fraction) => fraction >= 0 && fraction <= 1));
  first.timesUtc.push('extra');
  first.quality.warnings.push('mutated result');
  assert.equal(inputSky.timesUtc.length, 1);
  assert.deepEqual(inputSky.quality.warnings, ['synthetic sky']);
});
