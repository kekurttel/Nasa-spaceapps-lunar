import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeSkySeries } from '../index.ts';
import type { MoonFixedDataset, Scenario } from '../index.ts';

const real = JSON.parse(readFileSync(new URL('../fixtures/real-moon-vectors.json', import.meta.url), 'utf8')) as MoonFixedDataset;
const provenance = readFileSync(new URL('../fixtures/kernel-report.md', import.meta.url), 'utf8');
const report = JSON.parse(readFileSync(new URL('../fixtures/validation-report.json', import.meta.url), 'utf8'));

function scenario(startUtc: string, endUtc = startUtc, latDeg = 0, lonDeg = 0): Scenario {
  return { id: 'compat', site: { id: 'site', name: 'site', latDeg, lonDeg, surfaceElevationM: 0,
    observerHeightM: 0, kind: 'custom', sourceIds: [] }, startUtc, endUtc, stepSeconds: 3600 };
}

function qualityFor(dataset: MoonFixedDataset) {
  return computeSkySeries(scenario('2026-01-01T00:00:00.000Z'), dataset).quality;
}

test('fixture first/interior/last samples are finite and have traceable source metadata', () => {
  assert.equal(real.frame, 'IAU_MOON');
  assert.equal(real.timeScale, 'UTC');
  assert.equal(real.corrections, 'geometric');
  assert.equal(real.dataKind, 'real');
  assert.ok(real.sourceUrl.startsWith('https://'));
  assert.match(provenance, /de440s\.bsp.*SHA-256/s);
  assert.match(provenance, /pck00011\.tpc.*SHA-256/s);
  assert.match(provenance, /naif0012\.tls.*SHA-256/s);
  assert.equal(real.samples.length, 25);
  assert.equal(real.samples[0].timeUtc, '2026-01-01T00:00:00Z');
  assert.equal(real.samples.at(-1)?.timeUtc, '2026-01-02T00:00:00Z');
  for (const sample of [real.samples[0], real.samples[Math.floor(real.samples.length / 2)], real.samples.at(-1)!]) {
    for (const vector of [sample.sunKm, sample.earthKm])
      for (const coordinate of [vector.x, vector.y, vector.z]) assert.ok(Number.isFinite(coordinate));
  }
  const start = computeSkySeries(scenario('2026-01-01T00:00:00.000Z'), real);
  const end = computeSkySeries(scenario('2026-01-02T00:00:00.000Z'), real);
  assert.equal(start.timesUtc.length, 1);
  assert.equal(end.timesUtc.length, 1);
});

test('quality warnings describe the selected dataset rather than a particular bundle', () => {
  const base = qualityFor(real);
  const synthetic: MoonFixedDataset = { ...real, id: 'custom-synthetic', source: 'my-source', sourceUrl: 'https://example.invalid', dataKind: 'synthetic' };
  const syntheticQuality = qualityFor(synthetic);
  assert.ok(syntheticQuality.warnings.some(w => w.toLowerCase().includes('synthetic')));
  assert.equal(syntheticQuality.model.includes('my-source'), true);
  assert.equal(syntheticQuality.warnings.some(w => w.includes('Bundled DE440s dataset')), false);
  assert.equal(base.warnings.some(w => w.includes('Bundled DE440s dataset')), false);
});

test('finite outlier vectors retain provenance but produce an explicit quality warning', () => {
  const outlier: MoonFixedDataset = structuredClone(real);
  outlier.samples[0].sunKm = { x: 1e8, y: 0, z: 0 };
  const quality = qualityFor(outlier);
  assert.equal(quality.dataKind, 'real');
  assert.equal(quality.warnings.some(w => /outlier|magnitude|discontinu/i.test(w)), true);
});

test('observer radius, near-zenith azimuth and angular-radius semantics are explicit', () => {
  const belowSurface: Scenario = scenario('2026-01-01T00:00:00.000Z');
  belowSurface.site.surfaceElevationM = -2_000_000;
  assert.throws(() => computeSkySeries(belowSurface, real), { code: 'EPHEMERIS_OBSERVER_RADIUS' });
  const zenithDataset: MoonFixedDataset = { ...real, samples: real.samples.slice(0, 2).map(s => ({ ...s,
    sunKm: { x: 149597870, y: 0, z: 0 }, earthKm: { x: 384400, y: 0, z: 0 } })) };
  const atNearZenith = computeSkySeries(scenario('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 0, 0), zenithDataset);
  assert.ok(Number.isFinite(atNearZenith.sunAzDeg[0])); // convention currently reports 0 despite undefined bearing
  assert.equal(atNearZenith.sunRadiusDeg.length, atNearZenith.sunAltDeg.length);
  assert.ok(Math.abs(atNearZenith.sunRadiusDeg[0] - 0.266) < 0.01);
});

test('saved reference data has expected coverage, but does not validate arbitrary dataset interpolation', () => {
  assert.equal(report.measurements.length, 78);
  assert.equal(report.maxSeparationDeg < 0.1, true);
  assert.match(report.limitations, /not guaranteed for other dates or datasets/);
});
