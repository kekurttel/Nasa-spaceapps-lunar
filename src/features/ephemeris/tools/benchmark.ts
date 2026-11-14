import { performance } from 'node:perf_hooks';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createMoonFixedSampler, sampleMoonFixedVectors } from '../vectorData.ts';
const base = new URL('../fixtures/', import.meta.url);
const dataset = JSON.parse(readFileSync(new URL('real-moon-vectors.json', base), 'utf8'));
const start = Date.parse(dataset.samples[0].timeUtc);
const times = Array.from({ length: 10000 }, (_, i) => new Date(start + (i * 7919 % 86400) * 1000).toISOString());
const sampler = createMoonFixedSampler(dataset);
for (const time of times.slice(0, 100)) assert.deepEqual(sampler(time), sampleMoonFixedVectors(dataset, time));
for (const time of times.slice(0, 500)) sampler(time);
function measure(fn: (time: string) => unknown) {
  const runs = [];
  for (let j = 0; j < 5; j++) {
    const before = performance.now();
    for (const time of times) fn(time);
    runs.push(performance.now() - before);
  }
  return { runsMs: runs, medianMs: [...runs].sort((a, b) => a - b)[2] };
}
const previousPerSampleValidation = measure(time => sampleMoonFixedVectors(dataset, time));
const optimizedOneValidation = measure(sampler);
const report = { samples: 10000, datasetSamples: dataset.samples.length, repetitions: 5,
  method: 'Same interpolation; per-call full validation/snapshot vs one validated sampler, median wall time. 100 exact-output equivalence checks.',
  previousPerSampleValidation, optimizedOneValidation,
  speedup: previousPerSampleValidation.medianMs / optimizedOneValidation.medianMs,
  node: process.version, platform: process.platform };
writeFileSync(new URL('performance-report.json', base), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
