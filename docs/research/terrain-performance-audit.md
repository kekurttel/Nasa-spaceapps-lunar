# Terrain visibility quality and performance audit

## Scope and evidence

Read-only audit of the existing fixed global LOLA 4 pixels/degree workflow and registered-sky integration on `feat/horizon-visibility` at `7b11a45`. No production or test files were changed. The only file created is this audit. The checkout already contained untracked `docs/superpowers/plans/2026-11-14-terrain-quality-performance.md`; it was left untouched.

The current raster is PDS Geosciences LRO/LOLA `LDEM_4_FLOAT` V3.0, 1440 × 720 little-endian float32 values, 4 pixels/degree (~7.58084 km/pixel), radius offsets relative to 1737.4 km. Local inputs are `data/raw/lola_ldem_4_float.img` and `.lbl`, with product hashes enforced by `src/features/visibility/lola.mjs`. This is a real, coarse global LOLA product—not a high-resolution polar DEM and not suitable for landing-safety/local-hazard claims. No new external science source was accessed for this code/performance audit.

## Current path and costs

`loadLolaDem` verifies exact dimensions, product label fields and hashes, then allocates and decodes a second full grid (`Float32Array`, 4,147,200 bytes). The input raster is also resident (4,147,200 bytes), plus a small number of objects; expected core raster memory is therefore about 7.91 MiB before JS/runtime overhead, not a measured peak. `isVerifiedLolaDem` and horizon generation hash all 4,147,200 bytes again; each horizon build also checks the loaded DEM's hash. That check is an important mutation guard: typed-array contents remain mutable despite the containing object being frozen/treated as immutable, so any optimization that skips checks or memoizes by object identity can silently accept changed terrain. `WeakMap` identity tracks verified loaded DEMs; synthetic data is explicitly marked and separate.

For the default horizon (site -89.9°, 0°, observer 2 m; 5° bearings, 2 km radial step, 200 km range), generation samples 72 × 100 = 7,200 radial points. Each point independently computes great-circle coordinates with trigonometric operations and bilinearly samples the global grid. The product cost scales roughly with `ceil(maxDistance/distanceStep) × 360/azimuthStep`, plus full-grid hash/validation work. `run-real-terrain.mjs` loads the full raster and writes a result file on every invocation. The registered analysis additionally runs the Python SPICE registration generator and verifies the site/frame/terrain/kernel registration; that gate is a correctness constraint, not disposable overhead.

Sampling details that constrain optimization: longitude wraps periodically; latitude rows clamp at poles and use simple-cylindrical pixel-center coordinates. Bilinear interpolation at the pole combines longitude-varying values from the nearest row, which can create artificial slopes. The horizon routine warns when a ray enters the polar edge row; at this benchmark latitude and 200 km radius, it does. A polar-aware adapter must define azimuth and longitude behavior at the exact pole (azimuth is singular there) and must not treat current edge-row interpolation as physically valid polar topography. The spherical great-circle ray/elevation model, finite radius, and omitted terrain beyond max distance are also part of present semantics—not interchangeable with a projection/ray-tracing rewrite without tests.

## Local execution evidence

Commands run from the repository root:

- `node --test tests/*.test.mjs` — passed; TAP output reported 67 source lines / 692 items after harness compression, including real DEM, registration, runner and integration coverage. No failure was reported.
- `python -m unittest discover -s tests -p 'test_*.py'` — 8 tests passed.
- Three direct invocations of the real `runRealTerrain()` using the checked-in verified DEM, same site and 200 km maximum range, varying only angular/radial sampling. Timings are wall-clock milliseconds from `performance.now()` around each complete runner call (including file reads, DEM decode/hash, horizon and output write). These are small, noisy local runs, not a formal benchmark; no peak memory profiler was used.

| Sampling (bearing step / radial step / max) | Nominal radial evaluations | Three wall times (ms) | Result |
|---|---:|---:|---|
| coarse 20° / 10 km / 200 km | 360 | 13.05, 7.95, 7.78 | 18 bearings |
| default 5° / 2 km / 200 km | 7,200 | 10.30, 8.06, 7.85 | 72 bearings |
| finer 2.5° / 1 km / 200 km | 28,800 | 12.06, 10.25, 15.81 | 144 bearings |

A matched-bearing comparison (every fourth default bearing against every second fine bearing, corresponding to the same azimuth) gave maximum absolute horizon differences of **14.33°** for coarse versus default, and **4.59°** for default versus fine. These are sampling-sensitivity observations on this DEM/site, not accuracy/error bounds against lunar truth. Coarser sampling missed large maxima; finer sampling changed horizons materially while increasing nominal work 4×. Angular interpolation can also miss narrow azimuthal peaks. At ~7.58 km pixel spacing, shrinking the 1–2 km ray step does not add terrain information; it repeatedly interpolates the same coarse grid. No claim of improved DEM resolution or scientifically improved accuracy follows from the finer run.

## Quality constraints and recommendations

1. **Do not claim high-resolution support by changing steps alone.** The available fixed global product cannot resolve local hazards, and current polar cap interpolation is specifically unreliable for a polar local horizon. Preserve explicit coarse-product warnings and report data coverage/limitations.
2. **Prioritize a bounded-memory polar product adapter as a separate gated design.** Identify and validate an appropriate polar LOLA-derived product first; confirm mission/product provenance, label, horizontal/vertical reference, units, nodata, coverage, projection, pixel centers and license/attribution. Keep the current product path supported until an adapter is validated. Do not invent URLs, reinterpret QuickMap/Moon Trek imagery as elevation, or imply the chosen product is pure LOLA if it is a fusion.
3. **Bound memory before increasing raster resolution.** Crop/window or tiled access should load only the verified area required for site plus radial coverage, with explicit margin and missing-data handling. Retain immutable identity/content integrity or equivalent verifiable hashes for each source tile; do not trust a mutable typed array based on a one-time hash. Avoid unbounded per-ray caches. Document peak memory and I/O under the actual runner before claiming improvement.
4. **Establish algorithmic correctness before speed tuning.** Add adapter-focused tests (not implemented here) for known label/georeferencing fixtures, coordinate round trips, east/west longitude wrapping, seam and pole behavior, exact-pole azimuth policy, nodata propagation, bilinear pixel-center interpolation, mutation after verification, and edge-of-coverage failure. Compare the adapter against an independent small reference calculation and verify radial-distance coverage rather than silently extrapolating/clamping.
5. **Then profile the real workflow.** Separate timings for load/decode/hash, horizon sampling, Python SPICE registration and serialization; measure peak resident memory with a repeatable tool and warm/cold runs. Only optimize a measured dominant cost. Any reusable cache key must incorporate product/version/content hash, coordinates, frame, interpolation/model and all sampling options.

The Python registration generator and strict registration gate were exercised by the passing tests, but the timing table measures the terrain-only runner, not end-to-end registered analysis. This audit did not run or certify a new high-resolution DEM, a real Horizons site query, a polar adapter, memory profiling, or NASA-source compliance as an integrated product workflow.
