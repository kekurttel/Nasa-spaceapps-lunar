import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../');
const dependencyPrefix = process.env.EPHEMERIS_TYPECHECK_DEPS;
const typeRoots = process.env.EPHEMERIS_TYPE_ROOTS
  ?? (dependencyPrefix ? resolve(dependencyPrefix, 'node_modules/@types') : undefined);
const compiler = process.env.TSC_PATH
  ?? (dependencyPrefix ? resolve(dependencyPrefix, 'node_modules/typescript/bin/tsc') : undefined);

if (!compiler || !typeRoots) {
  console.error('Set EPHEMERIS_TYPECHECK_DEPS to a prefix containing typescript and @types/node, or set TSC_PATH and EPHEMERIS_TYPE_ROOTS.');
  process.exit(2);
}

function collectTypeScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? collectTypeScriptFiles(path)
      : entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });
}

const sourceFiles = collectTypeScriptFiles(resolve(root, 'src/features/ephemeris'));
const result = spawnSync(process.execPath, [
  compiler,
  '--noEmit',
  '--strict',
  '--target', 'ES2022',
  '--module', 'NodeNext',
  '--moduleResolution', 'NodeNext',
  '--allowImportingTsExtensions',
  '--types', 'node',
  '--typeRoots', typeRoots,
  ...process.argv.slice(2),
  ...sourceFiles,
], { cwd: root, encoding: 'utf8' });

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) {
  console.error(result.error.message);
  process.exit(2);
}
process.exit(result.status ?? 2);
