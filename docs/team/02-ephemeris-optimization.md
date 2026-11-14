# Agent 2 — Prepared observer optimization

2026-11-14. Baseline `f4252d39970d2a5cf458a96541a4b28247fc563f`.

## Changes and invariants

- `createLocalSkyProjector` prepares observer position and north/east/up coefficients once per series. No global cache, no changed astronomical model or dataset.
- Original multiplication/subtraction/addition grouping retained: north is `(northX * dx - northY * dy) + northZ * dz`; coefficients contain precisely the original leading products. Observer subtraction, `Math.hypot`, `atan2`, wrapping and angular-radius function unchanged.
- Per-target finite, distance overflow and zero-direction checks retained. Standalone wrapper still checks target before site.
- Series projector initialized only after first successful `sampleVectors(time)`, preserving source-coverage error precedence over invalid observer radius.
- Zenith/nadir warning uses one per-call latch; unchanged text, threshold and first-occurrence order. No repeated warning-array scan.
- `datasetWarnings` deliberately unchanged; further changes need independent warning-order/NaN/zero-vector parity tests.

## Reproduction and measured scope

`tools/compare_prepared_series.ts` imports actual baseline coordinate/index code from pinned Git object. Compares complete outputs, including quality warnings, with exact deep equality. Five sites cover ±180 longitude, near poles, negative/nonzero elevation and observer height; six repeated-zenith/nadir Sun/Earth cases. Parent run: 11 complete series matched exactly. Two baseline error-code comparisons also matched: invalid combined radius with in-coverage and out-of-coverage start.

`tools/benchmark_observer.ts` imports actual baseline coordinate implementation from same Git object. 100000 target projections first pass exact output equality. Three warmup pairs and nine measured pairs with alternating order. Parent measurement: Node v24.22.0, Windows x64; baseline median 22.4813 ms; prepared median 16.4794 ms; ratio 1.3642x. This is coordinate projection only, not full-series/backend/UI speedup. Timing depends on machine and load; no minimum speedup assertion.

Both tools require preserved baseline Git object and Node `stripTypeScriptTypes`; neither installs dependencies nor downloads data. The Node API can emit an ExperimentalWarning on supported runtimes.

## Final checks

Parent rerun: 57 Node tests passed, 0 failed, 0 skipped. Strict NodeNext TypeScript check exited 0 without diagnostics. Python exporter tests: 5 passed. Saved Horizons reference validator: 78 directions, maximum 0.00775688093675673 degrees, unchanged. Regression coverage includes legacy exact formula at 1000 varied sites/vector pairs, invalid target/site codes, source coverage precedence, repeated warnings, and warning threshold at/below/above 89.999999 degrees for both bodies and signs.

## Scope

Only Agent 2 module, tests, diagnostic tools and notes changed. No backend/UI/terrain/data module edits, no new engine, no real-terrain enablement. Existing scientific scope and no-fallback policy remain unchanged.
