import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCompatibleTerrain, computationPolicy, TerrainCompatibilityError } from '../integrationPolicy.ts';

const compatible = () => ({
  frame: 'IAU_MOON',
  referenceRadiusM: 1737400,
  heightReference: 'radial-above-reference-sphere',
  dataKind: 'real' as const,
});

test('rejects ME terrain without relabeling or conversion', () => {
  const terrain = { ...compatible(), frame: 'MOON_ME' };
  const original = structuredClone(terrain);
  assert.throws(() => assertCompatibleTerrain('IAU_MOON', terrain), (error: unknown) =>
    error instanceof TerrainCompatibilityError && error.code === 'EPHEMERIS_FRAME_MISMATCH');
  assert.deepEqual(terrain, original);
});

test('rejects incompatible terrain height reference', () => {
  assert.throws(() => assertCompatibleTerrain('IAU_MOON', { ...compatible(), heightReference: 'ellipsoidal' }),
    (error: unknown) => error instanceof TerrainCompatibilityError && error.code === 'HEIGHT_REFERENCE_MISMATCH');
});

test('accepts exact supported terrain metadata without mutating source', () => {
  const terrain = compatible();
  const original = structuredClone(terrain);
  assert.equal(assertCompatibleTerrain('IAU_MOON', terrain), undefined);
  assert.deepEqual(terrain, original);
});

test('invalid metadata, synthetic terrain and mismatched radius fail explicitly', () => {
  assert.throws(() => assertCompatibleTerrain('IAU_MOON', null as never), { code: 'EPHEMERIS_INVALID_METADATA' });
  assert.throws(() => assertCompatibleTerrain('IAU_MOON', { ...compatible(), dataKind: 'synthetic' }), { code: 'EPHEMERIS_INVALID_METADATA' });
  assert.throws(() => assertCompatibleTerrain('IAU_MOON', { ...compatible(), referenceRadiusM: 1738000 }), { code: 'HEIGHT_REFERENCE_MISMATCH' });
  assert.throws(() => assertCompatibleTerrain('MOON_ME', compatible()), { code: 'EPHEMERIS_FRAME_MISMATCH' });
});

test('policy is frozen and flat horizon is local tangent plane, not terrain', () => {
  assert.equal(Object.isFrozen(computationPolicy), true);
  assert.equal(computationPolicy.syntheticFallback, false);
  assert.equal(computationPolicy.defaultHorizon, 'flat');
  assert.match(computationPolicy.supportedTerrain.geometry, /geometric/);
});
