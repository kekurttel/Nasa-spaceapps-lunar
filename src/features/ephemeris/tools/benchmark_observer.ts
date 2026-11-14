import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createLocalSkyProjector, type Vec3, type LocalSkyDirection } from '../coordinates.ts';

// Pinned pre-optimization implementation, not a reimplemented benchmark baseline.
const baselineCommit = 'f4252d39970d2a5cf458a96541a4b28247fc563f';
const source = execFileSync('git', ['show', `${baselineCommit}:src/features/ephemeris/coordinates.ts`], { encoding: 'utf8' });
// Native Node stripping is not applied to data URLs. Strip types with Node's own API.
const { stripTypeScriptTypes } = await import('node:module');
const javascript = stripTypeScriptTypes(source, { mode: 'strip' });
const baselineModule = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`) as {
  localSkyDirection: (target: Vec3, lat: number, lon: number, elevation: number, height: number) => LocalSkyDirection;
};
const project = createLocalSkyProjector(-45, 137, 1200, 2);
const legacy = (target: Vec3) => baselineModule.localSkyDirection(target, -45, 137, 1200, 2);
const vectors: Vec3[] = Array.from({ length: 100000 }, (_, i) => ({
  x: 380000 + i * 0.01, y: -120000 + i * 0.02, z: 40000 - i * 0.01,
}));
// Timing never substitutes for numeric equivalence.
for (const vector of vectors) assert.deepEqual(project(vector), legacy(vector));
let checksum = 0;
function run(fn: (target: Vec3) => LocalSkyDirection): number {
  const start = performance.now();
  let sum = 0;
  for (const vector of vectors) {
    const value = fn(vector);
    sum += value.altitude + value.azimuth + value.distanceKm;
  }
  checksum = sum;
  return performance.now() - start;
}
for (let i = 0; i < 3; i++) { run(legacy); run(project); }
const baselineMs: number[] = [];
const preparedMs: number[] = [];
for (let i = 0; i < 9; i++) {
  // Alternate order to reduce systematic warmup/order bias.
  if (i % 2) { preparedMs.push(run(project)); baselineMs.push(run(legacy)); }
  else { baselineMs.push(run(legacy)); preparedMs.push(run(project)); }
}
function median(values: number[]): number { return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]; }
const baselineMedianMs = median(baselineMs);
const preparedMedianMs = median(preparedMs);
console.log(JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, baselineCommit, scope: 'local coordinate projection only; not whole application',
  vectors: vectors.length, exactMatches: vectors.length, runs: 9, baselineMs, preparedMs,
  baselineMedianMs, preparedMedianMs, speedup: baselineMedianMs / preparedMedianMs, checksum }, null, 2));
