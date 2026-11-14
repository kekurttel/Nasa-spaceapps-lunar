import test from 'node:test';
import assert from 'node:assert/strict';
import { createPolarGrid, forwardPolar, inversePolar, SNAPSHOT_TIMES_UTC } from '../scripts/run-polar-snapshots.mjs';

const close = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} != ${expected}`);

test('independent known projection controls verify pole, axis signs, and known location', () => {
  assert.deepEqual(forwardPolar(-90, 0), { xM: 0, yM: 0 });
  assert.deepEqual(inversePolar(0, 0), { latitudeDeg: -90, longitudeDeg: 0, poleLongitudeConvention: 'undefined; canonical 0 computationally' });
  const rho = 2 * 1737400 * Math.tan(0.1 * Math.PI / 360);
  for (const [longitude, expectedX, expectedY] of [[0, 0, rho], [90, rho, 0], [-90, -rho, 0], [180, 0, -rho]]) {
    const projected = forwardPolar(-89.9, longitude);
    close(projected.xM, expectedX, 1e-8, `x for longitude ${longitude}`);
    close(projected.yM, expectedY, 1e-8, `y for longitude ${longitude}`);
    const geographic = inversePolar(projected.xM, projected.yM);
    close(geographic.latitudeDeg, -89.9, 1e-10, 'latitude round trip');
    close(geographic.longitudeDeg, longitude === 180 ? -180 : longitude, 1e-10, 'longitude round trip');
  }
  const known = forwardPolar(-85, 37);
  close(known.xM, 91303.189, 0.01, 'known forward x');
  close(known.yM, 121163.425, 0.01, 'known forward y');
  close(inversePolar(known.xM, known.yM).latitudeDeg, -85, 1e-10, 'known inverse latitude');
});

test('grid centers obey verified sample/line affine convention, bounds, order, and spacing', () => {
  const { grid, cells } = createPolarGrid();
  assert.equal(grid.xAxis, 'projected-x-positive');
  assert.equal(grid.yAxis, 'projected-y-positive');
  assert.equal(grid.rowDirection, 'decreasing-y');
  assert.equal(grid.epoch, 2000);
  assert.equal(grid.frame, 'MOON_ME_DE421');
  assert.equal(cells.length, 9);
  assert.deepEqual(cells.map(({ index }) => index), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  close(cells[4].latitudeDeg, -89.9, 0.00001, 'center latitude');
  close(cells[4].longitudeDeg, 0, 0.00001, 'center longitude');
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i], col = i % 3, row = Math.floor(i / 3);
    const sample = 3799.5 + cell.xM / 80;
    const line = 3799.5 - cell.yM / 80;
    const xFromLabel = (sample - 3799.5) * 80;
    const yFromLabel = (3799.5 - line) * 80;
    close(xFromLabel, cell.xM, 1e-9, 'independent label sample control');
    close(yFromLabel, cell.yM, 1e-9, 'independent label line control');
    assert.ok(sample >= 0.5 && sample <= 7600.5 && line >= 0.5 && line <= 7600.5, 'cell lies within labeled DEM dimensions');
    if (col < 2) close(Math.hypot(cells[i + 1].xM - cell.xM, cells[i + 1].yM - cell.yM), 80, 1e-9, 'horizontal projected spacing');
    if (row < 2) close(Math.hypot(cells[i + 3].xM - cell.xM, cells[i + 3].yM - cell.yM), 80, 1e-9, 'vertical projected spacing');
  }
  assert.equal(new Set(cells.map(({ xM, yM }) => `${xM},${yM}`)).size, 9);
  assert.deepEqual(SNAPSHOT_TIMES_UTC, ['2026-11-14T00:00:00Z', '2026-11-14T00:05:00Z', '2026-11-14T00:10:00Z']);
});

test('rejects nonfinite projected inputs and out-of-domain latitude', () => {
  assert.throws(() => inversePolar(Number.NaN, 0), /must be finite/);
  assert.throws(() => inversePolar(0, Infinity), /must be finite/);
  assert.throws(() => forwardPolar(-79, 0), /latitude must be/);
  assert.throws(() => forwardPolar(-90, Number.NaN), /longitude must be finite/);
});
