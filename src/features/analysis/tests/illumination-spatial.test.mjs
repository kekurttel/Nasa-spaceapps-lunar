import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeIlluminationSpatial } from '../illumination-spatial.mjs';

const grid = { width: 5, height: 1, crs: 'EPSG:32631', units: 'm', originXM: 100, originYM: 200, pixelSizeXM: 10, pixelSizeYM: 20 };
const time = (s) => new Date(Date.UTC(2026, 0, 1, 0, 0, s)).toISOString();
const frame = (start, end, fractions) => ({ startUtc: time(start), endUtc: time(end), fractions });
function run(frames, options = {}) {
  return analyzeIlluminationSpatial({ grid, frames, scenario: { startUtc: frames[0].startUtc, endUtc: frames.at(-1).endUtc }, ...options });
}

test('moving edge gives metric nearest geometry velocity, not physical tracking', () => {
  const result = run([frame(0, 10, [1, 1, 0, 0, 0]), frame(10, 20, [1, 1, 1, 0, 0])]);
  const transition = result.migration.transitions[0];
  const match = transition.matches[0];
  assert.equal(result.experimental, true);
  assert.match(result.method, /not tracked physical correspondence/);
  assert.equal(match.fromCell, 1);
  assert.equal(match.toCell, 2);
  assert.deepEqual(match.from, { index: 1, xM: 115, yM: 210 });
  assert.equal(match.displacementM, 10);
  assert.equal(match.velocityMps, 1);
  assert.equal(match.velocityKmh, 3.6);
  assert.equal(match.directionDegrees, 0);
  assert.deepEqual(result.variability.crossingsPerCell, [0, 0, 1, 0, 0]);
  assert.equal(result.variability.variableCells, 1);
  assert.equal(result.variability.stableLitCells, 2);
  assert.equal(result.variability.stableDarkCells, 2);
  assert.deepEqual(result.connectivity.persistent.components[0].cells, [0, 1]);
});

test('unchanged edge has zero speed, undefined direction; repeated crossings counted', () => {
  const a = [1, 1, 0, 0, 0], b = [1, 1, 1, 0, 0];
  const stable = run([frame(0, 10, a), frame(10, 20, a)]);
  assert.equal(stable.migration.transitions[0].matches[0].velocityMps, 0);
  assert.equal(stable.migration.transitions[0].matches[0].directionDegrees, null);
  const changing = run([frame(0, 10, a), frame(10, 20, b), frame(20, 30, a)]);
  assert.equal(changing.variability.crossingsPerCell[2], 2);
  assert.equal(changing.variability.repeatedCrossingCells, 1);
  assert.equal(changing.migration.transitions[1].matches[0].directionDegrees, 180);
});

test('gaps do not imply crossings, boundary motion, stable cells or persistent corridors', () => {
  const result = run([frame(0, 10, [1, 1, 0, 0, 0]), frame(20, 30, [1, 1, 1, 0, 0])]);
  assert.equal(result.completeTemporalCoverage, false);
  assert.equal(result.migration.transitions[0].status, 'gap');
  assert.deepEqual(result.migration.transitions[0].matches, []);
  assert.equal(result.variability.crossingsPerCell[2], 0);
  assert.equal(result.variability.unknownCells, 5);
  assert.equal(result.connectivity.persistent.components, null);
  const scenario = { startUtc: time(0), endUtc: time(30) };
  assert.equal(run([frame(10, 20, [1, 1, 1, 1, 1])], { scenario }).completeTemporalCoverage, false);
});

test('null excludes adjacent boundaries, remains unknown rather than dark', () => {
  const result = run([frame(0, 10, [1, 1, null, 0, 0]), frame(10, 20, [1, 1, 1, 0, 0])]);
  assert.equal(result.migration.transitions[0].matches.length, 0);
  assert.equal(result.variability.unknownCells, 1);
  assert.equal(result.variability.stableDarkCells, 2);
  assert.equal(result.variability.crossingsPerCell[2], 0);
  assert.equal(result.connectivity.frames[0].unknownCells, 1);
  assert.deepEqual(result.connectivity.persistent.components[0].cells, [0, 1]);
});

test('unknown barrier cannot be crossed by nearest boundary match', () => {
  const result = run([frame(0, 10, [1, 0, null, 1, 1]), frame(10, 20, [1, 1, null, 0, 1])]);
  assert.equal(result.migration.transitions[0].matches.length, 0);
});

test('connectivity is 4-neighbor, exact full illumination; diagonal islands stay separate', () => {
  const localGrid = { ...grid, width: 3, height: 3 };
  const fractions = [1, 0.5, null, 0, 1, 0, 1, 0, 1];
  const result = run([frame(0, 10, fractions)], { grid: localGrid });
  assert.equal(result.connectivity.frames[0].components.length, 4);
  assert.equal(result.connectivity.persistent.components.length, 4);
  assert.equal(result.connectivity.frames[0].components[0].areaM2, 200);
});

test('explicit interval, resolution, grid and fraction validation', () => {
  const valid = frame(0, 10, [1, 1, 0, 0, 0]);
  assert.throws(() => run([{ ...valid, pixelSizeXM: 11 }]), /resolution change/);
  assert.throws(() => run([{ ...valid, grid: { ...grid, width: 6 } }]), /resolution change/);
  for (const change of [{ crs: 'EPSG:4326' }, { crs: '' }, { units: 'degrees' }, { pixelSizeXM: 0 }, { pixelSizeYM: -1 }, { originXM: Infinity }, { width: 1.5 }]) {
    assert.throws(() => run([valid], { grid: { ...grid, ...change } }), TypeError);
  }
  assert.throws(() => run([{ ...valid, startUtc: '2026-02-30T00:00:00Z' }]), /valid UTC/);
  assert.throws(() => run([{ ...valid, endUtc: '2026-01-01T00:00:10+00:00' }]), /UTC/);
  assert.throws(() => run([{ ...valid, endUtc: undefined }]), /UTC/);
  assert.throws(() => run([valid, frame(5, 15, valid.fractions)]), /nonoverlapping/);
  assert.throws(() => run([{ ...valid, fractions: [1, undefined, 0, 0, 0] }]), /null or in/);
  assert.throws(() => run([{ ...valid, fractions: [1, 2, 0, 0, 0] }]), /null or in/);
  assert.throws(() => run([{ ...valid, fractions: [1] }]), /dimensions/);
});

test('global spatial search cap fails explicitly rather than silently approximating', () => {
  const localGrid = { ...grid, width: 3, height: 3 };
  const fractions = [1, 0, 1, 1, 0, 1, 1, 0, 1];
  assert.throws(() => run([frame(0, 10, fractions), frame(10, 20, fractions)], { grid: localGrid, maxComparisons: 1 }), /comparison cap exceeded/);
});
