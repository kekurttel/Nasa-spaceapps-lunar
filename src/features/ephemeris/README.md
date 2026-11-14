# Offline lunar ephemeris module

New polar-shadow input: [Solar vectors v1.0.0](./SOLAR_CONTRACT.md), explicit DE421 / MOON_ME_DE421 / NONE. This is separate from the IAU_MOON API below; no implicit frame conversion.

Pure entry point: `computeSkySeries(scenario, dataset)` from `index.ts`. No network calls or implicit synthetic fallback. Root application is not wired to this module yet.

## Reproduce checks

Node 24.22 or compatible native TypeScript stripping:

```sh
node --experimental-strip-types --test src/features/ephemeris/tests/*.test.ts
node --experimental-strip-types src/features/ephemeris/tools/validate_reference.ts
node --experimental-strip-types src/features/ephemeris/tools/benchmark.ts
```

Python exporter unit tests require Python only (mock SPICE):

```sh
py -m unittest src.features.ephemeris.tests.test_export_vectors -v
```

Refreshing reference data explicitly requires network access:

```sh
node src/features/ephemeris/tools/fetch_horizons.mjs
```

Runtime never refreshes reference fixtures automatically. Benchmark measurements vary with hardware and load; compare repeated medians, not one run.

## Inputs and scientific boundaries

- Scenario UTC strings accept `YYYY-MM-DDTHH:mm:ssZ` and optional 1–3 fractional digits. Output is canonical `.sssZ`. Leap seconds and timezone offsets are rejected. Dates are validated by round-trip conversion.
- Step must resolve to positive integer milliseconds, maximum 100000 output samples. Start included; end included only if grid aligned.
- Longitude east-positive [-180,180], latitude [-90,90], exact geographic poles rejected because north/azimuth is undefined.
- Surface elevation in metres relative to the 1737.4 km reference sphere. Negative elevation valid. Null assumes 0 with warning. Observer height metres above surface, nonnegative.
- Target vectors kilometres from Moon centre, geometric `IAU_MOON` coordinates. Do not supply ME/PA or apparent vectors under this label. Terrain integration must resolve the frame difference explicitly.
- Dataset must have at least two strictly ascending UTC-indexed samples, finite vectors and source metadata. No extrapolation. Linear interpolation performed on Cartesian vectors, not wrapped angles.
- Real is source classification, not accuracy certification. Finite but suspicious distances/direction jumps produce warnings; values are never silently clipped or repaired.
- All SkySeries arrays share the same UTC indices. Azimuth [0,360), clockwise from north; altitude relative to local tangent plane. No terrain horizon or refraction.
- Exact zenith/nadir compass angle is undefined; numeric atan2 convention retained for array contract with explicit warning. Use direction-vector separation, not azimuth alone, for comparisons.
- Exported geometric vectors exclude light-time and aberration; independent Horizons apparent comparisons therefore include correction/model differences. Production data is never relabeled to conceal that difference.

`createMoonFixedSampler(dataset)` validates/snapshots once and supports repeated O(log N) sampling. `sampleMoonFixedVectors` retains one-shot convenience; avoid calling it in a large loop. `computeSkySeries` already uses the reusable sampler.

## Failure codes

Errors expose `.code`; failed computations throw, never return empty successful arrays.

| Prefix/code | Meaning |
| --- | --- |
| EPHEMERIS_DATA_UNAVAILABLE | Explicit source dataset required |
| EPHEMERIS_INVALID_DATASET / INVALID_METADATA / INVALID_SAMPLES / INVALID_VECTOR / INVALID_DATE | Invalid vector dataset, provenance, frame, dates or values |
| EPHEMERIS_OUT_OF_RANGE | Request beyond source coverage |
| EPHEMERIS_INVALID_SCENARIO / INVALID_UTC / INVALID_TIME_RANGE / INVALID_STEP / SAMPLE_LIMIT | Invalid scenario time grid or resource limit |
| EPHEMERIS_INVALID_LATITUDE / INVALID_LONGITUDE / INVALID_OBSERVER_HEIGHT / INVALID_SURFACE_ELEVATION | Invalid scenario coordinates or heights |
| EPHEMERIS_POLAR_AZIMUTH | Exact pole has no local north bearing |
| EPHEMERIS_DISTANCE_RANGE | Target distance arithmetic overflow |

Additional low-level coordinate argument codes are declared as the `EphemerisErrorCode` union in `coordinates.ts`.

## Integration policy

`computationPolicy` declares error-on-failure, no automatic synthetic fallback, and an explicitly flat local tangent horizon by default. Terrain use additionally requires frame/height validation; a passed gate does not turn on terrain automatically. It does not modify or control the existing Python backend by itself. Agent 5 must wire this explicit policy into its adapter; no third science engine is introduced.

`assertCompatibleTerrain` refuses unmatched lunar frame, radial height reference or reference radius. Current DE421 ME terrain is NOT compatible with bundled IAU_MOON vectors without a measured transformation. A passed metadata gate is not independent scientific validation.

`sampleDurationsSeconds(timesUtc, endUtc)` defines half-open state support intervals: the exact end boundary has zero duration; an irregular final segment ends at endUtc. Never use `timesUtc.length * stepSeconds` for total duration. Agent 4 remains owner of visibility windows and AnalysisResult, including event interpolation.

Agent 1’s sample budget counts half-open state intervals; this module can include one additional zero-duration end boundary. Budget adapters must account for that extra boundary; this is not an extra mission interval.

## Prepared observer projection

`createLocalSkyProjector(latDeg, lonDeg, surfaceElevationM, observerHeightM)` prepares a per-call observer/basis closure for repeated target projections. It caches no global site data. Every target still receives finite, distance-overflow and zero-direction checks. `localSkyDirection` retains its one-shot API and target-before-site validation order. `computeSkySeries` initializes its projector only after the first successful vector sample, preserving out-of-range error precedence. Projection arithmetic and angular-radius calculation remain unchanged.

Reproduce exact full-series comparisons against pinned pre-optimization code and local-only timing:

```sh
node --experimental-strip-types src/features/ephemeris/tools/compare_prepared_series.ts
node --experimental-strip-types src/features/ephemeris/tools/benchmark_observer.ts
```

Both tools require Git history containing commit `f4252d39970d2a5cf458a96541a4b28247fc563f` and a Node version supporting `node:module.stripTypeScriptTypes`. Benchmark compares coordinate projection only; it does not measure app or full-series speedup.

## Review evidence

`fixtures/validation-report.json`: independent Horizons comparison. `interpolation-spice-report.json`: direct SPICE vs linear interpolation, same model. `date-coverage-report.json` when present: diagnostic date sweep, not extension of bundled demo coverage. `residual-diagnosis.json`: controlled correction-choice comparison, not proof assigning every residual to a single cause.

See `docs/team/02-ephemeris-measurements.md` for measured bounds and limitations. Large kernels and installed dependencies must stay outside Git.
