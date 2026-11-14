import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sampleLolaHeightM } from './lola.mjs';

const REQUIRED_KERNELS = ['moon_080317.tf', 'moon_pa_de421_1900-2050.bpc', 'naif0012.tls', 'de421.bsp'];

export const BODY_FIXED_FRAME = 'MOON_ME_DE421';
export const LOCAL_FRAME = 'ME_DE421_LOCAL_NORTH_EAST';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const HEX = /^[a-f0-9]{64}$/i;

function validUtc(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?Z$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.parse(value));
  return Number.isFinite(date.getTime()) && date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() + 1 === Number(match[2]) && date.getUTCDate() === Number(match[3]) && date.getUTCHours() === Number(match[4]) && date.getUTCMinutes() === Number(match[5]) && date.getUTCSeconds() === Number(match[6]);
}

export function buildRegisteredRequest(dem, options = {}) {
  const { scenarioId, siteId, latitudeDeg, longitudeDeg, observerHeightM, timesUtc } = options;
  if (options.frame !== undefined && options.frame !== LOCAL_FRAME) throw new TypeError(`frame must be ${LOCAL_FRAME}`);
  if (typeof scenarioId !== 'string' || !scenarioId.trim() || typeof siteId !== 'string' || !siteId.trim()) throw new TypeError('scenarioId and siteId must be nonempty');
  if (!Number.isFinite(latitudeDeg) || latitudeDeg < -90 || latitudeDeg > 90 || !Number.isFinite(longitudeDeg)) throw new RangeError('Valid finite latitude and longitude required');
  if (!Number.isFinite(observerHeightM) || observerHeightM < 0) throw new RangeError('observerHeightM must be finite and non-negative');
  if (!Array.isArray(timesUtc) || timesUtc.length === 0 || timesUtc.length > 10000 || Array.from({ length: timesUtc.length }, (_, i) => i).some((i) => !(i in timesUtc) || typeof timesUtc[i] !== 'string' || !validUtc(timesUtc[i]) || (i > 0 && Date.parse(timesUtc[i]) <= Date.parse(timesUtc[i - 1])))) throw new TypeError('timesUtc must be nonempty, valid, strictly increasing UTC timestamps');
  if (typeof dem?.sha256 !== 'string' || !HEX.test(dem.sha256) || !(dem.valuesKm instanceof Float32Array)) throw new TypeError('Verified LOLA DEM SHA-256 required');
  const actualTerrainHash = createHash('sha256').update(new Uint8Array(dem.valuesKm.buffer, dem.valuesKm.byteOffset, dem.valuesKm.byteLength)).digest('hex');
  if (actualTerrainHash !== dem.sha256.toLowerCase()) throw new TypeError('Verified LOLA DEM was modified after loading');
  const normalizedLongitude = normalizeLongitude(longitudeDeg);
  return { scenarioId, siteId, latitudeDeg, longitudeDeg: normalizedLongitude, observerHeightM, surfaceHeightM: sampleLolaHeightM(dem, latitudeDeg, normalizedLongitude), terrainSha256: dem.sha256.toLowerCase(), frame: LOCAL_FRAME, timesUtc: [...timesUtc] };
}

export async function readKernelHashes(kernelDirectory = resolve(ROOT, 'data/kernels')) {
  const manifest = JSON.parse(await readFile(resolve(kernelDirectory, 'manifest.json'), 'utf8'));
  if (manifest.ephemeris !== 'DE421' || !Array.isArray(manifest.files) || manifest.files.length !== REQUIRED_KERNELS.length) throw new TypeError('Kernel manifest must list exactly the required DE421 kernels');
  const hashes = {};
  for (const item of manifest.files) {
    if (!item || !REQUIRED_KERNELS.includes(item.fileName) || Object.hasOwn(hashes, item.fileName) || !HEX.test(item.sha256) || !Number.isInteger(item.bytes) || item.bytes < 1) throw new TypeError('Invalid kernel manifest entry');
    const bytes = await readFile(resolve(kernelDirectory, item.fileName));
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (actual !== item.sha256.toLowerCase() || (item.bytes !== undefined && bytes.length !== item.bytes)) throw new TypeError(`Kernel manifest verification failed: ${item.fileName}`);
    hashes[item.fileName] = actual;
  }
  if (REQUIRED_KERNELS.some((name) => !Object.hasOwn(hashes, name))) throw new TypeError('Kernel manifest is missing required kernels');
  return Object.fromEntries(REQUIRED_KERNELS.map((name) => [name, hashes[name]]));
}

export async function validateRegistration(sky, document, request, { kernelDirectory } = {}) {
  const registration = sky?.registration;
  if (!registration || typeof registration !== 'object') throw new TypeError('SkySeries registration metadata required');
  const kernelHashes = await readKernelHashes(kernelDirectory);
  const checks = {};
  const same = (key, actual, expected) => { checks[key] = actual === expected; if (!checks[key]) throw new TypeError(`SkySeries registration mismatch: ${key}`); };
  same('scenarioId', sky.scenarioId, request.scenarioId);
  same('siteId', registration.siteId, request.siteId);
  same('latitudeDeg', registration.latitudeDeg, request.latitudeDeg);
  same('longitudeDeg', normalizeLongitude(registration.longitudeDeg), normalizeLongitude(request.longitudeDeg));
  same('documentProfileSiteId', document?.profile?.siteId, request.siteId);
  same('documentCoverageSiteId', document?.coverage?.siteId, request.siteId);
  for (const [prefix, record] of [['documentCoverage', document?.coverage], ['documentProvenance', document?.provenance]]) {
    if (!record) throw new TypeError(`Terrain registration mismatch: ${prefix} missing`);
    same(`${prefix}LatitudeDeg`, record.latitudeDeg, request.latitudeDeg);
    same(`${prefix}LongitudeDeg`, normalizeLongitude(record.longitudeDeg), normalizeLongitude(request.longitudeDeg));
    same(`${prefix}ObserverHeightM`, record.observerHeightM, request.observerHeightM);
  }
  same('documentProfileObserverHeightM', document?.profile?.observerHeightM, request.observerHeightM);
  same('documentFrame', document?.coverage?.frame, request.frame);
  for (const key of ['observerHeightM', 'surfaceHeightM']) {
    const expected = key === 'surfaceHeightM' ? request.surfaceHeightM : request.observerHeightM;
    if (!Number.isFinite(registration[key]) || Math.abs(registration[key] - expected) > 1e-6) throw new TypeError(`SkySeries registration mismatch: ${key}`);
    checks[key] = true;
  }
  if (!Number.isFinite(registration.observerRadiusM) || Math.abs(registration.observerRadiusM - (1737400 + request.surfaceHeightM + request.observerHeightM)) > 1e-6) throw new TypeError('SkySeries registration mismatch: observerRadiusM');
  checks.observerRadiusM = true;
  same('bodyFixedFrame', registration.bodyFixedFrame, BODY_FIXED_FRAME);
  same('localFrame', registration.localFrame, LOCAL_FRAME);
  same('frame', sky.quality?.frame, request.frame);
  same('timesUtc', JSON.stringify(sky.timesUtc), JSON.stringify(request.timesUtc));
  same('terrainSha256', registration.terrainSha256, request.terrainSha256);
  same('documentTerrainSha256', document?.provenance?.sha256?.toLowerCase(), request.terrainSha256);
  same('aberrationCorrection', registration.aberrationCorrection, 'NONE');
  if (!registration.kernelHashes || Object.keys(registration.kernelHashes).length !== REQUIRED_KERNELS.length || REQUIRED_KERNELS.some((name) => registration.kernelHashes[name] !== kernelHashes[name])) throw new TypeError('SkySeries registration mismatch: kernelHashes');
  checks.kernelHashes = true;
  if (sky.quality?.dataKind !== 'real') throw new TypeError('Registered SkySeries must have real dataKind');
  return { valid: true, checks, kernelHashes };
}

function normalizeLongitude(value) { return ((value + 180) % 360 + 360) % 360 - 180; }
