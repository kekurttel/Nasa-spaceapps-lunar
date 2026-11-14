import test from 'node:test';
import assert from 'node:assert/strict';
import { localSkyDirection } from '../coordinates.ts';

test('finite but overflowing target distances fail with a documented error instead of invalid success', () => {
  assert.throws(() => localSkyDirection({ x: Number.MAX_VALUE, y: Number.MAX_VALUE, z: Number.MAX_VALUE }, 0, 0, 0, 0),
    { code: 'EPHEMERIS_DISTANCE_RANGE' });
});

test('overflowing combined observer elevation is explicitly rejected', () => {
  assert.throws(() => localSkyDirection({ x: 150000000, y: 0, z: 0 }, 0, 0, Number.MAX_VALUE, Number.MAX_VALUE),
    { code: 'EPHEMERIS_OBSERVER_RADIUS' });
});
