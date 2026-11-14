import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNavigatorServer } from '../../server/app.mjs';

const terrain = id => ({
  id, horizonModel: 'terrain', coordinateFrame: 'MOON_ME_DE421',
  startUtc: '2026-11-14T00:00:00Z', endUtc: '2026-11-14T00:10:00Z', stepSeconds: 300,
  site: { id: `site-${id}`, name: id, latDeg: -89.9, lonDeg: 0, surfaceElevationM: null, observerHeightM: 2, kind: 'custom', sourceIds: [] },
});

test('terrain API rejects missing frame and bounds work before Python execution', async t => {
  const server = createNavigatorServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = async scenario => fetch(`http://127.0.0.1:${server.address().port}/api/analyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenarios: [scenario] }) });
  assert.equal((await request({ ...terrain('bad'), coordinateFrame: undefined })).status, 422);
  assert.equal((await request({ ...terrain('bad'), coordinateFrame: 'IAU_MOON' })).status, 422);
  assert.equal((await request({ ...terrain('bad'), stepSeconds: 1 })).status, 400);
  assert.equal((await request({ ...terrain('bad'), endUtc: '2026-12-14T00:00:00Z', stepSeconds: 60 })).status, 400);
});

test('real registered terrain API compares two scenarios with verified CSV lineage and no output remnants', { skip: !process.env.NAVIGATOR_PYTHON, timeout: 240000 }, async t => {
  const temp = await mkdtemp(join(tmpdir(), 'navigator-api-test-'));
  const previous = process.env.TMPDIR;
  process.env.TMPDIR = temp;
  const server = createNavigatorServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    if (previous === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = previous;
    await rm(temp, { recursive: true, force: true });
  });
  const second = terrain('two');
  second.site.lonDeg = 10;
  second.site.observerHeightM = 5;
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/analyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scenarios: [terrain('one'), second] }) });
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(result.entries.length, 2);
  assert.equal(result.comparisons.comparisons.length, 2);
  for (const entry of result.entries) {
    assert.equal(entry.registrationValidation.valid, true);
    assert.ok(Object.values(entry.registrationValidation.checks).every(Boolean));
    assert.equal(entry.sky.registration.bodyFixedFrame, 'MOON_ME_DE421');
    assert.equal(entry.scenario.coordinateFrame, 'MOON_ME_DE421');
    assert.equal(entry.sky.quality.frame, 'ME_DE421_LOCAL_NORTH_EAST');
    assert.equal(entry.visibility.quality.frame, 'ME_DE421_LOCAL_NORTH_EAST');
    assert.equal(entry.visibility.quality.horizonModel, 'terrain');
    assert.equal(entry.scenario.site.surfaceElevationM, entry.sky.registration.surfaceHeightM);
    assert.equal(entry.horizon.observerHeightM, entry.scenario.site.observerHeightM);
    assert.equal(entry.visibility.timesUtc.length, 2);
    assert.match(entry.visibility.quality.terrainSha256, /^[a-f0-9]{64}$/);
    assert.equal(Object.keys(entry.visibility.quality.kernelHashes).length, 4);
    assert.ok(entry.analysis.quality.sourceIds.includes(`dem-sha256:${entry.visibility.quality.terrainSha256}`));
  }
  assert.match(result.csv, /ME_DE421_LOCAL_NORTH_EAST/);
  assert.match(result.csv, /dem-sha256:/);
  assert.match(result.csv, /kernel:de421.bsp:sha256:/);
  assert.match(result.csv, /no IAU_MOON coordinate transform/);
  assert.deepEqual(await readdir(temp), []);
});
