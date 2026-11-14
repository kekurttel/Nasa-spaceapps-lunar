import test from 'node:test';
import assert from 'node:assert/strict';
import { createMoonFixedSampler, EphemerisVectorError, sampleMoonFixedVectors, type MoonFixedDataset } from '../vectorData.ts';

const dataset: MoonFixedDataset = {
  id: 'independent-test-fixture',
  frame: 'IAU_MOON',
  source: 'Synthetic unit-test fixture; not observational data',
  sourceUrl: 'https://example.invalid/synthetic-fixture',
  timeScale: 'UTC',
  corrections: 'geometric',
  dataKind: 'synthetic',
  samples: [
    { timeUtc: '2025-01-01T00:00:00Z', sunKm: { x: 0, y: 2, z: 4 }, earthKm: { x: 10, y: 12, z: 14 } },
    { timeUtc: '2025-01-01T00:10:00Z', sunKm: { x: 10, y: 12, z: 14 }, earthKm: { x: 20, y: 22, z: 24 } },
  ],
};

function expectCode(run: () => unknown, code: string): void {
  assert.throws(run, (error: unknown) => error instanceof EphemerisVectorError && error.code === code);
}

test('returns exact endpoints and linearly interpolates both vectors', () => {
  assert.deepEqual(sampleMoonFixedVectors(dataset, dataset.samples[0].timeUtc), dataset.samples[0]);
  assert.deepEqual(sampleMoonFixedVectors(dataset, '2025-01-01T00:05:00Z'), {
    timeUtc: '2025-01-01T00:05:00Z', sunKm: { x: 5, y: 7, z: 9 }, earthKm: { x: 15, y: 17, z: 19 },
  });
  assert.deepEqual(sampleMoonFixedVectors(dataset, dataset.samples[1].timeUtc), dataset.samples[1]);
});

test('sampler snapshots validated source data against later mutation', () => {
  const source = structuredClone(dataset);
  const sample = createMoonFixedSampler(source);
  source.samples[0].sunKm.x = 999;
  source.samples[0].earthKm.y = 999;
  source.samples[1].timeUtc = '2025-01-01T00:20:00Z';
  assert.deepEqual(sample('2025-01-01T00:05:00Z'), {
    timeUtc: '2025-01-01T00:05:00Z', sunKm: { x: 5, y: 7, z: 9 }, earthKm: { x: 15, y: 17, z: 19 },
  });
});

test('sampler matches one-shot sampling at deterministic random times and endpoints', () => {
  const samples = Array.from({ length: 21 }, (_, index) => ({
    timeUtc: new Date(Date.parse('2025-01-01T00:00:00Z') + index * 60_000).toISOString(),
    sunKm: { x: index * 0.3, y: index * -2, z: index ** 2 },
    earthKm: { x: index + 1, y: index * 4.5, z: 100 - index },
  }));
  const manySamples: MoonFixedDataset = { ...dataset, samples };
  const sampler = createMoonFixedSampler(manySamples);
  assert.deepEqual(sampler(samples[0].timeUtc), sampleMoonFixedVectors(manySamples, samples[0].timeUtc));
  assert.deepEqual(sampler(samples.at(-1)!.timeUtc), sampleMoonFixedVectors(manySamples, samples.at(-1)!.timeUtc));
  let seed = 0x12345678;
  for (let i = 0; i < 100; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const offset = seed % (20 * 60_000 + 1);
    const time = new Date(Date.parse(samples[0].timeUtc) + offset).toISOString();
    assert.deepEqual(sampler(time), sampleMoonFixedVectors(manySamples, time), time);
  }
  expectCode(() => sampler('2024-12-31T23:59:59Z'), 'EPHEMERIS_OUT_OF_RANGE');
  expectCode(() => sampler('2025-01-01T00:21:00Z'), 'EPHEMERIS_OUT_OF_RANGE');
});

test('rejects requests outside coverage without extrapolating', () => {
  expectCode(() => sampleMoonFixedVectors(dataset, '2024-12-31T23:59:59Z'), 'EPHEMERIS_OUT_OF_RANGE');
  expectCode(() => sampleMoonFixedVectors(dataset, '2025-01-01T00:10:01Z'), 'EPHEMERIS_OUT_OF_RANGE');
});

test('validates frame and required metadata', () => {
  expectCode(() => sampleMoonFixedVectors({ ...dataset, frame: 'J2000' }, dataset.samples[0].timeUtc), 'EPHEMERIS_INVALID_METADATA');
  expectCode(() => sampleMoonFixedVectors({ ...dataset, sourceUrl: 'not a URL' }, dataset.samples[0].timeUtc), 'EPHEMERIS_INVALID_METADATA');
  expectCode(() => sampleMoonFixedVectors({ ...dataset, timeScale: 'TDB' } as unknown as MoonFixedDataset, dataset.samples[0].timeUtc), 'EPHEMERIS_INVALID_METADATA');
});

test('rejects malformed dates, unordered samples, too few samples and non-finite vectors', () => {
  expectCode(() => sampleMoonFixedVectors(dataset, '2025-02-30T00:00:00Z'), 'EPHEMERIS_INVALID_DATE');
  expectCode(() => sampleMoonFixedVectors({ ...dataset, samples: [dataset.samples[0], { ...dataset.samples[1], timeUtc: '2025-01-01T00:00:00Z' }] }, dataset.samples[0].timeUtc), 'EPHEMERIS_INVALID_SAMPLES');
  expectCode(() => sampleMoonFixedVectors({ ...dataset, samples: [dataset.samples[0]] }, dataset.samples[0].timeUtc), 'EPHEMERIS_INVALID_SAMPLES');
  expectCode(() => sampleMoonFixedVectors({ ...dataset, samples: [dataset.samples[0], { ...dataset.samples[1], sunKm: { x: Infinity, y: 0, z: 0 } }] }, dataset.samples[0].timeUtc), 'EPHEMERIS_INVALID_VECTOR');
});
