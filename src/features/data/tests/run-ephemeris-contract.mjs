#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootArg = process.argv[2];
const root = rootArg ? path.resolve(rootArg) : process.env.EPHEMERIS_MODULE_ROOT;
if (!root) {
  console.error('Usage: node --experimental-strip-types src/features/data/tests/run-ephemeris-contract.mjs <ephemeris-module-root>');
  console.error('Or set EPHEMERIS_MODULE_ROOT to that branch checkout\'s src/features/ephemeris directory.');
  process.exit(2);
}
const testFile = fileURLToPath(new URL('./ephemeris-contract.test.mjs', import.meta.url));
const child = spawnSync(process.execPath, ['--experimental-strip-types', '--test', testFile], {
  stdio: 'inherit',
  env: { ...process.env, EPHEMERIS_MODULE_ROOT: root },
});
if (child.error) {
  console.error(child.error.message);
  process.exit(1);
}
process.exit(child.status ?? 1);
