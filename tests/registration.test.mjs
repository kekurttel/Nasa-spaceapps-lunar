import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadLolaDem, buildLolaHorizon } from '../src/features/visibility/lola.mjs';
import { buildRegisteredRequest, validateRegistration, BODY_FIXED_FRAME, LOCAL_FRAME } from '../src/features/visibility/registration.mjs';
import { runRegisteredAnalysis } from '../scripts/run-registered-analysis.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const execFileAsync = promisify(execFile);
const manifest = JSON.parse(await readFile(resolve(root, 'data/lola-manifest.json'), 'utf8'));
const dem = loadLolaDem(await readFile(resolve(root, manifest.files.image.path)), await readFile(resolve(root, manifest.files.label.path), 'utf8'));
const options = { scenarioId: 'scenario', siteId: 'site', latitudeDeg: -89.9, longitudeDeg: 360, observerHeightM: 2, timesUtc: ['2026-11-14T00:00:00Z'] };
const request = buildRegisteredRequest(dem, options);
const kernelDirectory = resolve(root, 'data/kernels');
const terrainOptions = { siteId: request.siteId, latitudeDeg: request.latitudeDeg, longitudeDeg: request.longitudeDeg, observerHeightM: request.observerHeightM, azimuthStepDeg: 30, distanceStepM: 2000, maxDistanceM: 4000 };
const document = buildLolaHorizon(dem, terrainOptions);
const kernelHashes = Object.fromEntries(JSON.parse(await readFile(join(kernelDirectory, 'manifest.json'), 'utf8')).files.map(({ fileName, sha256 }) => [fileName, sha256]));
async function generateSky(req = request) {
  const dir = await mkdtemp(join(tmpdir(), 'registered-sky-test-'));
  try {
    const requestPath = join(dir, 'request.json'), outputPath = join(dir, 'sky.json');
    await (await import('node:fs/promises')).writeFile(requestPath, JSON.stringify(req));
    await execFileAsync('python', [resolve(root, 'src/features/visibility/registered-sky.py'), '--request', requestPath, '--output', outputPath], { cwd: root, timeout: 120000 });
    return JSON.parse(await readFile(outputPath, 'utf8'));
  } finally { await rm(dir, { recursive: true, force: true }); }
}

test('registered request samples verified LOLA surface, normalizes longitude, and ignores supplied surface height', () => {
  const result = buildRegisteredRequest(dem, { ...options, surfaceHeightM: 12345 });
  assert.deepEqual(result, { ...request, longitudeDeg: 0 });
  assert.equal(Object.hasOwn(result, 'surfaceHeightM'), true);
  assert.notEqual(result.surfaceHeightM, 12345);
  assert.equal(buildRegisteredRequest(dem, { ...options, longitudeDeg: 270 }).longitudeDeg, -90);
});

test('registered request rejects invalid UTC calendar dates, non-UTC timestamps, and sparse time arrays', () => {
  for (const timesUtc of [['2026-02-30T00:00:00Z'], ['2026-01-01T00:00:00+00:00'], Array(1)]) assert.throws(() => buildRegisteredRequest(dem, { ...options, timesUtc }), /timesUtc/);
});

test('registered request rejects modified real DEM samples', () => {
  const changed = { ...dem, valuesKm: dem.valuesKm.slice() };
  changed.valuesKm[0] += 1;
  assert.throws(() => buildRegisteredRequest(changed, options), /modified|verified|DEM/i);
});

test('real Python generator registration validates against real terrain and verified kernel files', async () => {
  const sky = await generateSky();
  const validation = await validateRegistration(sky, document, request, { kernelDirectory });
  assert.equal(validation.valid, true);
  assert.ok(Object.values(validation.checks).every(Boolean));
  assert.equal(sky.registration.observerRadiusM, 1737400 + request.surfaceHeightM + request.observerHeightM);
});

test('each registered SkySeries field tamper is rejected', async () => {
  const sky = await generateSky();
  const cases = [
    ['siteId', s => { s.registration.siteId = 'other'; }], ['latitudeDeg', s => { s.registration.latitudeDeg += 0.01; }], ['longitudeDeg', s => { s.registration.longitudeDeg = 1; }],
    ['observerHeightM', s => { s.registration.observerHeightM += 0.01; }], ['surfaceHeightM', s => { s.registration.surfaceHeightM += 0.01; }],
    ['observerRadiusM', s => { s.registration.observerRadiusM = NaN; }], ['bodyFixedFrame', s => { s.registration.bodyFixedFrame = 'MOON'; }], ['localFrame', s => { s.registration.localFrame = 'OTHER'; }],
    ['quality frame', s => { s.quality.frame = 'OTHER'; }], ['timesUtc', s => { s.timesUtc = ['2026-11-14T00:05:00Z']; }], ['terrainSha256', s => { s.registration.terrainSha256 = '0'.repeat(64); }],
    ['aberrationCorrection', s => { s.registration.aberrationCorrection = 'LT'; }], ['kernelHashes', s => { s.registration.kernelHashes['de421.bsp'] = '0'.repeat(64); }], ['dataKind', s => { s.quality.dataKind = 'synthetic'; }]
  ];
  for (const [field, tamper] of cases) {
    const badSky = structuredClone(sky);
    tamper(badSky);
    await assert.rejects(validateRegistration(badSky, document, request, { kernelDirectory }), undefined, field);
  }
});

test('terrain document site, coordinates, observer height, frame, and terrain hash must match registration', async () => {
  for (const change of [d => { d.profile.siteId = 'other'; }, d => { d.profile.observerHeightM = 3; }, d => { d.coverage.siteId = 'other'; }, d => { d.coverage.latitudeDeg = -80; }, d => { d.coverage.longitudeDeg = 1; }, d => { d.coverage.observerHeightM = 3; }, d => { d.coverage.frame = 'OTHER'; }, d => { d.provenance.latitudeDeg = -80; }, d => { d.provenance.longitudeDeg = 1; }, d => { d.provenance.observerHeightM = 3; }, d => { d.provenance.sha256 = '0'.repeat(64); }]) {
    const badDocument = structuredClone(document);
    change(badDocument);
    await assert.rejects(validateRegistration(await generateSky(), badDocument, request, { kernelDirectory }));
  }
});

test('kernel hashes compare independent of JSON order and manifest rejects duplicate, extra, or path entries', async () => {
  const sky = await generateSky();
  sky.registration.kernelHashes = Object.fromEntries(Object.entries(kernelHashes).reverse());
  assert.equal((await validateRegistration(sky, document, request, { kernelDirectory })).valid, true);
  const temp = await mkdtemp(join(tmpdir(), 'kernel-manifest-'));
  try {
    const fs = await import('node:fs/promises');
    for (const file of await fs.readdir(kernelDirectory)) if (file !== 'manifest.json') await fs.copyFile(join(kernelDirectory, file), join(temp, file));
    const original = JSON.parse(await readFile(join(kernelDirectory, 'manifest.json'), 'utf8'));
    for (const files of [[...original.files, original.files[0]], [...original.files, { ...original.files[0], fileName: 'extra.bsp' }], original.files.map((entry, i) => i ? entry : { ...entry, fileName: '../de421.bsp' })]) {
      await fs.writeFile(join(temp, 'manifest.json'), JSON.stringify({ ...original, files }));
      await assert.rejects(validateRegistration(await generateSky(), document, request, { kernelDirectory: temp }), /kernel/i);
    }
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('runner executes real registered analysis using one normalized longitude and rejects invalid start dates', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'registered-analysis-test-'));
  try {
    const { result, output } = await runRegisteredAnalysis({ siteId: 'cli-registration', latitudeDeg: -89.9, longitudeDeg: 360, height: 2, count: 1, maxDistanceM: 4000, distanceStepM: 2000, azimuthStepDeg: 30, output: join(dir, 'result.json'), tempRoot: join(dir, 'runner-temp') });
    assert.deepEqual(await (await import('node:fs/promises')).readdir(join(dir, 'runner-temp')), []);
    assert.equal(result.registrationValidation.valid, true);
    assert.equal(result.horizonDocument.coverage.longitudeDeg, 0);
    assert.equal(result.sky.registration.longitudeDeg, 0);
    assert.ok(result.visibility.bothAvailable.length === 1);
    assert.equal(JSON.parse(await readFile(output, 'utf8')).registrationValidation.valid, true);
    await assert.rejects(runRegisteredAnalysis({ start: '2026-02-30T00:00:00Z', count: 1, output: join(dir, 'invalid.json') }), /UTC start/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
