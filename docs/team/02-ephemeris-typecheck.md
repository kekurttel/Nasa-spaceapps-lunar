# Ephemeris TypeScript check

Validated 2026-11-14: strict NodeNext compilation completed with exit 0, no diagnostics. Initial run exposed missing ESM package scope and an implicit measurement-array type; fixed with module-local `src/features/ephemeris/package.json` (`private`, `type: module`) and explicit DirectionMeasurement type. No root or application package/lockfile changed.

Run from repository root with Node.js installed and external dependencies prepared:

```powershell
$env:EPHEMERIS_TYPECHECK_DEPS = 'C:\Users\Oğuz Eren\AppData\Local\Temp\opencode\ephemeris-typecheck-deps'
node src/features/ephemeris/tools/typecheck.mjs
```

The prefix must contain `node_modules/typescript/bin/tsc` and `node_modules/@types/node`. Install dependencies separately in that prefix; the checker never installs packages or modifies repository manifests. Alternatively set `TSC_PATH` to a compiler entrypoint and `EPHEMERIS_TYPE_ROOTS` to its Node type root.

Checks all `.ts` files under `src/features/ephemeris`, including tests and tools. Uses explicit `NodeNext`, `ES2022`, `strict`, `noEmit`, `allowImportingTsExtensions`, and Node types. Extra compiler arguments can follow script name. Compiler diagnostics pass through; process exits with compiler status, or 2 for setup/launch errors.
