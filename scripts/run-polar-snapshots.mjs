import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { producePolarSnapshots } from '../src/features/analysis/polar-snapshot.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RADIUS_M = 1737400;
export const SNAPSHOT_TIMES_UTC = Object.freeze([
  '2026-11-14T00:00:00Z', '2026-11-14T00:05:00Z', '2026-11-14T00:10:00Z',
]);

export function forwardPolar(latitudeDeg, longitudeDeg) {
  if (!Number.isFinite(latitudeDeg) || latitudeDeg < -90 || latitudeDeg > -80 || !Number.isFinite(longitudeDeg)) {
    throw new RangeError('latitude must be in [-90, -80] and longitude must be finite');
  }
  const rho = 2 * RADIUS_M * Math.tan(((90 + latitudeDeg) * Math.PI / 180) / 2);
  const longitude = longitudeDeg * Math.PI / 180;
  return { xM: rho * Math.sin(longitude), yM: rho * Math.cos(longitude) };
}

export function inversePolar(xM, yM) {
  if (!Number.isFinite(xM) || !Number.isFinite(yM)) throw new TypeError('projected coordinates must be finite');
  const rho = Math.hypot(xM, yM);
  if (rho === 0) return { latitudeDeg: -90, longitudeDeg: 0, poleLongitudeConvention: 'undefined; canonical 0 computationally' };
  let longitudeDeg = Math.atan2(xM, yM) * 180 / Math.PI;
  if (longitudeDeg >= 180) longitudeDeg -= 360;
  return { latitudeDeg: -90 + 2 * Math.atan(rho / (2 * RADIUS_M)) * 180 / Math.PI, longitudeDeg };
}

export function createPolarGrid() {
  const center = forwardPolar(-89.9, 0);
  const grid = {
    width: 3, height: 3, units: 'm',
    crs: 'Polar stereographic (spherical); Moon radius 1737400 m; south pole; standard parallel -90 degrees; central longitude 0 degrees',
    frame: 'MOON_ME_DE421', epoch: 2000,
    originXM: center.xM - 120, originYM: center.yM + 120,
    originConvention: 'cell-corner', xAxis: 'projected-x-positive', yAxis: 'projected-y-positive',
    rowDirection: 'decreasing-y', pixelSizeXM: 80, pixelSizeYM: 80,
  };
  const cells = Array.from({ length: 9 }, (_, index) => {
    const xM = grid.originXM + (index % 3 + 0.5) * 80;
    const yM = grid.originYM - (Math.floor(index / 3) + 0.5) * 80;
    return { index, xM, yM, ...inversePolar(xM, yM) };
  });
  return { grid, cells };
}

export async function runPolarSnapshots(options = {}) {
  const labelPath = resolve(ROOT, 'data/raw/polar/LDEM_80S_80M.lbl');
  const label = await readFile(labelPath, 'utf8');
  const required = [
    ['MAP_PROJECTION_TYPE', /MAP_PROJECTION_TYPE\s*=\s*"POLAR STEREOGRAPHIC"/],
    ['KEYWORD_LATITUDE_TYPE', /KEYWORD_LATITUDE_TYPE\s*=\s*"PLANETOCENTRIC"/],
    ['A_AXIS_RADIUS', /A_AXIS_RADIUS\s*=\s*1737\.4\s*<km>/],
    ['CENTER_LATITUDE', /CENTER_LATITUDE\s*=\s*-90\s*<deg>/],
    ['CENTER_LONGITUDE', /CENTER_LONGITUDE\s*=\s*0\s*<deg>/],
    ['MAP_SCALE', /MAP_SCALE\s*=\s*80\s*<m\/pix>/],
    ['COORDINATE_SYSTEM_NAME', /COORDINATE_SYSTEM_NAME\s*=\s*"MEAN EARTH\/POLAR AXIS OF DE421"/],
    ['LINE_PROJECTION_OFFSET', /LINE_PROJECTION_OFFSET\s*=\s*3799\.5\s*<pix>/],
    ['SAMPLE_PROJECTION_OFFSET', /SAMPLE_PROJECTION_OFFSET\s*=\s*3799\.5\s*<pix>/],
  ];
  for (const [name, pattern] of required) if (!pattern.test(label)) throw new TypeError(`Polar label validation failed: ${name}`);
  const labelSha256 = createHash('sha256').update(label).digest('hex');
  const manifest = JSON.parse(await readFile(resolve(ROOT, 'data/polar-lola-manifest.json'), 'utf8'));
  const rasterSha256 = manifest.local_verification?.raster_sha256?.toLowerCase();
  if (rasterSha256 !== manifest.raster?.expected_sha256?.toLowerCase() || manifest.local_verification?.raster_bytes !== manifest.raster?.expected_bytes) throw new TypeError('Polar snapshot manifest local raster verification does not match expected raster hash and size');
  const rasterPath = resolve(ROOT, 'data/raw/polar/LDEM_80S_80M.jp2');
  const { runPolarAnalysis } = await import('./run-polar-analysis.mjs');
  const python = options.python ?? process.env.NAVIGATOR_PYTHON ?? resolve(ROOT, '.venv/bin/python');
  const { grid, cells } = createPolarGrid();
  const warnings = ['Acceptance workload only; not a science study.', 'Horizon limited to 20000 m; truncated at finite range; not complete beyond DEM coverage.', 'Three instants are snapshots only; no temporal support inferred.'];
  const quality = {
    frame: grid.frame,
    projection: { name: 'polar stereographic (spherical)', radiusM: RADIUS_M, standardParallelDeg: -90, centralLongitudeDeg: 0, latitudeType: 'planetocentric', frame: 'MOON_ME_DE421', epoch: 2000 },
    dem: { product: 'LDEM_80S_80M', labelSha256, rasterSha256, registration: { sampleOffset: 3799.5, lineOffset: 3799.5, scaleM: 80, dimensions: [7600, 7600] } },
    kernels: { directory: resolve(options.kernelDirectory ?? resolve(ROOT, 'data/kernels')) },
    warnings,
  };
  const snapshot = await producePolarSnapshots({ grid, cells, timesUtc: SNAPSHOT_TIMES_UTC, quality, evaluateSite: async ({ cell, timesUtc }) => {
    const { result } = await runPolarAnalysis({
      siteId: `polar-grid-${cell.index}`, scenarioId: `polar-grid-${cell.index}`,
      latitudeDeg: cell.latitudeDeg, longitudeDeg: cell.longitudeDeg,
      start: timesUtc[0], count: 3, stepMinutes: 5, azimuthStepDeg: 5,
      distanceStepM: 80, maxDistanceM: 20000, python,
      kernelDirectory: options.kernelDirectory,
      output: resolve(ROOT, 'output', `.polar-grid-${cell.index}.json`),
    });
    return { frame: grid.frame, sky: { ...result.sky, frame: result.sky.quality.frame }, visibility: result.visibility, provenance: { siteId: `polar-grid-${cell.index}`, horizon: result.horizonDocument.provenance, registrationValidation: result.registrationValidation, kernels: quality.kernels } };
  } });
  const output = resolve(options.output ?? resolve(ROOT, 'output/polar-snapshots.json'));
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`);
  return { snapshot, output };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const outputArg = process.argv.indexOf('--output');
    if (process.argv.length > 2 && outputArg !== 2) throw new Error('Usage: node scripts/run-polar-snapshots.mjs [--output PATH]');
    const output = outputArg === 2 ? process.argv[3] : undefined;
    if (outputArg === 2 && (!output || process.argv.length !== 4)) throw new Error('Usage: node scripts/run-polar-snapshots.mjs [--output PATH]');
    const result = await runPolarSnapshots({ output });
    console.log(`Wrote polar snapshots to ${result.output}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
