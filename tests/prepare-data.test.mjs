import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dataRecords, prepareData } from '../scripts/prepare-data.mjs';

const bytes = Buffer.from('small deterministic scientific-data fixture');
const record = { path: 'fixture.bin', url: 'https://example.test/fixture.bin', bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
async function sandbox(t) {
  const root = await mkdtemp(join(tmpdir(), 'prepare-data-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
const noNetwork = () => { throw new Error('Unexpected network access'); };

test('checked-in manifests describe six exact source files', async () => {
  const records = await dataRecords();
  assert.equal(records.length, 6);
  assert.equal(new Set(records.map(record => record.path)).size, 6);
  assert.equal(records.reduce((sum, record) => sum + record.bytes, 0), 22740043);
});

test('valid local file is hash-verified without network access', async t => {
  const root = await sandbox(t);
  await writeFile(join(root, record.path), bytes);
  assert.deepEqual(await prepareData({ root, records: [record], fetchImpl: noNetwork }), [{ path: record.path, status: 'verified' }]);
  await writeFile(join(root, record.path), Buffer.alloc(bytes.length));
  await assert.rejects(prepareData({ root, records: [record], verifyOnly: true, fetchImpl: noNetwork }), /missing or size\/hash mismatch/);
});

test('missing file downloads once, verifies exact bytes, and is reused offline', async t => {
  const root = await sandbox(t);
  let calls = 0;
  const fetchImpl = async (url, options) => {
    calls++;
    assert.equal(url, record.url);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(bytes, { headers: { 'content-length': String(bytes.length) } });
  };
  assert.equal((await prepareData({ root, records: [record], fetchImpl }))[0].status, 'downloaded and verified');
  assert.deepEqual(await readFile(join(root, record.path)), bytes);
  await prepareData({ root, records: [record], fetchImpl });
  assert.equal(calls, 1);
  assert.deepEqual(await readdir(root), [record.path]);
});

test('HTTP, hash, short body, size cap, and stream failures preserve old file and remove partials', async t => {
  const root = await sandbox(t);
  const original = Buffer.from('invalid old file');
  for (const response of [
    () => new Response('error', { status: 503 }),
    () => new Response(Buffer.alloc(bytes.length)),
    () => new Response(bytes.subarray(1)),
    () => new Response(Buffer.alloc(bytes.length + 1)),
    () => new Response(bytes, { headers: { 'content-length': '999' } }),
    () => new Response(new ReadableStream({ start(controller) { controller.error(new Error('broken stream')); } })),
  ]) {
    await writeFile(join(root, record.path), original);
    await assert.rejects(prepareData({ root, records: [record], fetchImpl: async () => response() }));
    assert.deepEqual(await readFile(join(root, record.path)), original);
    assert.deepEqual(await readdir(root), [record.path]);
  }
});

test('verify-only missing file and unsafe manifests fail before fetching', async t => {
  const root = await sandbox(t);
  await assert.rejects(prepareData({ root, records: [record], verifyOnly: true, fetchImpl: noNetwork }), /missing or size\/hash mismatch/);
  for (const patch of [{ path: '../escape' }, { url: 'http://example.test/fixture' }, { bytes: -1 }, { sha256: 'bad' }]) {
    await assert.rejects(prepareData({ root, records: [{ ...record, ...patch }], fetchImpl: noNetwork }), /Invalid data manifest record/);
  }
});
