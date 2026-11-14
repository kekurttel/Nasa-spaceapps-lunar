import { createReadStream } from 'node:fs';
import { readFile, writeFile, mkdtemp, rm, mkdir, stat, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { loadTerrainHorizon } from '../src/features/visibility/terrain.mjs';
import { computeVisibility } from '../src/features/visibility/visibility.mjs';
import { validateRegistration, LOCAL_FRAME } from '../src/features/visibility/registration.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCT = 'LDEM_80S_80M';
const DEFAULT_MANIFEST = 'data/polar-lola-manifest.json';
const VERIFIED_RASTER_SHA256 = 'c088dd4f510e879375ee7e6f0d320ba84115f535f45fb592dd7f83a7d2e83ae3';
const VERIFIED_LABEL_SHA256 = '497512747bb56490d50cf3f4945f2cb736bf61cd19b65fa61a826825e2a35d79';

function strictUtc(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) return false;
  const date = new Date(Date.parse(value));
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(value);
  return Number.isFinite(date.getTime()) && date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() + 1 === Number(match[2]) && date.getUTCDate() === Number(match[3]) && date.getUTCHours() === Number(match[4]) && date.getUTCMinutes() === Number(match[5]) && date.getUTCSeconds() === Number(match[6]);
}
function normalizeLongitude(value) { return ((value + 180) % 360 + 360) % 360 - 180; }

export async function runPolarAnalysis(options = {}) {
  const siteId = options.siteId ?? 'Shackleton-reference-example';
  const latitudeDeg = options.latitudeDeg ?? -89.9;
  const longitudeDeg = normalizeLongitude(options.longitudeDeg ?? 0);
  const observerHeightM = options.observerHeightM ?? 2;
  const start = options.start ?? '2026-11-14T00:00:00Z';
  const count = options.count ?? 3;
  const stepMinutes = options.stepMinutes ?? 5;
  const azimuthStepDeg = options.azimuthStepDeg ?? 5;
  const distanceStepM = options.distanceStepM ?? 80;
  const maxDistanceM = options.maxDistanceM ?? 200000;
  if (typeof siteId !== 'string' || !siteId.trim() || !Number.isFinite(latitudeDeg) || latitudeDeg <= -90 || latitudeDeg > -80 || !Number.isFinite(longitudeDeg) || !Number.isFinite(observerHeightM) || observerHeightM < 0) throw new RangeError('Valid site, latitude in (-90, -80], longitude, and non-negative observer height required');
  if (!Number.isInteger(count) || count < 1 || count > 10000 || !Number.isFinite(stepMinutes) || stepMinutes <= 0 || !strictUtc(start)) throw new RangeError('Valid UTC start, count in [1, 10000], and positive step-minutes required');
  for (const [name, value] of [['azimuthStepDeg', azimuthStepDeg], ['distanceStepM', distanceStepM], ['maxDistanceM', maxDistanceM]]) if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be finite and positive`);
  const azimuthCount = 360 / azimuthStepDeg, distanceCount = Math.floor(maxDistanceM / distanceStepM);
  if (!Number.isInteger(azimuthCount) || azimuthCount < 2 || distanceCount < 1 || azimuthCount * distanceCount > 200000) throw new RangeError('Horizon ray workload exceeds supported limit or lacks full-circle coverage');
  if (count > 1 && stepMinutes * 60000 < 1) throw new RangeError('Sample interval must produce distinct UTC timestamps');
  const startMs = Date.parse(start), lastMs = startMs + (count - 1) * stepMinutes * 60000;
  if (!Number.isFinite(lastMs) || lastMs > 8.64e15) throw new RangeError('Generated UTC sample times exceed supported date range');
  const timesUtc = Array.from({ length: count }, (_, i) => new Date(startMs + i * stepMinutes * 60000).toISOString().replace(/\.000Z$/, 'Z'));
  const scenarioId = options.scenarioId ?? `polar-${siteId}`;
  if (typeof scenarioId !== 'string' || !scenarioId.trim()) throw new TypeError('scenarioId must be a nonempty string');
  const request = { scenarioId, siteId, latitudeDeg, longitudeDeg, observerHeightM, timesUtc, frame: LOCAL_FRAME };
  const manifestPath = resolve(ROOT, DEFAULT_MANIFEST);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const rasterPath = resolve(ROOT, 'data/raw/polar/LDEM_80S_80M.jp2');
  const labelPath = resolve(ROOT, 'data/raw/polar/LDEM_80S_80M.lbl');
  const [rasterHash, labelHash] = await Promise.all([sha256File(rasterPath), sha256File(labelPath)]);
  const rasterStat = await stat(rasterPath);
  const rasterBytes = rasterStat.size;
  const localVerification = manifest.local_verification;
  if (rasterHash !== VERIFIED_RASTER_SHA256 || labelHash !== VERIFIED_LABEL_SHA256 || rasterHash !== manifest.raster?.expected_sha256?.toLowerCase() || labelHash !== manifest.label?.sha256?.toLowerCase() || rasterBytes !== manifest.raster?.expected_bytes || rasterHash !== localVerification?.raster_sha256?.toLowerCase() || rasterBytes !== localVerification?.raster_bytes || labelHash !== localVerification?.label_sha256?.toLowerCase() || (await stat(labelPath)).size !== localVerification?.label_bytes) throw new TypeError('Local polar LOLA files do not match pinned source and manifest hashes and size');
  if (manifest.product !== PRODUCT || manifest.version !== 'V2.1' || manifest.dataset_id !== 'LRO-L-LOLA-4-GDR-V1.0' || manifest.raster?.url !== 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/jp2/ldem_80s_80m.jp2' || manifest.label?.url !== 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/jp2/ldem_80s_80m_jp2.lbl' || manifest.raster?.expected_bytes !== 29837992 || manifest.raster?.expected_sha256?.toLowerCase() !== VERIFIED_RASTER_SHA256 || manifest.label?.sha256?.toLowerCase() !== VERIFIED_LABEL_SHA256 || localVerification?.raster_path !== 'data/raw/polar/LDEM_80S_80M.jp2' || localVerification?.label_path !== 'data/raw/polar/LDEM_80S_80M.lbl') throw new TypeError(`Polar terrain manifest must verify trusted ${PRODUCT} V2.1 PDS image and label records`);
  const tempRoot = process.env.TMPDIR ?? (await access('/tmp/opencode').then(() => '/tmp/opencode', () => tmpdir()));
  await mkdir(tempRoot, { recursive: true });
  const temp = await mkdtemp(join(tempRoot, 'polar-analysis-'));
  try {
    const requestPath = join(temp, 'request.json'), horizonPath = join(temp, 'horizon.json'), skyPath = join(temp, 'sky.json');
    const terrainRequest = { siteId, latitudeDeg, longitudeDeg, observerHeightM, azimuthStepDeg, distanceStepM, maxDistanceM };
    await writeFile(requestPath, JSON.stringify(terrainRequest));
    const terrainStarted = performance.now();
    await runPython(options.python ?? 'python', [resolve(ROOT, 'scripts/polar-lola.py'), '--request', requestPath, '--output', horizonPath, '--image', rasterPath, '--label', labelPath], ROOT);
    const terrainMs = performance.now() - terrainStarted;
    const horizonDocument = JSON.parse(await readFile(horizonPath, 'utf8'));
    if (horizonDocument?.provenance?.synthetic !== false || horizonDocument?.profile?.dataKind !== 'real' || horizonDocument?.provenance?.product !== PRODUCT || !/^[a-f\d]{64}$/i.test(horizonDocument?.provenance?.sha256 ?? '') || !Number.isFinite(horizonDocument?.provenance?.surfaceHeightM)) throw new TypeError('Polar generator must return real LDEM_80S_80M terrain with SHA-256 and generated surfaceHeightM provenance');
    request.surfaceHeightM = horizonDocument.provenance.surfaceHeightM;
    request.terrainSha256 = horizonDocument.provenance.sha256.toLowerCase();
    const horizon = loadTerrainHorizon(horizonDocument, { siteId, observerHeightM, frame: LOCAL_FRAME, strictTerrain: true });
    const skyRequest = { ...request, kernelsDir: resolve(options.kernelDirectory ?? resolve(ROOT, 'data/kernels')) };
    await writeFile(requestPath, JSON.stringify(skyRequest));
    const skyStarted = performance.now();
    await runPython(options.python ?? 'python', [resolve(ROOT, 'src/features/visibility/registered-sky.py'), '--request', requestPath, '--output', skyPath], ROOT);
    const sky = JSON.parse(await readFile(skyPath, 'utf8'));
    const skyMs = performance.now() - skyStarted;
    const registrationValidation = await validateRegistration(sky, horizonDocument, request, { kernelDirectory: options.kernelDirectory });
    const visibility = computeVisibility(sky, horizon, { siteId, observerHeightM, frame: LOCAL_FRAME, horizonFrame: LOCAL_FRAME, strictTerrain: true });
    const result = { horizonDocument, sky, visibility, registrationValidation, performance: { terrainMs, skyMs, totalMs: terrainMs + skyMs } };
    const output = resolve(options.output ?? resolve(ROOT, 'output/polar-analysis.json'));
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
    return { result, output };
  } finally { await rm(temp, { recursive: true, force: true }); }
}

async function sha256File(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

function runPython(command, args, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    let settled = false;
    const timer = setTimeout(() => { child.kill(); finish(new Error('Python analysis timed out after 120000 ms')); }, 120000);
    function finish(error) { if (settled) return; settled = true; clearTimeout(timer); if (error) reject(error); else resolvePromise(); }
    child.once('error', finish);
    child.once('exit', (code) => finish(code === 0 ? undefined : new Error(`Python analysis exited with code ${code}`)));
  });
}
export function parseArgs(args) {
  const options = {};
  const flags = { '--site-id': 'siteId', '--lat': 'latitudeDeg', '--lon': 'longitudeDeg', '--height': 'observerHeightM', '--start': 'start', '--count': 'count', '--step-minutes': 'stepMinutes', '--azimuth-step': 'azimuthStepDeg', '--distance-step': 'distanceStepM', '--max-distance': 'maxDistanceM', '--output': 'output', '--python': 'python', '--kernels': 'kernelDirectory' };
  for (let i = 0; i < args.length; i++) {
    const key = flags[args[i]];
    if (!key) throw new Error(`Unknown option: ${args[i]}`);
    const flag = args[i], value = args[++i];
    if (value === undefined) throw new Error(`Missing value for ${flag}`);
    options[key] = ['latitudeDeg', 'longitudeDeg', 'observerHeightM', 'count', 'stepMinutes', 'azimuthStepDeg', 'distanceStepM', 'maxDistanceM'].includes(key) ? Number(value) : value;
    if (typeof options[key] === 'number' && !Number.isFinite(options[key])) throw new Error(`Invalid numeric value for ${flag}`);
  }
  return options;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { const { output } = await runPolarAnalysis(parseArgs(process.argv.slice(2))); console.log(`Wrote polar terrain and visibility analysis to ${output}`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
