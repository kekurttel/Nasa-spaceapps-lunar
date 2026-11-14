# Follow-up: unfinished planned checks

2026-11-14, review branch feat/lunar-ephemeris-review, base 4b5f92cc147194294bb040dded7f9022280ee7f0.

## Completed in this pass

- Strict static TypeScript NodeNext/noEmit validation, including source/tests/tools. Initial check revealed module-scope/import.meta errors and an implicit array type. Added private module-local package.json containing only type:module, and explicit DirectionMeasurement type. No root/frontend/backend package or lockfile change. Compiler and Node types installed under approved temp directory, never committed.
- Extended same-model interpolation diagnostics to 14 days: first day of every 2026 month plus 2027-01-01 and 2028-01-01, 72 intermediate times per day, four sites including far side, two bodies. 8064 local direction comparisons; maximum 0.00010179975360847115 degrees; every day below 0.1 degrees. Does not extend bundled demo input coverage or independent Horizons coverage. Direct command was rerun by parent agent.
- Explicit numeric-overflow errors for finite yet huge input coordinates and combined observer heights, preventing invalid successful output.
- Regression tests for actual dataset without outlier warnings, deliberately discontinuous directions without silent mutation, exact zenith azimuth warning and overflow rejection.
- Exporter now rejects submillisecond and overlarge requests, validates UTC millisecond alignment and finite three-coordinate outputs, uses unique atomic temporary output, and unloads only kernels it loaded. Windows Unicode parent paths handled via relative kernel basenames with restored working directory. It is a sequential CLI; concurrent in-process calls are not supported.
- Module-local README documents input format, failure codes, reproducible checks and scientific limitations.

## Final verification

- Node test suite: 36 passed, 0 failed.
- Python exporter unittest suite: 5 passed, 0 failed, rerun by parent.
- Strict TypeScript checker: exit 0, no diagnostics.
- Real exporter CLI produced three real samples using local NAIF kernels; TypeScript createMoonFixedSampler successfully loaded output and interpolated 2026-01-01T00:15:00.000Z, finite result. Output remains in approved temp directory, not Git.
- Existing independent reference validator rerun: 78 directions, maximum 0.00775688093675673 degrees, passed.
- Initial Python resource-limit test used an incorrect interval and failed; corrected before final passing run.

## Remaining, not claimed complete

App backend/UI integration and ME terrain-frame conversion require agreed cross-agent contracts and are outside owned files. No complete app build or UI integration validation performed. Broad date sweep uses same SPICE model, not independent astronomical reference. Existing independent Horizons evidence still covers 3 sites over 2 hours. No automatic kernel download or larger production date dataset bundled. Performance figures remain prior measured sampler benchmark, not a new whole-app claim.

## Agent audit

Three nasa-luna subagents assigned disjoint exporter, static-check and date-sweep files. Date sweep produced actual report and was rerun. Static-check agent encountered a tool/model error after writing its script; parent ran compiler, fixed actual diagnostics and reran exit 0. Exporter was reviewed for duplicated validation and loop boundary concerns before final acceptance. No child committed or touched application ownership files.
