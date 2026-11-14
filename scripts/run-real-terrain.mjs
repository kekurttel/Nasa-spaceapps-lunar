import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadLolaDem, buildLolaHorizon } from '../src/features/visibility/lola.mjs';
import { loadTerrainHorizon } from '../src/features/visibility/terrain.mjs';
import { computeVisibility } from '../src/features/visibility/visibility.mjs';

export const DEFAULT_FRAME = 'ME_DE421_LOCAL_NORTH_EAST';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function runRealTerrain(options = {}) {
  const siteId = options.siteId ?? 'Shackleton-reference-example';
  const latitudeDeg = options.latitudeDeg ?? -89.9;
  const longitudeDeg = options.longitudeDeg ?? 0;
  const observerHeightM = options.height ?? 2;
  const output = resolve(options.output ?? resolve(ROOT, 'output/real-terrain.json'));
  const frame = options.frame ?? DEFAULT_FRAME;
  if (frame !== DEFAULT_FRAME) throw new RangeError(`LOLA terrain frame is fixed to ${DEFAULT_FRAME}`);
  if (!Number.isFinite(latitudeDeg) || latitudeDeg < -90 || latitudeDeg > 90) throw new RangeError('Latitude must be finite and in [-90, 90]');
  if (!Number.isFinite(longitudeDeg) || !Number.isFinite(observerHeightM) || observerHeightM < 0) throw new RangeError('Longitude and non-negative observer height must be finite');
  const manifest = JSON.parse(await readFile(resolve(ROOT, 'data/lola-manifest.json'), 'utf8'));
  const imageBytes = await readFile(resolve(ROOT, manifest.files.image.path));
  const labelText = await readFile(resolve(ROOT, manifest.files.label.path), 'utf8');
  const dem = loadLolaDem(imageBytes, labelText);
  const document = buildLolaHorizon(dem, { ...terrainOptions(options), siteId, latitudeDeg, longitudeDeg, observerHeightM });
  const profile = loadTerrainHorizon(document, { siteId, observerHeightM, frame, strictTerrain: true });
  let result = document;
  if (options.sky) {
    const sky = JSON.parse(await readFile(resolve(options.sky), 'utf8'));
    if (sky.quality?.frame !== frame) throw new RangeError(`SkySeries frame must be ${frame}`);
    if (sky.quality?.dataKind === 'real') throw new Error('Refusing real SkySeries without verifiable site and frame provenance; provide synthetic/mixed data only for integration testing.');
    result = { ...document, visibility: computeVisibility(sky, profile, { siteId, observerHeightM, frame, horizonFrame: frame, strictTerrain: true }) };
  }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
  return { result, output };
}

function terrainOptions(options) {
  return {
    ...(options.azimuthStepDeg === undefined ? {} : { azimuthStepDeg: options.azimuthStepDeg }),
    ...(options.distanceStepM === undefined ? {} : { distanceStepM: options.distanceStepM }),
    ...(options.maxDistanceM === undefined ? {} : { maxDistanceM: options.maxDistanceM })
  };
}

function parseArgs(args) {
  const options = {};
  const flags = { '--site-id': 'siteId', '--lat': 'latitudeDeg', '--lon': 'longitudeDeg', '--height': 'height', '--output': 'output', '--sky': 'sky', '--max-distance': 'maxDistanceM', '--azimuth-step': 'azimuthStepDeg', '--distance-step': 'distanceStepM' };
  for (let i = 0; i < args.length; i++) {
    const key = flags[args[i]];
    if (!key) throw new Error(`Unknown option: ${args[i]}`);
    const value = args[++i];
    if (value === undefined) throw new Error(`Missing value for ${args[i - 1]}`);
    options[key] = ['latitudeDeg', 'longitudeDeg', 'height', 'maxDistanceM', 'azimuthStepDeg', 'distanceStepM'].includes(key) ? Number(value) : value;
    if (typeof options[key] === 'number' && !Number.isFinite(options[key])) throw new Error(`Invalid numeric value for ${args[i - 1]}`);
  }
  return options;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const { result, output } = await runRealTerrain(parseArgs(process.argv.slice(2)));
    console.log(`Wrote ${result.visibility ? 'terrain plus supplied-SkySeries visibility' : 'terrain-only horizon (no SkySeries supplied)'} to ${output}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
