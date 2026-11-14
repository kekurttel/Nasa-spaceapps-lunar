import test from 'node:test';
import assert from 'node:assert/strict';
import { producePolarSnapshots, POLAR_SNAPSHOT_CONTRACT } from '../polar-snapshot.mjs';
import { analyzeIllumination } from '../illumination.mjs';

const timesUtc = ['2026-01-01T00:00:00Z', '2026-01-01T00:05:00Z', '2026-01-01T00:10:00Z'];
const grid = {
  width: 3, height: 3, units: 'm', crs: 'MOON_ME_DE421 projected local polar meters',
  frame: 'MOON_ME_DE421', epoch: 2026,
  originXM: 1000, originYM: 2000, originConvention: 'cell-corner',
  xAxis: 'projected-x-positive', yAxis: 'projected-y-positive', rowDirection: 'decreasing-y', pixelSizeXM: 80, pixelSizeYM: 80,
};
const cells = Array.from({ length: 9 }, (_, index) => ({
  index, xM: 1040 + (index % 3) * 80, yM: 1960 - Math.floor(index / 3) * 80,
}));
const quality = { dem: { source: 'mock-only' }, warnings: ['mock provenance warning'] };
function response(index, fractions = [index / 10, 0.5, 1]) {
  return {
    frame: grid.frame,
    sky: { frame: 'ME_DE421_LOCAL_NORTH_EAST', quality: { frame: 'ME_DE421_LOCAL_NORTH_EAST', warnings: [`sky-${index}`] }, timesUtc: [...timesUtc] },
    visibility: { timesUtc: [...timesUtc], sunVisibleFraction: fractions, quality: { warnings: [`visibility-${index}`] } },
    provenance: { siteId: `site-${index}`, horizon: { model: 'terrain' } },
  };
}

 test('evaluates each supplied site once, reuses three instants, emits row-major dense snapshots and provenance', async () => {
  const calls = [];
  const snapshot = await producePolarSnapshots({ grid, cells, timesUtc, quality, evaluateSite: async (request) => {
    calls.push(request);
    return response(request.cell.index);
  } });
  assert.equal(POLAR_SNAPSHOT_CONTRACT, snapshot.schemaVersion);
  assert.equal(calls.length, 9);
  assert.deepEqual(calls.map((call) => call.cell.index), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(calls.every((call) => call.timesUtc !== timesUtc && call.timesUtc.length === 3));
  assert.deepEqual(snapshot.frames.map((frame) => frame.timestampUtc), timesUtc);
  assert.deepEqual(snapshot.frames.map((frame) => frame.fractions), [
    cells.map((_, i) => i / 10), Array(9).fill(0.5), Array(9).fill(1),
  ]);
  assert.equal(snapshot.quality.evaluations[4].source.siteId, 'site-4');
  assert.ok(snapshot.quality.warnings.includes('mock provenance warning'));
  assert.ok(snapshot.quality.warnings.includes('sky-4'));
  assert.ok(snapshot.quality.warnings.includes('visibility-4'));
  assert.equal(snapshot.quality.timeSemantics, 'three-explicit-UTC-instants; snapshots only; no interval support');
  assert.equal(snapshot.startUtc, undefined);
  assert.equal(snapshot.frames[0].startUtc, undefined);
});

test('caps inputs at exactly nine cells and three explicit instants', async () => {
  await assert.rejects(producePolarSnapshots({ grid, cells: cells.slice(0, 8), timesUtc, quality, evaluateSite() {} }), /exactly 9/);
  await assert.rejects(producePolarSnapshots({ grid, cells, timesUtc: timesUtc.slice(0, 2), quality, evaluateSite() {} }), /exactly 3/);
});

test('preserves explicit NoData and fails closed on evaluator failures or malformed metadata', async () => {
  const snapshot = await producePolarSnapshots({ grid, cells, timesUtc, quality, evaluateSite: async ({ cell }) => cell.index === 3
    ? { status: 'NoData', frame: grid.frame, reason: 'DEM NoData', provenance: { source: 'mock-dem' }, warnings: ['DEM gap'] }
    : response(cell.index) });
  assert.deepEqual(snapshot.frames.map((frame) => frame.fractions[3]), [null, null, null]);
  assert.ok(snapshot.quality.warnings.includes('DEM gap'));
  await assert.rejects(producePolarSnapshots({ grid, cells, timesUtc, quality, evaluateSite: async () => { throw new Error('engine failed'); } }), /engine failed/);
  await assert.rejects(producePolarSnapshots({ grid, cells, timesUtc, quality, evaluateSite: async ({ cell }) => {
    const result = response(cell.index);
    if (cell.index === 0) result.visibility.timesUtc[1] = '2026-01-01T00:06:00Z';
    return result;
  } }), /visibility times mismatch/);
  await assert.rejects(producePolarSnapshots({ grid, cells, timesUtc, quality, evaluateSite: async ({ cell }) => response(cell.index, [0, 1.1, 0]) }), /must be finite and in \[0, 1\]/);
});

test('requires explicit projected cell coordinates and MOON_ME_DE421 grid frame', async () => {
  await assert.rejects(producePolarSnapshots({ grid: { ...grid, frame: 'ME_DE421_LOCAL_NORTH_EAST' }, cells, timesUtc, quality, evaluateSite() {} }), /grid.frame must be MOON_ME_DE421/);
  const missingCoordinate = cells.map((cell) => ({ ...cell }));
  delete missingCoordinate[0].xM;
  await assert.rejects(producePolarSnapshots({ grid, cells: missingCoordinate, timesUtc, quality, evaluateSite() {} }), /coordinates must match/);
  const shifted = cells.map((cell) => ({ ...cell }));
  shifted[0].xM += 1;
  await assert.rejects(producePolarSnapshots({ grid, cells: shifted, timesUtc, quality, evaluateSite() {} }), /coordinates must match/);
  const sparseTimes = [...timesUtc];
  delete sparseTimes[1];
  await assert.rejects(producePolarSnapshots({ grid, cells, timesUtc: sparseTimes, quality, evaluateSite() {} }), /timesUtc\[1\] must be present/);
  await assert.rejects(producePolarSnapshots({ grid, cells, timesUtc, quality, evaluateSite: async ({ cell }) => {
    const result = response(cell.index);
    if (cell.index === 0) result.sky.frame = 'an-arbitrary-matching-frame';
    return result;
  } }), /sky frame metadata mismatch/);
  await assert.rejects(producePolarSnapshots({ grid, cells, timesUtc, quality, evaluateSite: async ({ cell }) => {
    const result = response(cell.index);
    if (cell.index === 0) result.provenance = {};
    return result;
  } }), /requires provenance/);
  await assert.rejects(producePolarSnapshots({ grid, cells, timesUtc, quality, evaluateSite: async ({ cell }) => cell.index === 0
    ? { status: 'NoData', frame: grid.frame, reason: 'DEM gap', provenance: {} }
    : response(cell.index) }), /NoData evaluation.*requires reason and provenance/);
});

test('snapshot is not accepted by interval analyzer as duration evidence', async () => {
  const snapshot = await producePolarSnapshots({ grid, cells, timesUtc, quality, evaluateSite: async ({ cell }) => response(cell.index) });
  assert.throws(() => analyzeIllumination(snapshot), /Unsupported illumination contract version/);
});
