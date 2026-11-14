import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
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
function execute(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Scenario payload required.');
  if (input.horizonModel !== 'flat') throw new Error('Only explicit horizonModel "flat" is available; terrain is unsupported.');
  if (input.terrainDocument !== undefined) throw new Error('Terrain uploads are unsupported; incompatible terrain frames are rejected.');
  const { site: rawSite, startUtc, endUtc, stepSeconds } = input;
  if (!rawSite || typeof rawSite !== 'object') throw new Error('site is required.');
  const validated = validateSite(rawSite);
  if (!validated.ok) throw new Error(validated.errors.map(({ message }) => message).join(' '));
  const site = validated.value;
  if (site.surfaceElevationM === null || !Number.isFinite(site.surfaceElevationM)) throw new Error('Surface elevation is unknown. Enter an assumed elevation in metres before calculating; catalog value remains unknown.');
  if (!Number.isFinite(stepSeconds) || stepSeconds <= 0 || !Number.isSafeInteger(stepSeconds * 1000)) throw new Error('stepSeconds must be a positive finite value resolving to integer milliseconds.');
  if (!Number.isFinite(site.observerHeightM) || site.observerHeightM < 0) throw new Error('observerHeightM must be finite and non-negative.');
  const scenario = { id: input.id, site, startUtc: normalizeUtc(startUtc, 'startUtc'), endUtc: normalizeUtc(endUtc, 'endUtc'), stepSeconds };
  const sky = computeSkySeries(scenario, dataset);
  const horizon = createFlatHorizon({ siteId: site.id, observerHeightM: site.observerHeightM });
  const visibility = computeVisibility(sky, horizon, { siteId: site.id, observerHeightM: site.observerHeightM, frame: sky.quality.frame, horizonFrame: sky.quality.frame });
  visibility.quality = { ...visibility.quality, model: sky.quality.model, frame: sky.quality.frame, sourceIds: [dataset.id] };
  return { scenario, sky, horizon, visibility, analysis: analyzeVisibility(scenario, visibility) };
}
async function handle(req) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') return { status: 204, body: '', type: 'text/plain; charset=utf-8' };
  if (req.method === 'GET' && url.pathname === '/api/catalog') return api({ sites, sources });
  if (req.method === 'GET' && url.pathname === '/api/portals') return api([
    { name: 'QuickMap', state: 'planned', detail: 'Portal inspected; no layer consumed by this calculation.', url: 'https://quickmap.lroc.im-ldi.com' },
    { name: 'Moon Trek', state: 'accessed', detail: 'Map tiles provide visual context only, not elevation data.', url: 'https://trek.nasa.gov/moon/' },
    { name: 'JPL Horizons', state: 'accessed', detail: 'Saved comparison lineage only; app uses bundled NAIF vectors.', url: 'https://ssd.jpl.nasa.gov/horizons/' },
    { name: 'LRO / LOLA', state: 'blocked', detail: 'No compatible terrain horizon is available; explicit flat model is used.', url: 'https://pds-geosciences.wustl.edu/missions/lro/lola.htm' },
  ]);
  if (req.method === 'POST' && url.pathname === '/api/analyze') {
    let raw = ''; let bytes = 0;
    for await (const chunk of req) { bytes += Buffer.byteLength(chunk); if (bytes > 1_000_000) return api({ error: 'Request too large.' }, 413); raw += chunk; }
    const body = JSON.parse(raw);
    if (!Array.isArray(body.scenarios) || body.scenarios.length < 1 || body.scenarios.length > 4) throw new Error('Choose one to four scenarios.');
    const entries = body.scenarios.map(execute);
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
    const status = /unknown|coverage|out_of_range|frame|elevation/i.test(error.message) ? 422 : 400;
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' });
    res.end(JSON.stringify({ error: error.message, code: error.code || 'ANALYSIS_ERROR' }));
  }
}); }
const server = createNavigatorServer();
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) server.listen(PORT, '127.0.0.1', () => console.log(`Navigator API listening at http://127.0.0.1:${PORT}`));
