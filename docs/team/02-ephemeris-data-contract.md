# Ephemeris/data scenario contract

## Pinned upstream validator

The test pins Agent1 source at commit `b258ce0acc250bbe2243942c50e9d3523c54e723`. It reads actual `src/features/data/validation.mjs` using `git show <commit>:<path>`, verifies module has no imports, then imports exact contents through a base64 data URL. No validator copy, mock, or reimplementation. Missing commit, dependency change or missing export fails test setup loudly; tests never skip or fall back to local logic.

`validateScenario(input, options)` expects input with embedded structural `site`; options contain `manifest` with nonblank `id`/`version`, data kind, source IDs, non-null inclusive UTC date coverage, and location coverage bounds. It returns normalized `{ ok, value, warnings }` or errors. UTC accepts seconds or exactly three fractional digits. `maxSamples` defaults to 10000. Validator sample budget is `ceil((endUtc - startUtc) / stepSeconds)`, a duration budget, not endpoint-inclusive point count. Full-day coverage at 60-second cadence budgets 1440; Agent2 grid has 1441 points. Test proves this mismatch explicitly with `maxSamples: 1440`, computes all 1441 samples, and verifies `sampleDurationsSeconds` totals 86400 seconds; tighter `maxSamples: 1439` rejects scenario. Current boundary is documented, not silently reconciled.

## Ephemeris integration

`computeSkySeries(scenario, dataset?)` consumes Agent1's actual validated value directly, with bundled real DE440s vector dataset. Test asserts validation success, canonical UTC timestamps, real quality marking and finite output arrays. Manifest coverage ends at actual bundled dataset endpoint `2026-01-02T00:00:00Z`; a real Agent1 test rejects scenario extending beyond it. Both contracts include start; ephemeris adds only grid-aligned end. Irregular end remains time-range boundary, not a partial final grid sample; real sampled durations `[1, 1, 0.5]` sum to 2.5 seconds. Catalog manifest's `dateCoverage: null` is unsuitable for scenario validation, so integration supplies valid test manifest.

Run: `node --experimental-strip-types --test src/features/ephemeris/tests/dataContract.test.ts`. Tests require pinned Git commit and Node/Git; missing pinned source fails loudly. No skips. Fresh or single-branch clones must first fetch Agent1 history: `git fetch origin feat/data-scenarios`. Confirm `git cat-file -t b258ce0acc250bbe2243942c50e9d3523c54e723` prints `commit`. If upstream history is rewritten and pinned object is unavailable, obtain preserved commit from coordinator; do not replace validator with a mock.
