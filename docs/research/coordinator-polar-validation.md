# Coordinator independent polar validation — 2026-11-14

This records performed checks, not acceptance of the whole feature. Producer and runner remain under development.

## Actual product bytes and independent pixel calculation

Coordinator streamed SHA-256 of local source files, compared against recorded official download manifest, opened JP2 using Rasterio directly (without `polar_lola.compute_horizon`), transformed site with PyProj, read the four neighboring pixels and independently computed bilinear surface height.

- Raster: 29,837,992 bytes, SHA-256 `c088dd4f510e879375ee7e6f0d320ba84115f535f45fb592dd7f83a7d2e83ae3`.
- Label: 6,354 bytes, SHA-256 `497512747bb56490d50cf3f4945f2cb736bf61cd19b65fa61a826825e2a35d79`.
- Raster driver `JP2OpenJPEG`, shape 7600×7600, signed int16, decoded `nodata=None`. Do not invent a sentinel not declared by product; masked values are rejected when present.
- Affine corner origin (-304000 m, +304000 m), pixel size (+80 m, -80 m), zero rotation.
- CRS Moon2000 south-polar stereographic, spherical radius 1737400 m, latitude of origin -90°, central meridian 0°.
- Site latitude -89.9°, longitude 0°: zero-based pixel-center coordinates column `3799.5`, row `3761.595802347916`.
- Neighbor DNs `[[1201,1248],[1251,1290]]`; independent bilinear DN × 0.5 gives surface height `625.9534540020704 m` above 1737400 m sphere. Observer at 2 m therefore has radius `1738027.9534540022 m` (rounding at float precision).
- This differs from coarse global DEM's 96.89049795269966 m at same nominal site. Different grids/interpolation can differ strongly in polar terrain; difference is not a measured absolute accuracy improvement or landing-safety validation.

## Checks run

- Existing Node suite excluding new polar test file: 58 passed, 0 failed/skipped.
- Existing registered-sky Python suite: 8 passed, 0 failed/skipped.
- New polar Python suite at this checkpoint: 9 passed, 0 failed/skipped, including real downloaded product.
- New polar Node suite at this checkpoint: four input/parser tests passed; these did not exercise actual runner execution.
- Actual new runner smoke invocation failed with `DEFAULT_MANIFEST is not defined`. Finding sent to owner; this explicitly blocks acceptance until repaired and actual pipeline rerun. `node --check` alone cannot detect such missing runtime identifiers.

## Independent terrain sampling benchmark

Actual product, site -89.9°/0°, observer **2 m**, full-circle, requested 200 km, one run per configuration in this process. Output retained locally at ignored `output/coordinator-polar-benchmark.json`.

| Azimuth interval | Radial interval | Wall seconds | Actual sampled maximum | Elevation min/max (degrees) |
|---|---|---:|---:|---|
| 5° | 240 m | 2.6828635 | 199920 m | -1.8959378 / +22.3995454 |
| 5° | 80 m | 5.0201464 | 200000 m | -1.8943164 / +22.3995454 |
| 2.5° | 240 m | 3.8575515 | 199920 m | -2.0881130 / +22.3995454 |

Maximum shared-bearing radial-sampling difference between 240 m and 80 m: **0.4455805602851015°**. Choose **80 m default** despite approximately 1.87× wall time in this single run, to align with nominal DEM cells and reduce measured radial sensitivity. This is convergence/sensitivity evidence, not absolute physical accuracy. At common bearings 2.5°/240 m and 5°/240 m naturally agree because they evaluate identical rays; this does not prove angular convergence between rays. Five-degree bearing gaps can miss narrow ridge maxima. Timing is machine/cache dependent, no CPU/RSS acceptance claim from these values alone.

## Actual Windows process memory probe

Separate Python process, actual 5°/80 m/200 km terrain calculation, using Windows `GetProcessMemoryInfo` after computation (`GetCurrentProcess` handle and structure signatures declared): wall **5.3904174 s**, peak working set **217,829,376 bytes (~207.74 MiB)**, end working set **82,075,648 bytes (~78.27 MiB)**, peak private commit **967,081,984 bytes (~922.28 MiB)**. This includes Python, NumPy, Rasterio/GDAL, PROJ and codec allocations. GDAL cache setting of 64 MiB is **not** a 64 MiB whole-process cap. Small requested windows do not prove proportional codec memory; OpenJPEG can use large internal allocations. This measured commit cost is a material performance limit, especially for concurrent analyses. Node orchestration and SPICE child memory were not included in this terrain-only probe.

A separate experiment setting both `GDAL_NUM_THREADS=1` and `OPJ_NUM_THREADS=1` before imports took **8.3449854 s**, peak working set **211,996,672 bytes**, peak private commit **960,466,944 bytes**. Small memory reduction did not justify slower runtime as a default. No claim of whole-process bounded memory follows from windowed reads/cache settings; no concurrency cap is implemented by this standalone CLI.

Reproduction script added: `python scripts/measure-polar-memory.py` (Windows only). Coordinator ran it successfully: **5.0486381 s**, peak working set **217,706,496 bytes**, peak private commit **967,024,640 bytes**. Optional `--single-thread` repeats the thread-setting experiment. This script reads the exact original label bytes before ASCII decoding to preserve source hash line endings.

## Real default end-to-end runner — coordinator rerun

`node scripts/run-polar-analysis.mjs --output output/coordinator-polar-default.json` exited 0 after runtime-reference repairs. Coordinator parsed actual JSON: `registrationValidation.valid === true`, every recorded registration check true; surface height `625.9534540020395 m`, observer radius `1738027.953454002 m`, matching official raster hash, `MOON_ME_DE421`, local `ME_DE421_LOCAL_NORTH_EAST`, aberration correction `NONE`. Three UTC samples: 2026-11-14T00:00:00Z, 00:05:00Z, 00:10:00Z. Default intervals 5° azimuth / 80 m radial, actual/requested maximum 200000 m. Instrumented child stages: terrain **5293.6011 ms**, sky **149.3474 ms**, sum **5442.9485 ms** (not complete parent wall time including hashes and serialization).

This successful full workflow does not supersede test failures found concurrently: latest Node polar suite had one stale scenario-ID assertion; latest Python suite had two dict-label type errors. Owners received exact traces; full acceptance remains blocked until repaired suites rerun and review closes.

## Remaining gates

Real default runner, fixed source verification, actual/requested partial-range metadata, measured radial sensitivity and process-memory observations are recorded above. Latest coordinator full-suite checkpoint: **64 Node tests passed, zero failed/skipped; 25 Python tests passed, zero failed/skipped**. Six download tests use explicitly synthetic mocked transport and prove failure/atomic-replacement behavior, not real network correctness. After owners stopped editing, coordinator reran full suites: **64 Node / 26 Python passed, zero failed/skipped**. Final default CLI `node scripts/run-polar-analysis.mjs --output output/coordinator-polar-final.json` exited 0; parsed JSON registration checks all true, actual 200000 m maximum and 80 m interval. Child stages: terrain 5277.9723 ms, sky 151.3094 ms, sum 5429.2817 ms; surface 625.9534540020395 m, observer radius 1738027.953454002 m. Final independent read-only reviewer reported no remaining critical issue after re-reading current code: geographic ray bounds, raster NoData/bounds and actual/requested distances fail/report explicitly. Earlier undefined-helper finding was stale and closed against current file and coordinator passing real integration test. Branch-only commit/push follows verification; no claim of backend/UI or all-source integration. Angular convergence/absolute terrain accuracy, backend/UI integration, QuickMap visual inspection and Horizons surface registration are not established.
