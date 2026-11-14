# Ephemeris compatibility audit

Scope: read `son.md`, `agent2.md`, the four production modules under `src/features/ephemeris/`, existing tests, and the real-vector/provenance/validation fixtures. This audit added only `src/features/ephemeris/tests/compatibility.test.ts` and this report. No production fixes are made here.

## Contract and reviewed evidence

1. **Contract / units / frame:** `index.ts` exports aligned degree arrays and `quality`; `scenario.ts` validates geographic coordinates, metres, and UTC millisecond grid; `vectorData.ts` accepts only `IAU_MOON`, geometric vectors and UTC timestamps, interpolated in km; `coordinates.ts` applies a spherical 1737.4 km Moon and local north/east/up transform. The fixture provenance states `spkpos(..., "IAU_MOON", "NONE", "MOON")`, km, UTC via `str2et`. This is explicit geometric Moon-centred input, not a light-time-corrected apparent direction; do not conflate it with Horizons apparent results.
2. **Evidence E1 — confidence warning mismatch:** `index.ts:47` adds “Bundled DE440s dataset was compared…” to every dataset, including user-provided synthetic or unrelated real data. `integration.test.ts:22-37` currently feeds a deliberately synthetic axis fixture and asserts only broad warnings; it can thus appear to inherit bundle validation. The compatibility test documents current behavior without encoding it as desirable. Recommendation: make this warning conditional on a verified dataset identity/provenance, or move it to bundle documentation; report validation status separately from dataset source.
3. **Evidence E2 — no outlier / physical plausibility validation:** `vectorData.ts:91-96` checks only finite components. A finite but nonsensical vector passes as `dataKind: 'real'`; e.g. compatibility diagnostic changes a Sun vector from ~1e8 km to 1 km and confirms no outlier warning. There is also no adjacent-sample discontinuity or body-distance sanity bound. Recommendation: validate physically justified magnitude / continuity ranges with explicit configurable limits or mark quality unknown; do not silently impose arbitrary limits on all datasets.
4. **Evidence E3 — angular radius & observer radius:** `coordinates.ts:69-70` computes observer radius using `(surfaceElevationM + observerHeightM)/1000`, and rejects nonpositive radius; `angularRadiusDeg` uses `asin(radius/distance)` (valid apparent angular radius of a sphere for observer-target centre distance). `index.ts:73` uses fixed solar radius 695700 km. There is no explicit Sun-distance plausibility check beyond finite components, and no regression coverage of bad finite Sun distance/near-zero radius in the API. Recommendation: preserve the exact spherical formula but validate expected solar distance/source quality and test radius at close/far plausible distances; report assumptions.
5. **Evidence E4 — zenith azimuth singularity semantics:** `coordinates.ts:87-89` computes azimuth from `atan2(east,north)` even when horizontal projection is zero/nearly zero, yielding a numeric convention (often 0) despite undefined bearing. Exact geographic poles are explicitly rejected in scenario and coordinate code, but this distinct target-at-zenith singularity is not. Near-zenith azimuth is ill-conditioned. Recommendation: document/represent undefined or flag azimuth when horizontal magnitude is below a stated threshold; tests should assert direction-vector accuracy rather than azimuth alone there.
6. **Evidence E5 — hot path:** `computeSkySeries` calls `sampleMoonFixedVectors` per time (`index.ts:63-64`); that helper creates/validates/copies the entire dataset and builds timestamps (`vectorData.ts:101-110,144-146`) on every call. With a 25-point fixture and up to 100,000 scenario points (`scenario.ts:30,80-85`), this repeats O(dataset samples) validation/copy work per output point, rather than create one sampler and binary-search per time. Recommendation: instantiate `createMoonFixedSampler(dataset)` once per computation. Dataset snapshotting is still useful, just not repeatedly within the loop.
7. **Evidence E6 — interpolation and UTC semantics:** sampling uses linear Cartesian interpolation between UTC-labelled samples (`vectorData.ts:100-139`); no UTC/TDB conversion occurs, as documented. This may be acceptable for short cadence but accuracy is cadence-dependent and no between-grid accuracy claim is supported. `index.ts:46-47` warns about this, though the bundle-specific comparison is overgeneralized. Recommendation: maintain explicit source time conversion provenance and validate interpolation at additional independent between-sample epochs/cadences.
8. **Evidence E7 — data coverage / errors:** sampler rejects out-of-coverage queries with `EPHEMERIS_OUT_OF_RANGE` and does not extrapolate (`vectorData.ts:113-117`). Missing dataset throws `EPHEMERIS_DATA_UNAVAILABLE` (`index.ts:36-40`). Scenario count cap is 100,000. `computeSkySeries` builds the full timestamp array and then synchronously computes results; this is deterministic but can be a main-thread latency/memory concern at cap, especially combined with E5. Consider streaming/chunked API only if consumers require large intervals.
9. **Evidence E8 — source attribution is structural, not cryptographic:** dataset validation requires nonempty `source`, absolute `sourceUrl`, frame/time/correction labels, but cannot prove those claims. Fixture `kernel-report.md` records hashes for DE440s/PCK/LS; fixture JSON has source labels. Recommendation: distinguish declared provenance from verified provenance, and verify fixture hashes in tooling/CI if the files are available.
10. **Reference limitation:** `validation-report.json` records 18 directions (3 sites × 3 hourly epochs), max separation ~0.0077569°, explicitly comparing geometric DE440s vectors to Horizons apparent results and explicitly disclaiming between-grid accuracy. This supports only those recorded points and mixed correction comparison; it does not certify arbitrary user datasets, interpolation, or all dates.

## Added test and execution

Added `src/features/ephemeris/tests/compatibility.test.ts`. It checks fixture first/middle/last sample shape and provenance presence; characterizes the generic warning and finite-vector outlier gap; checks invalid observer radius and near-zenith output semantics; and checks the recorded validation-report scope. These assertions are diagnostic where the current API has a known gap: they pass while making the behavior visible, rather than claiming the behavior is correct.

Run command requested: `node --experimental-strip-types --test src/features/ephemeris/tests/compatibility.test.ts`

Raw result:

```text
✔ fixture first/interior/last samples are finite and have traceable source metadata
✔ quality warnings describe the selected dataset rather than a particular bundle
✔ plausible-but-outlier finite vectors are not rejected or quality-flagged (diagnostic characterization)
✔ observer radius, near-zenith azimuth and angular-radius semantics are explicit
✔ saved reference data has expected coverage, but does not validate arbitrary dataset interpolation
ℹ tests 5
ℹ pass 5
ℹ fail 0
ℹ duration_ms 246.7204
```

An initial run exposed four assertions based on incorrect audit assumptions (the saved reference has 78 records, outlier needed a Sun distance greater than the solar radius, provenance text uses code formatting, and a good fixture is not a bad-radius zenith vector). Those were corrected; final raw run above is clean.

## Scope / deliverable status

Only the two requested paths were written by this audit agent. No source fix, commit, or SHA is claimed. Full existing test suite was not run; independent new ephemeris comparison was not performed. Main agent should address E1, E4, and E5 first, then add principled data-quality bounds / provenance verification without rejecting valid arbitrary datasets on unexplained heuristics.
