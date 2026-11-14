import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFlatHorizon, loadTerrainHorizon, selectHorizon } from '../src/features/visibility/terrain.mjs';

const request = { siteId: 'site-a', observerHeightM: 1.5, frame: 'lunar-local' };
const source = { id: 'synthetic-ridge-v1', url: 'https://example.invalid/synthetic-horizon.json', description: 'Explicitly synthetic test ridge; not NASA/LOLA data.' };
const coverage = { siteId: request.siteId, observerHeightM: request.observerHeightM, frame: request.frame, azimuthCoverage: 'full-circle' };
const document = { profile: { siteId: request.siteId, azimuthDeg: [0, 90, 180, 270], elevationDeg: [0, 8, 2, 0], model: 'terrain', dataKind: 'synthetic', sourceIds: [source.id], observerHeightM: request.observerHeightM, warnings: [] }, coverage, sources: [source] };

test('creates a clearly labeled synthetic flat horizon with a warning', () => {
  const result = createFlatHorizon({ siteId: 'site-a', observerHeightM: 0 });
  assert.equal(result.model, 'flat');
  assert.equal(result.dataKind, 'synthetic');
  assert.ok(result.warnings.length > 0);
});

test('loads a terrain profile with declared source and matching coverage', () => {
  assert.deepEqual(loadTerrainHorizon(document, request), document.profile);
});

test('rejects profiles rejected by validateHorizonProfile', () => {
  const invalidProfiles = [
    { ...document.profile, elevationDeg: [0, NaN, 2, 0] },
    { ...document.profile, azimuthDeg: [0, 90, 90, 270] },
    { ...document.profile, warnings: 'not an array' },
    { ...document.profile, model: 'unknown' },
    { ...document.profile, dataKind: 'unknown' }
  ];
  for (const profile of invalidProfiles) {
    assert.throws(() => loadTerrainHorizon({ ...document, profile }, request), TypeError);
  }
});

test('rejects missing terrain structure instead of silently falling back', () => {
  assert.throws(() => loadTerrainHorizon({}, request));
});

test('rejects undeclared source IDs and request mismatch', () => {
  assert.throws(() => loadTerrainHorizon({ ...document, profile: { ...document.profile, sourceIds: ['unknown'] } }, request));
  assert.throws(() => loadTerrainHorizon(document, { ...request, siteId: 'other' }));
  assert.throws(() => loadTerrainHorizon({ ...document, coverage: { ...coverage, frame: 'other' } }, request));
});

test('rejects malformed request context consistently in both entry points', () => {
  for (const invalid of [
    { ...request, siteId: ' ' },
    { ...request, observerHeightM: -1 },
    { ...request, frame: '  ' },
    { ...request, strictTerrain: 'yes' }
  ]) {
    assert.throws(() => selectHorizon(null, invalid), TypeError);
    assert.throws(() => loadTerrainHorizon(document, invalid), TypeError);
  }
});

test('rejects incomplete, invalid, or duplicate source records', () => { 
  for (const invalidSource of [
    { id: '', url: 'https://example.test/data', description: 'source' },
    { id: 'id', url: '', description: 'source' },
    { id: 'id', url: 'https://example.test/data', description: ' ' },
    { id: 'id', url: 'file:///data', description: 'source' }
  ]) {
    assert.throws(() => loadTerrainHorizon({ ...document, sources: [invalidSource] }, request));
  }
  const duplicateSource = { id: 'id', url: 'https://example.test/data', description: 'source' };
  assert.throws(() => loadTerrainHorizon({ ...document, sources: [duplicateSource, { ...duplicateSource }] }, request), /Duplicate terrain source id/);
  const mismatchedSource = { id: 'id', url: 'https://example.test/data', description: 'source' };
  assert.throws(() => loadTerrainHorizon({ ...document, sources: [mismatchedSource] }, request), /reference declared sources/);
});

test('strict terrain selection fails without terrain; non-strict selection labels fallback', () => {
  assert.throws(() => selectHorizon(null, { ...request, strictTerrain: true }));
  const result = selectHorizon(null, request);
  assert.equal(result.model, 'flat');
  assert.ok(result.warnings.length > 0);
});

test('fallback rejects invalid request context and strictTerrain type', () => {
  for (const invalid of [
    { ...request, frame: '' },
    { ...request, frame: undefined },
    { ...request, observerHeightM: NaN },
    { ...request, observerHeightM: -1 },
    { ...request, strictTerrain: 'false' },
    { ...request, strictTerrain: 1 }
  ]) assert.throws(() => selectHorizon(null, invalid));
});

test('reads the fixture as explicitly synthetic, not NASA/LOLA terrain', async () => {
  const fixture = JSON.parse(await readFile(new URL('../fixtures/synthetic-horizon.json', import.meta.url), 'utf8'));
  assert.equal(fixture.profile.dataKind, 'synthetic');
  assert.match(fixture.sources[0].description, /not NASA\/LOLA/i);
  assert.deepEqual(loadTerrainHorizon(fixture, request), fixture.profile);
});
