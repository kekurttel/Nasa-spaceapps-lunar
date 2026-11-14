import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, open, rename, rm } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TIMEOUT_MS = 120_000;
const TESTS = ['tests/prepare-data.test.mjs', 'tests/horizon.test.mjs', 'tests/visibility.test.mjs', 'tests/terrain.test.mjs', 'tests/lola.test.mjs', 'tests/registration.test.mjs', 'tests/real-workflow.test.mjs', 'tests/integration.test.mjs', 'tests/independent-audit.test.mjs'];

export async function dataRecords(root = ROOT) {
  const lola = JSON.parse(await readFile(resolve(root, 'data/lola-manifest.json'), 'utf8'));
  const kernels = JSON.parse(await readFile(resolve(root, 'data/kernels/manifest.json'), 'utf8'));
  return [...Object.values(lola.files), ...kernels.files.map(({ fileName, ...record }) => ({ ...record, path: `data/kernels/${fileName}` }))];
}

async function matches(path, record) {
  try {
    if ((await stat(path)).size !== record.bytes) return false;
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path)) hash.update(chunk);
    return hash.digest('hex') === record.sha256.toLowerCase();
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

// Existing valid files never require network access. Invalid downloads never replace files.
export async function prepareData({ root = ROOT, records, verifyOnly = false, fetchImpl = fetch } = {}) {
  records ??= await dataRecords(root);
  const results = [];
  for (const record of records) {
    const destination = resolve(root, record.path);
    const localPath = relative(resolve(root), destination);
    if (!localPath || localPath.startsWith('..') || isAbsolute(localPath) || !Number.isSafeInteger(record.bytes) || record.bytes <= 0 || !/^[a-f0-9]{64}$/i.test(record.sha256) || new URL(record.url).protocol !== 'https:') {
      throw new Error(`Invalid data manifest record: ${record.path}`);
    }
    if (await matches(destination, record)) {
      results.push({ path: record.path, status: 'verified' });
      continue;
    }
    if (verifyOnly) throw new Error(`${record.path}: missing or size/hash mismatch; run node scripts/prepare-data.mjs`);
    const response = await fetchImpl(record.url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'error' });
    if (!response.ok) throw new Error(`${record.path}: download failed: HTTP ${response.status}`);
    const length = response.headers.get('content-length');
    if (length !== null && Number(length) !== record.bytes) {
      await response.body?.cancel();
      throw new Error(`${record.path}: download size mismatch`);
    }
    if (!response.body) throw new Error(`${record.path}: response has no body`);
    await mkdir(dirname(destination), { recursive: true });
    const temporary = `${destination}.${process.pid}.${randomUUID()}.part`;
    let handle;
    try {
      handle = await open(temporary, 'wx');
      const hash = createHash('sha256');
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.byteLength;
        if (size > record.bytes) throw new Error(`${record.path}: download exceeds expected size`);
        hash.update(chunk);
        await handle.writeFile(chunk);
      }
      if (size !== record.bytes || hash.digest('hex') !== record.sha256.toLowerCase()) throw new Error(`${record.path}: download size/hash mismatch; refusing to save`);
      await handle.close();
      handle = undefined;
      await rename(temporary, destination);
      results.push({ path: record.path, status: 'downloaded and verified' });
    } finally {
      await handle?.close();
      await rm(temporary, { force: true });
    }
  }
  return results;
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: ROOT, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited ${result.status ?? result.signal}`);
}

async function main() {
  const flags = process.argv.slice(2);
  if (flags.some(flag => !['--verify-only', '--setup-python', '--test'].includes(flag))) throw new Error('Usage: node scripts/prepare-data.mjs [--verify-only] [--setup-python] [--test]');
  for (const result of await prepareData({ verifyOnly: flags.includes('--verify-only') })) console.log(`${result.path}: ${result.status}`);
  let env = process.env;
  if (flags.includes('--setup-python')) {
    const venv = resolve(ROOT, '.venv');
    run('python', ['-m', 'venv', venv]);
    run(resolve(venv, 'bin/python'), ['-m', 'pip', 'install', '-r', 'scripts/requirements-registration.txt']);
    env = { ...process.env, PATH: `${resolve(venv, 'bin')}${delimiter}${process.env.PATH ?? ''}` };
  }
  if (flags.includes('--test')) run(process.execPath, ['--test', ...TESTS], env);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
