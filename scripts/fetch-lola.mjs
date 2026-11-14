import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = resolve(ROOT, 'data/lola-manifest.json');
const MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 30_000;

export async function fetchLola({ force = false, fetchImpl = fetch } = {}) {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  for (const [name, record] of Object.entries(manifest.files)) {
    const destination = resolve(ROOT, record.path);
    if (!force) {
      try {
        const info = await stat(destination);
        if (info.size === record.bytes && await digest(await readFile(destination)) === record.sha256.toLowerCase()) continue;
      } catch { /* Missing file: fetch it below. */ }
    }
    const response = await fetchImpl(record.url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'error' });
    if (!response.ok) throw new Error(`LOLA ${name} download failed: HTTP ${response.status}`);
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_DOWNLOAD_BYTES) throw new Error(`LOLA ${name} exceeds download size limit`);
    const bytes = await readLimitedBody(response, MAX_DOWNLOAD_BYTES, name);
    if (bytes.length !== record.bytes || await digest(bytes) !== record.sha256.toLowerCase()) throw new Error(`LOLA ${name} size/hash mismatch; refusing to save`);
    await mkdir(dirname(destination), { recursive: true });
    const temporary = `${destination}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.download`;
    try {
      await writeFile(temporary, bytes, { flag: 'wx' });
      await rename(temporary, destination);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }
  return manifest;
}

async function readLimitedBody(response, limit, name) {
  if (!response.body) throw new Error(`LOLA ${name} response has no body`);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel('LOLA download exceeds size limit');
        throw new Error(`LOLA ${name} exceeds download size limit`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

async function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fetchLola({ force: process.argv.includes('--force') }).then((manifest) => console.log(`LOLA ${manifest.productId} files verified.`)).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
