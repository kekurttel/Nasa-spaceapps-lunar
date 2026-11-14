# Solar vectors v1.0.0 — polar shadow input

The authoritative new solar API is **DE421 / MOON_ME_DE421 / NONE**, matching pinned Agent3 registered-sky. Existing IAU_MOON SkySeries remains separate. Never pass these vectors into the old IAU_MOON dataset API, relabel one frame as the other, or use the old IAU-only terrain gate for this path. `projectSolarVector` checks this new frame explicitly; it is not a terrain-registration certificate.

## Contract

`SolarVectorDataset` in `solarVectors.ts`:

| Field | Meaning |
| --- | --- |
| `schemaVersion` | `1.0.0`; unknown/missing fields rejected |
| `timesUtc` | Strictly increasing UTC, seconds or 1–3 fractional digits, `Z` only |
| `sunPositionMoonFixedKm` | `{x,y,z}[]`, Moon centre → Sun centre, MOON_ME_DE421, km |
| `sunDistanceKm` | Norm of Moon-centre vector, not site distance |
| `sunAngularRadiusDeg` | `asin(695700 / sunDistanceKm) * 180/pi` |
| `frame`, `ephemerisKernel`, `aberrationCorrection` | `MOON_ME_DE421`, `DE421`, `NONE` |
| `dataKind`, `origin`, `direction`, `units` | `real`, `MOON`, `MOON_TO_SUN`, `km` |
| `source` | Name, HTTP(S) URL, four SHA-256 kernel hashes |
| `coverage` | Verified conservative kernel UTC interval, not a promise every epoch is sampled |
| `warnings`, `numericalLimitations` | Scientific/clock/numerical limits; keep downstream |

Arrays align and contain 1–100000 epochs per artifact. Finite norms must be in a conservative 130–170 million km envelope (a gross sanity check, NOT an ephemeris accuracy bound). Stored distance/radius consistency uses `64 * Number.EPSILON` relative allowance for floating arithmetic; this is NOT physical uncertainty. Metadata validation cannot authenticate claimed source bytes; the Python producer verifies byte hashes and pins the Agent3 kernel family. Test fixtures with fictional vectors are explicitly software tests, never production artifacts.

`validateSolarVectorDataset(unknown)` validates an artifact. `createSolarVectorLookup(dataset)` snapshots it and serves exact timestamps only: `EPHEMERIS_MISSING_EPOCH` inside coverage when unsampled, `EPHEMERIS_OUT_OF_RANGE` outside. No interpolation/extrapolation.

`projectSolarVector(sample, terrainFrame, observer)` subtracts the radial spherical observer in the SAME frame and produces north-clockwise azimuth, tangent-plane elevation, **topocentric** range and radius. Moon-centre quantities remain separately named. Exact-pole azimuth is rejected. Raster illumination must subtract each cell's body-fixed position separately; one site's angles cannot illuminate a whole raster.

## Generator and sources

```sh
python src/features/ephemeris/tools/generate_solar_vectors.py --request request.json --output solar.json --kernels-dir KERNEL_DIRECTORY
```

Request minimal shape is `{"timesUtc":["2000-01-01T00:00:00Z","2019-01-01T00:00:00Z"]}`. Optional family metadata must agree exactly. This computes just those two epochs; it does not compute intervening years.

Supply pinned `manifest.json` and `de421.bsp`, `moon_080317.tf`, `moon_pa_de421_1900-2050.bpc`, `naif0012.tls` from Agent3 commit `e241cee6d9f149767379a4891cb0344cf2a7d28d:data/kernels/`. Official URLs and byte hashes are in `fixtures/de421-coverage-report.json`. LFS pointers are not kernels. No automatic download/install or synthetic fallback. CLI uses isolated SPICE/cwd state; do not share concurrent SPICE operations. Output replacement is atomic after successful computation.

## Coverage and temporal planning

Measured common SPK/PCK native domain: `[-3155716800, 1609416000]` TDB seconds past J2000. Conservative LSK-derived labels: `1899-12-31T23:59:19Z` to `2050-12-31T23:58:49Z`. Binary PCK is limiting. Historical pre-1972 civil clocks and unknown future leap seconds are NOT certified by this interval.

Verified study window: 2000-01-01 to 2019-01-01 (19 calendar years). Coverage is sufficient for a nodal-cycle investigation, not evidence a PSR study or convergence analysis was completed.

```ts
for (const timesUtc of planEpochChunks(startUtc, endUtc, 6 * 3600_000, coverage, 4096)) {
  // Send each explicit batch to the real generator. Six hours is screening only.
}
```

- `planEpochChunks`: lazy, bounded batches, exact endpoints (last step may be shorter).
- `planRequestedEpochChunks`: merge explicit coarse/dense/targeted intervals, sorted and deduplicated, memory O(interval count + batch size). Merge CPU is O(epoch count × interval count); avoid millions of overlapping input intervals.
- `refineTransitionWindows`: heuristic crossing/zero/slope-reversal brackets from supplied local altitudes; padding is clipped to supplied span. Feed windows back as denser requests. No invented intermediate Sun vectors or solved event times.

Coarse samples can miss brief sunlight, terrain-horizon contacts, solar-disc limb contacts and unsampled tangencies. A fixed sampling cadence cannot prove permanent shadow. Shadow engine must choose and validate its own convergence/event strategy.

## Reproduce validation

```sh
python src/features/ephemeris/tools/solar_coverage.py --kernels-dir KERNEL_DIRECTORY --output coverage.json
python src/features/ephemeris/tools/compare_registered_solar.py --kernels-dir KERNEL_DIRECTORY
node --experimental-strip-types src/features/ephemeris/tools/validate_solar_reference.ts
node --experimental-strip-types --test src/features/ephemeris/tests/*.test.ts
```

Python tests: set `SOLAR_KERNELS_DIR`, then `python -m unittest discover -s src/features/ephemeris/tests -p 'test_*.py' -v`. Without kernels, real-kernel tests explicitly skip; that is not full validation. Comparison requires pinned Agent3 Git object, obtainable with `git fetch origin feat/horizon-visibility`. Do not substitute a mock if history is unavailable.

Predeclared engineering agreement: angles `1e-8°`, distances/components `1e-5 km`; rationale and actual residuals are in `docs/team/02-solar-validation.md`. Same-model implementation agreement is not independent observational validation. Handoff: `docs/team/02-solar-shadow-handoff.md`.
