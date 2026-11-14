import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { runRegisteredAnalysis } from '../scripts/run-registered-analysis.mjs';
import { loadTerrainHorizon } from '../src/features/visibility/terrain.mjs';
import { LOCAL_FRAME, BODY_FIXED_FRAME } from '../src/features/visibility/registration.mjs';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

const buildRoot = fileURLToPath(new URL('../frontend/build/', import.meta.url));
const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
import { sites, sources, validateSite } from '../src/features/data/index.mjs';
import { computeSkySeries } from '../src/features/ephemeris/index.ts';
import dataset from '../src/features/ephemeris/fixtures/real-moon-vectors.json' with { type: 'json' };
import { createFlatHorizon } from '../src/features/visibility/terrain.mjs';
import { computeVisibility } from '../src/features/visibility/visibility.mjs';
import { analyzeVisibility, compareScenarios, serializeComparisonCsv } from '../src/features/analysis/index.mjs';

const PORT = Number(process.env.PORT || 4170);
const api = (payload, status = 200) => ({ status, body: JSON.stringify(payload), type: 'application/json; charset=utf-8' });
function normalizeUtc(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) throw new Error(`${label} must be ISO UTC ending in Z.`);
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) throw new Error(`${label} is invalid.`);
  const canonical = new Date(millis).toISOString();
  const normalized = value.includes('.') ? value.replace(/\.(\d{1,3})Z$/, (_, ms) => `.${ms.padEnd(3, '0')}Z`) : value.replace('Z', '.000Z');
  if (canonical !== normalized) throw new Error(`${label} is not a real calendar timestamp.`);
  return canonical;
}
async function execute(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Scenario payload required.');
  if (!['flat', 'terrain'].includes(input.horizonModel)) throw new Error('Explicit horizonModel "flat" or "terrain" is required.');
  if (input.id === undefined || typeof input.id !== 'string' || !input.id.trim()) throw new Error('Scenario id must be nonempty.');
  if (input.frame !== undefined) throw new Error('Caller frame overrides are unsupported; registered terrain frame is fixed.');
  if (input.horizonModel === 'terrain' && input.coordinateFrame !== BODY_FIXED_FRAME) throw new Error(`Terrain coordinateFrame must explicitly be ${BODY_FIXED_FRAME}; catalog coordinates are not transformed automatically.`);
  if (input.horizonModel === 'flat' && input.coordinateFrame !== undefined && input.coordinateFrame !== 'IAU_MOON') throw new Error('Flat coordinateFrame must be IAU_MOON; coordinate transforms are not performed.');
  if (input.terrainDocument !== undefined) throw new Error('Terrain uploads are unsupported; incompatible terrain frames are rejected.');
  const { site: rawSite, startUtc, endUtc, stepSeconds } = input;
  if (!rawSite || typeof rawSite !== 'object') throw new Error('site is required.');
  const validated = validateSite(rawSite);
  if (!validated.ok) throw new Error(validated.errors.map(({ message }) => message).join(' '));
  const site = validated.value;
  if (input.horizonModel === 'flat' && (site.surfaceElevationM === null || !Number.isFinite(site.surfaceElevationM))) throw new Error('Surface elevation is unknown. Enter an assumed elevation in metres before calculating; catalog value remains unknown.');
  if (!Number.isFinite(stepSeconds) || stepSeconds <= 0 || !Number.isSafeInteger(stepSeconds * 1000)) throw new Error('stepSeconds must be a positive finite value resolving to integer milliseconds.');
  if (!Number.isFinite(site.observerHeightM) || site.observerHeightM < 0) throw new Error('observerHeightM must be finite and non-negative.');
  const scenario = { id: input.id, site, coordinateFrame: input.horizonModel === 'terrain' ? BODY_FIXED_FRAME : 'IAU_MOON', startUtc: normalizeUtc(startUtc, 'startUtc'), endUtc: normalizeUtc(endUtc, 'endUtc'), stepSeconds };
  const durationMs = Date.parse(scenario.endUtc) - Date.parse(scenario.startUtc);
  const count = Math.ceil(durationMs / (stepSeconds * 1000));
  if (durationMs <= 0 || durationMs > 31 * 86400000) throw new Error('Scenario duration must be positive and at most 31 days.');
  if (stepSeconds < 60 || count > 2048) throw new Error('Cadence must be at least 60 seconds and sample count at most 2048.');
  if (input.horizonModel === 'terrain') return executeTerrain(scenario, count);
  const sky = computeSkySeries(scenario, dataset);
  const horizon = createFlatHorizon({ siteId: site.id, observerHeightM: site.observerHeightM });
  const visibility = computeVisibility(sky, horizon, { siteId: site.id, observerHeightM: site.observerHeightM, frame: sky.quality.frame, horizonFrame: sky.quality.frame });
  visibility.quality = { ...visibility.quality, model: sky.quality.model, frame: sky.quality.frame, sourceIds: [dataset.id] };
  return { scenario, sky, horizon, visibility, analysis: analyzeVisibility(scenario, visibility) };
}
let terrainActive = false;
async function executeTerrain(scenario, count) {
  if (terrainActive) {
    const error = new Error('Terrain analysis busy; retry after current analysis completes.');
    error.code = 'TERRAIN_BUSY';
    throw error;
  }
  terrainActive = true;
  let temp;
  try {
    temp = await mkdtemp(resolve(process.env.TMPDIR || tmpdir(), 'navigator-terrain-'));
    const { result } = await runRegisteredAnalysis({
      scenarioId: scenario.id, siteId: scenario.site.id,
      latitudeDeg: scenario.site.latDeg, longitudeDeg: scenario.site.lonDeg,
      height: scenario.site.observerHeightM, start: scenario.startUtc,
      count, stepMinutes: scenario.stepSeconds / 60,
      python: process.env.NAVIGATOR_PYTHON || process.env.PYTHON || 'python',
      kernelDirectory: process.env.NAVIGATOR_KERNEL_DIRECTORY,
      output: resolve(temp, 'analysis.json'), tempRoot: temp,
    });
    const { sky, visibility, horizonDocument, registrationValidation } = result;
    const horizon = loadTerrainHorizon(horizonDocument, { siteId: scenario.site.id, observerHeightM: scenario.site.observerHeightM, frame: LOCAL_FRAME, strictTerrain: true });
    // Elevation comes from the same verified DEM used to register the observer.
    scenario.site = { ...scenario.site, surfaceElevationM: sky.registration.surfaceHeightM };
    const sourceIds = [...new Set([
      ...horizon.sourceIds,
      ...(sky.quality.sourceIds || []),
      `dem-sha256:${sky.registration.terrainSha256}`,
      ...Object.entries(registrationValidation.kernelHashes).map(([name, hash]) => `kernel:${name}:sha256:${hash}`),
    ])];
    visibility.quality = {
      ...visibility.quality, model: sky.quality.model, frame: LOCAL_FRAME, sourceIds,
      terrainSha256: sky.registration.terrainSha256,
      kernelHashes: registrationValidation.kernelHashes,
      registrationValid: registrationValidation.valid,
      warnings: [...visibility.quality.warnings, 'Observer surface elevation derived from verified LOLA DEM; caller surfaceElevationM is not used for terrain.', 'Input latitude/longitude interpreted as MOON_ME_DE421 coordinates by caller declaration; catalog coordinate frame and uncertainty are not verified, and no IAU_MOON coordinate transform is performed.'],
    };
    return { scenario, sky, horizon, horizonDocument, registrationValidation, visibility, analysis: analyzeVisibility(scenario, visibility) };
  } finally {
    try { if (temp) await rm(temp, { recursive: true, force: true }); }
    finally { terrainActive = false; }
  }
}
async function handle(req) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') return { status: 204, body: '', type: 'text/plain; charset=utf-8' };
  if (req.method === 'GET' && url.pathname === '/api/catalog') return api({ sites, sources });
  if (req.method === 'GET' && url.pathname === '/api/portals') return api([
    { name: 'QuickMap', state: 'planned', detail: 'Portal inspected; no layer consumed by this calculation.', url: 'https://quickmap.lroc.im-ldi.com' },
    { name: 'Moon Trek', state: 'accessed', detail: 'Map tiles provide visual context only, not elevation data.', url: 'https://trek.nasa.gov/moon/' },
    { name: 'JPL Horizons', state: 'accessed', detail: 'Saved comparison lineage only; app uses bundled NAIF vectors.', url: 'https://ssd.jpl.nasa.gov/horizons/' },
    { name: 'LRO / LOLA', state: 'accessed', detail: 'Bundled coarse LOLA DEM supplies registered MOON_ME_DE421 terrain; kernel hashes and DEM SHA-256 verified per terrain analysis.', url: 'https://pds-geosciences.wustl.edu/missions/lro/lola.htm' },
  ]);
  if (req.method === 'POST' && url.pathname === '/api/analyze') {
    let raw = ''; let bytes = 0;
    for await (const chunk of req) { bytes += Buffer.byteLength(chunk); if (bytes > 1_000_000) return api({ error: 'Request too large.' }, 413); raw += chunk; }
    const body = JSON.parse(raw);
    if (!Array.isArray(body.scenarios) || body.scenarios.length < 1 || body.scenarios.length > 4) throw new Error('Choose one to four scenarios.');
    if (new Set(body.scenarios.map(scenario => scenario?.id)).size !== body.scenarios.length) throw new Error('Scenario IDs must be unique.');
    const entries = [];
    for (const scenario of body.scenarios) entries.push(await execute(scenario));
    const comparisons = entries.length >= 2 ? compareScenarios(entries.map(({ scenario, visibility }) => ({ scenario, series: visibility }))) : { comparisons: entries.map(entry => entry.analysis) };
    return api({ entries, comparisons, csv: entries.length >= 2 ? serializeComparisonCsv(entries.map(({ scenario, visibility }) => ({ scenario, series: visibility }))) : '' });
  }
  if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
    const requested = resolve(buildRoot, `.${decodeURIComponent(url.pathname)}`);
    if (requested !== buildRoot.replace(/\/$/, '') && !requested.startsWith(buildRoot.endsWith(sep) ? buildRoot : buildRoot + sep)) return api({ error: 'Forbidden' }, 403);
    let file = requested;
    let body;
    try { body = await readFile(file); } catch { file = resolve(buildRoot, 'index.html'); body = await readFile(file); }
    return { status: 200, type: contentTypes[extname(file)] || 'application/octet-stream', body };
  }
  return api({ error: 'Not found' }, 404);
}
export function createNavigatorServer() { return createServer(async (req, res) => {
  try {
    const result = await handle(req);
    res.writeHead(result.status, { 'content-type': result.type, 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' });
    res.end(result.body);
  } catch (error) {
    const status = error.code === 'TERRAIN_BUSY' ? 503 : /unknown|coverage|out_of_range|frame|elevation/i.test(error.message) ? 422 : 400;
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' });
    res.end(JSON.stringify({ error: error.message, code: error.code || 'ANALYSIS_ERROR' }));
  }
}); }
const server = createNavigatorServer();
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) server.listen(PORT, '127.0.0.1', () => console.log(`Navigator API listening at http://127.0.0.1:${PORT}`));
