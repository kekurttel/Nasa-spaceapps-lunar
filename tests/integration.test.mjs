import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { selectHorizon } from '../src/features/visibility/terrain.mjs';
import { computeVisibility } from '../src/features/visibility/visibility.mjs';

const frame = 'local-north-clockwise';
function sky() {
  return {
    scenarioId: 'synthetic-integration',
    timesUtc: ['2026-11-14T00:00:00Z', '2026-11-14T00:01:00Z', '2026-11-14T00:02:00Z'],
    sunAltDeg: [1, 0, -1], sunAzDeg: [359, 0, 1],
    earthAltDeg: [1, 0, -1], earthAzDeg: [359, 0, 1], sunRadiusDeg: [0.25, 0.25, 0.25],
    quality: { dataKind: 'synthetic', model: 'integration-only', frame, warnings: [] }
  };
}

test('explicit fallback flows into visibility without pretending terrain', () => {
  const request = { siteId: 'synthetic-site', observerHeightM: 2, frame };
  const horizon = selectHorizon(null, request);
  const result = computeVisibility(sky(), horizon, { ...request, horizonFrame: frame });
  assert.deepEqual(result.sunVisibleFraction, [1, 0.5, 0]);
  assert.deepEqual(result.earthVisible, [true, false, false]);
  assert.deepEqual(result.bothAvailable, [true, false, false]);
  assert.equal(result.quality.dataKind, 'synthetic');
  assert.equal(result.quality.horizonModel, 'flat');
  assert.ok(result.quality.warnings.some(w => /no terrain|fallback|falling back/i.test(w)));
});

test('synthetic sourced profile flows through loader and visibility deterministically', async () => {
  const document = JSON.parse(await readFile(new URL('../fixtures/synthetic-horizon.json', import.meta.url), 'utf8'));
  const request = { siteId: document.profile.siteId, observerHeightM: document.profile.observerHeightM, frame: document.coverage.frame, strictTerrain: true };
  const horizon = selectHorizon(document, request);
  const input = sky();
  input.quality.frame = request.frame;
  const before = JSON.stringify({ input, document });
  const options = { ...request, horizonFrame: request.frame };
  const first = computeVisibility(input, horizon, options);
  assert.deepEqual(first, computeVisibility(input, horizon, options));
  assert.equal(first.quality.dataKind, 'synthetic');
  assert.equal(first.quality.horizonModel, 'terrain');
  assert.ok(first.sunVisibleFraction.every(x => x >= 0 && x <= 1));
  assert.equal(JSON.stringify({ input, document }), before);
});
