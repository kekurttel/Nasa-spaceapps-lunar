import { readFile, writeFile, mkdtemp, rm, mkdir, access } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { loadLolaDem, buildLolaHorizon } from '../src/features/visibility/lola.mjs';
import { loadTerrainHorizon } from '../src/features/visibility/terrain.mjs';
import { computeVisibility } from '../src/features/visibility/visibility.mjs';
import { buildRegisteredRequest, validateRegistration, LOCAL_FRAME } from '../src/features/visibility/registration.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function strictUtc(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) return false;
  const date = new Date(Date.parse(value));
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(value);
  return Number.isFinite(date.getTime()) && date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() + 1 === Number(match[2]) && date.getUTCDate() === Number(match[3]) && date.getUTCHours() === Number(match[4]) && date.getUTCMinutes() === Number(match[5]) && date.getUTCSeconds() === Number(match[6]);
}
export async function runRegisteredAnalysis(options = {}) {
  const siteId = options.siteId ?? 'Shackleton-reference-example';
  const latitudeDeg = options.latitudeDeg ?? -89.9;
  const inputLongitudeDeg = options.longitudeDeg ?? 0;
  const longitudeDeg = ((inputLongitudeDeg + 180) % 360 + 360) % 360 - 180;
  const observerHeightM = options.height ?? 2;
  const start = options.start ?? '2026-11-14T00:00:00Z';
  const count = options.count ?? 3;
  const stepMinutes = options.stepMinutes ?? 5;
  if (!Number.isInteger(count) || count < 1 || count > 10000 || !Number.isFinite(stepMinutes) || stepMinutes <= 0 || !strictUtc(start)) throw new RangeError('Valid UTC start, count in [1, 10000], and positive step-minutes required');
  const startMs = Date.parse(start), lastMs = startMs + (count - 1) * stepMinutes * 60000;
  if (!Number.isFinite(lastMs) || lastMs > 8.64e15) throw new RangeError('Generated UTC sample times exceed supported date range');
  const timesUtc = Array.from({ length: count }, (_, i) => new Date(startMs + i * stepMinutes * 60000).toISOString().replace(/\.000Z$/, 'Z'));
  const manifest = JSON.parse(await readFile(resolve(ROOT, 'data/lola-manifest.json'), 'utf8'));
  const dem = loadLolaDem(await readFile(resolve(ROOT, manifest.files.image.path)), await readFile(resolve(ROOT, manifest.files.label.path), 'utf8'));
  const request = buildRegisteredRequest(dem, { scenarioId: options.scenarioId ?? `registered-${siteId}`, siteId, latitudeDeg, longitudeDeg, observerHeightM, timesUtc });
  const horizonDocument = buildLolaHorizon(dem, { siteId, latitudeDeg, longitudeDeg, observerHeightM, ...(options.azimuthStepDeg === undefined ? {} : { azimuthStepDeg: options.azimuthStepDeg }), ...(options.distanceStepM === undefined ? {} : { distanceStepM: options.distanceStepM }), ...(options.maxDistanceM === undefined ? {} : { maxDistanceM: options.maxDistanceM }) });
  const horizon = loadTerrainHorizon(horizonDocument, { siteId, observerHeightM, frame: LOCAL_FRAME, strictTerrain: true });
  const tempRoot = options.tempRoot ?? process.env.TMPDIR ?? await access('/tmp/opencode').then(() => '/tmp/opencode', () => tmpdir());
  await mkdir(tempRoot, { recursive: true });
  const temp = await mkdtemp(join(tempRoot, 'registered-analysis-'));
  try {
    const requestPath = join(temp, 'request.json'), skyPath = join(temp, 'sky.json');
    const pythonRequest = options.kernelDirectory ? { ...request, kernelsDir: resolve(options.kernelDirectory) } : request;
    await writeFile(requestPath, JSON.stringify(pythonRequest));
    await runPython(options.python ?? 'python', [resolve(ROOT, 'src/features/visibility/registered-sky.py'), '--request', requestPath, '--output', skyPath], ROOT);
    const sky = JSON.parse(await readFile(skyPath, 'utf8'));
    const registrationValidation = await validateRegistration(sky, horizonDocument, request, { kernelDirectory: options.kernelDirectory });
    const visibility = computeVisibility(sky, horizon, { siteId, observerHeightM, frame: LOCAL_FRAME, horizonFrame: LOCAL_FRAME, strictTerrain: true });
    const result = { horizonDocument, sky, visibility, registrationValidation };
    const output = resolve(options.output ?? resolve(ROOT, 'output/registered-analysis.json'));
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
    return { result, output };
  } finally { await rm(temp, { recursive: true, force: true }); }
}

function runPython(command, args, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' });
    let settled = false;
    const timer = setTimeout(() => {
      child.kill();
      finish(new Error('Python registered sky generator timed out after 120000 ms'));
    }, 120000);
    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolvePromise();
    }
    child.once('error', finish);
    child.once('exit', (code) => finish(code === 0 ? undefined : new Error(`Python registered sky generator exited with code ${code}`)));
  });
}
function parseArgs(args) {
  const options = {};
  const flags = { '--site-id': 'siteId', '--lat': 'latitudeDeg', '--lon': 'longitudeDeg', '--height': 'height', '--start': 'start', '--count': 'count', '--step-minutes': 'stepMinutes', '--output': 'output' };
  for (let i = 0; i < args.length; i++) {
    const key = flags[args[i]];
    if (!key) throw new Error(`Unknown option: ${args[i]}`);
    const value = args[++i];
    if (value === undefined) throw new Error(`Missing value for ${args[i - 1]}`);
    options[key] = ['latitudeDeg', 'longitudeDeg', 'height', 'count', 'stepMinutes'].includes(key) ? Number(value) : value;
    if (typeof options[key] === 'number' && !Number.isFinite(options[key])) throw new Error(`Invalid numeric value for ${args[i - 1]}`);
  }
  return options;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { const { output } = await runRegisteredAnalysis(parseArgs(process.argv.slice(2))); console.log(`Wrote registered terrain and visibility analysis to ${output}`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
