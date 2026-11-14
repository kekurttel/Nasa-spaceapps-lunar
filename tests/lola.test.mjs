import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildLolaHorizon, loadLolaDem, sampleLolaHeightM } from '../src/features/visibility/lola.mjs';

const dir = new URL('../data/raw/', import.meta.url);
const label = await readFile(new URL('lola_ldem_4_float.lbl', dir), 'utf8');
const image = await readFile(new URL('lola_ldem_4_float.img', dir));
const synthetic = (value) => ({ width: 1440, height: 720, radiusM: 1_737_400, valuesKm: new Float32Array(720 * 1440).fill(value), synthetic: true });

test('loads actual labeled LDEM float image and interpolates pixel centers', () => {
  const dem = loadLolaDem(image, label);
  assert.equal(dem.valuesKm.length, 720 * 1440);
  assert.equal(dem.product, 'LDEM_4_FLOAT');
  assert.ok(Math.abs(sampleLolaHeightM(dem, 89.875, 0.125) - (-119.755)) < 0.01);
  assert.equal(sampleLolaHeightM(dem, 89.875, 360.125), sampleLolaHeightM(dem, 89.875, 0.125));
  assert.equal(dem.sha256, '6eaee9376442dc851b8f8e94790499ec339d923367d7b8608a4316088b85bd45');
});

test('rejects wrong size, unsupported labels, and non-finite samples', () => {
  assert.throws(() => loadLolaDem(image.subarray(1), label), /bytes/i);
  assert.throws(() => loadLolaDem(image, label.replace('LDEM_4_FLOAT', 'OTHER')));
  const damaged = Buffer.from(image);
  damaged.writeFloatLE(Number.NaN, 100);
  assert.notDeepEqual(damaged, image);
  assert.throws(() => loadLolaDem(damaged, label), /finite|invalid/i);
});

test('rejects out-of-range latitude instead of silently clamping it', () => {
  const dem = loadLolaDem(image, label);
  assert.throws(() => sampleLolaHeightM(dem, 91, 10), /latitude/i);
  assert.throws(() => sampleLolaHeightM(dem, -91, 10), /latitude/i);
});

test('samples periodic longitude, clamps at poles, and rejects invalid coordinates', () => {
  const dem = loadLolaDem(image, label);
  assert.equal(sampleLolaHeightM(dem, 90, 10), sampleLolaHeightM(dem, 89.875, 10));
  assert.equal(sampleLolaHeightM(dem, -90, 10), sampleLolaHeightM(dem, -89.875, 10));
  assert.throws(() => sampleLolaHeightM(dem, NaN, 0));
  assert.throws(() => sampleLolaHeightM(dem, 0, Infinity));
});

test('rejects mutated loaded DEM before producing a real horizon', () => {
  const dem = loadLolaDem(image, label);
  const original = dem.valuesKm[10];
  dem.valuesKm[10] = original + 0.001;
  assert.notEqual(dem.valuesKm[10], original);
  assert.throws(() => buildLolaHorizon(dem, { siteId: 's', latitudeDeg: 0, longitudeDeg: 0, observerHeightM: 0 }), /modified|integrity|authentic/i);
});

test('rejects plausible modified image and modified georeference label', () => {
  const modified = Buffer.from(image);
  const original = modified.readFloatLE(100);
  modified.writeFloatLE(original + 0.001, 100);
  assert.notDeepEqual(modified, image);
  assert.throws(() => loadLolaDem(modified, label), /SHA-256|hash|authentic/i);
  const changedLabel = label.replace(/WESTERNMOST_LONGITUDE\s*=\s*0/, 'WESTERNMOST_LONGITUDE = 1');
  assert.notEqual(changedLabel, label);
  assert.throws(() => loadLolaDem(image, changedLabel), /hash|longitude|label/i);
});

test('rejects hand-built unmarked DEM rather than labeling it real', () => {
  assert.throws(() => buildLolaHorizon({ ...synthetic(0), synthetic: undefined }, { siteId: 's', latitudeDeg: 0, longitudeDeg: 0, observerHeightM: 0 }), /loaded|synthetic/i);
});

test('builds negative curvature horizon for constant-radius sphere with real profile metadata', () => {
  const doc = buildLolaHorizon(synthetic(0), { siteId: 's', latitudeDeg: 0, longitudeDeg: 0, observerHeightM: 0, azimuthStepDeg: 90, distanceStepM: 2000, maxDistanceM: 20000 });
  assert.deepEqual(doc.profile.azimuthDeg, [0, 90, 180, 270]);
  const expected = Math.atan2(1_737_400 * Math.cos(2000 / 1_737_400) - 1_737_400, 1_737_400 * Math.sin(2000 / 1_737_400)) * 180 / Math.PI;
  assert.ok(doc.profile.elevationDeg.every(angle => Math.abs(angle - expected) < 1e-8), JSON.stringify(doc.profile.elevationDeg));
  assert.equal(doc.profile.dataKind, 'synthetic');
  assert.equal(doc.sources[0].url, 'https://example.invalid/synthetic-grid');
  assert.equal(doc.provenance.product, 'synthetic-grid-test-data');
  assert.equal(doc.coverage.frame, 'ME_DE421_LOCAL_NORTH_EAST');
  assert.equal(doc.coverage.azimuthCoverage, 'full-circle');
  assert.ok(doc.profile.warnings.some(warning => /7\.58|coarse/i.test(warning)));
  assert.ok(doc.profile.elevationDeg.every(Number.isFinite));
});

test('warns when site or ray samples enter the polar edge row', () => {
  const dem = loadLolaDem(image, label);
  const doc = buildLolaHorizon(dem, { siteId: 'polar', latitudeDeg: -89.9, longitudeDeg: 0, observerHeightM: 0, azimuthStepDeg: 90, distanceStepM: 2000, maxDistanceM: 10000 });
  assert.ok(doc.profile.warnings.some(warning => /polar cap.*nearest latitude row.*artificial slopes/i.test(warning)));
});

test('rejects empty range and one-bearing horizon grids', () => {
  const dem = synthetic(0);
  assert.throws(() => buildLolaHorizon(dem, { siteId: 's', latitudeDeg: 0, longitudeDeg: 0, observerHeightM: 0, distanceStepM: 20000, maxDistanceM: 10000 }), /distance|bounds|range|step/i);
  assert.throws(() => buildLolaHorizon(dem, { siteId: 's', latitudeDeg: 0, longitudeDeg: 0, observerHeightM: 0, azimuthStepDeg: 360 }), /azimuth|step/i);
});

test('records actual last radial sample when maximum is not a step multiple', () => {
  const doc = buildLolaHorizon(synthetic(0), { siteId: 's', latitudeDeg: 0, longitudeDeg: 0, observerHeightM: 0, azimuthStepDeg: 180, distanceStepM: 2000, maxDistanceM: 4500 });
  assert.equal(doc.coverage.maximumDistanceM, 4000);
  assert.equal(doc.provenance.maximumDistanceM, 4000);
});

test('samples a synthetic elevated ridge into a horizon and validates build bounds', () => {
  const dem = synthetic(0);
  dem.valuesKm[360 * 1440 + 2] = 1;
  const doc = buildLolaHorizon(dem, { siteId: 'ridge', latitudeDeg: 0, longitudeDeg: 0.125, observerHeightM: 0, azimuthStepDeg: 90, distanceStepM: 2000, maxDistanceM: 10000 });
  assert.ok(doc.profile.elevationDeg[1] > doc.profile.elevationDeg[0]);
  assert.throws(() => buildLolaHorizon(dem, { siteId: 's', latitudeDeg: 0, longitudeDeg: 0, observerHeightM: 0, maxDistanceM: 600000 }), /distance|500|range/i);
  assert.throws(() => buildLolaHorizon(dem, { siteId: 's', latitudeDeg: 91, longitudeDeg: 0, observerHeightM: 0 }));
});
