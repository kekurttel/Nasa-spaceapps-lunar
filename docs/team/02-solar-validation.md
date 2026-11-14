# Solar validation: actual DE421 implementation cross-check

## Scope and provenance

Executed successfully on 2026-11-14 with SpiceyPy 8.4.0. This is **independent implementation validation against the same SPICE/DE421 model**, not an independent astronomical source, observational accuracy claim, or validation against Horizons. All evaluated positions are real kernel calculations, not synthetic fixtures.

- Reference branch query: `git rev-parse origin/feat/horizon-visibility` returned `e241cee6d9f149767379a4891cb0344cf2a7d28d`.
- Immutable reference: `git show e241cee6d9f149767379a4891cb0344cf2a7d28d:src/features/visibility/registered-sky.py`.
- The unchanged source bytes were loaded as a Python module from an approved temporary directory. Its actual `generate()` function was called for four sites. No Agent3 source edits or replicated stand-in generator.
- Actual new generator called: `src/features/ephemeris/tools/generate_solar_vectors.py`, API `generate({"timesUtc": times}, kernels_dir=directory)`. Parent rerun evaluated source SHA-256: `f63467c03ce634039d799a085ca2e1238fdaadf5414f962688461b608017ce2e`.
- Shared kernels read from `C:\Users\Oğuz Eren\AppData\Local\Temp\opencode\de421-solar-kernels`. The validator did not download or write kernels. It verified every byte count and SHA-256 against the full pinned Agent3 manifest, and required manifest equality. Official NAIF URLs, hashes, and byte counts are preserved in the result fixture.
- To avoid CSPICE Unicode absolute-path problems, the unchanged Agent3 module ran with cwd set to the kernel directory and `kernels_dir="."`; CSPICE therefore received ASCII relative filenames. cwd is restored afterward. Use an isolated process: SPICE state/cwd are process-global.

## Independent local calculation

The validator separately calls `spice.spkpos("SUN", et, "MOON_ME_DE421", "NONE", "MOON")`. Agent3 uses `spkezr`; neither its local-basis helper nor projection helper is reused. The reference subtracts the spherical observer position then expands scalar north/east/up components explicitly. Azimuth is `atan2(east,north)` modulo 360; altitude is `atan2(up,hypot(north,east))`, independently of Agent3's `asin(up/distance)` implementation. Norms use `math.hypot` instead of Agent3's sum-of-squares square root.

Observer contract: lunar radius 1,737,400 m, surface height 0 m, observer height 2 m. The all-zero terrain hash is a registration placeholder for this ephemeris-only comparison, **not a claim to measured terrain**. Sites are `(-80,0)`, `(-85,45)`, `(-89.5,135)`, `(-89.9,-90)` in latitude/east-longitude degrees. Epoch dates are 2000-01-01, 2009-04-01, 2018-08-01, 2026-01-01; each has 00:00, 06:00, 12:00, 18:00 UTC. Total: 16 epochs, 64 site/epoch comparisons. This is a finite regression sample, not proof over all dates/sites.

Agent3 does not expose topocentric Sun distance. The fixture explicitly labels its distance as reconstructed from its actual radius using `695700 / sin(radiusRadians)` km. It is not an independently emitted Agent3 distance and shares the radius information. Direct-reference center distance is recorded separately.

## Acceptance criteria fixed before evaluation

- Angular quantities: `1e-8` degree for circular azimuth, altitude, topocentric angular radius, and center angular radius.
- Distances and vector components: `1e-5` km (1 cm).

These are deliberately loose **engineering implementation-agreement tolerances**, not scientific uncertainty estimates. IEEE-754 binary64 epsilon is about `2.22e-16`; at solar distance (~`1.5e8` km), elementary-operation roundoff is of order `1e-8` to `1e-7` km. A 1 cm allowance comfortably covers arithmetic reordering and inverse-trigonometric distance reconstruction. Angular propagation away from singular directions is of order machine epsilon in radians; `1e-8` degree provides a substantial guard margin for trigonometric/library differences. Azimuth is ill-conditioned near zenith/nadir, with amplification proportional to inverse horizontal-direction fraction. These selected polar samples are not near that singularity: minimum measured horizontal fraction is `0.9832611189520989`. This test does not establish a universal near-zenith azimuth tolerance. Circular residual is `abs((actual-reference+180) % 360 - 180)`.

## Actual results

All predeclared checks passed:

| Quantity | Maximum absolute residual |
| --- | ---: |
| Circular azimuth | 0 degrees |
| Altitude | 1.7763568394002505e-15 degrees |
| Topocentric solar angular radius | 5.551115123125783e-17 degrees |
| Reconstructed topocentric distance | 5.960464477539063e-08 km |
| New-generator center vector component | 0 km |
| New-generator center distance | 0 km |
| New-generator center angular radius | 0 degrees |

Zero residuals reflect identical model/frame/kernel evaluation, not infinite physical precision. Full actual Agent3 outputs, the actual new-generator output, independent reference values, signed topocentric-minus-center radius differences, and residuals are retained in `src/features/ephemeris/fixtures/de421-solar-validation.json`.

## Intentional center/topocentric distinction

The new vector-series contract's `sunDistanceKm` and `sunAngularRadiusDeg` are **Moon-center** values (not Earth-geocentric and not topocentric). Agent3's `sunRadiusDeg` is **observer/topocentric**, using distance after observer subtraction. They must not be directly asserted equal. In this run, topocentric-minus-center angular radius ranges from `-3.19900127887518e-7` to `5.805464527441906e-7` degrees, exceeding the numerical-agreement tolerance in some samples by design.

The project's local conversion in `src/features/ephemeris/solarVectors.ts` computes `angularRadiusDeg(SOLAR_RADIUS_KM, sky.distanceKm)`: it correctly uses topocentric distance while retaining `moonCentreDistanceKm` and `moonCentreAngularRadiusDeg` separately. Parent also executed `tools/validate_solar_reference.ts` and `tests/solarRegistered.test.ts`: actual Python generator output passed strict TypeScript validation and all 64 local projections matched the same real Agent3 outputs. Maximum TS residuals: circular azimuth 0°, altitude `3.552713678800501e-15°`, angular radius `5.551115123125783e-17°`, reconstructed topocentric distance `5.960464477539063e-8 km`. Same predeclared tolerances were used without adjustment.

## Reproduce

From repository root, with SpiceyPy available:

```powershell
$env:PYTHONPATH = Join-Path $env:LOCALAPPDATA 'Temp\opencode\pydeps'
$python = Get-ChildItem 'C:\Users\*\AppData\Local\Python\pythoncore-3.14-64\python.exe' | Select-Object -First 1 -ExpandProperty FullName
& $python src/features/ephemeris/tools/compare_registered_solar.py --kernels-dir "$env:LOCALAPPDATA\Temp\opencode\de421-solar-kernels" --temp-dir "$env:LOCALAPPDATA\Temp\opencode"
node --experimental-strip-types src/features/ephemeris/tools/validate_solar_reference.ts
```

Default output is the module's `fixtures/de421-solar-validation.json`; `--generator` and `--output` can override paths. Missing generator, reference object, kernels, manifest mismatch, or SPICE errors fail explicitly; there is no fake-data fallback. The parent run used the discovered Python executable above. Comparison refuses preloaded kernels and unloads only its own direct-query kernels; use a dedicated process for process-global SPICE/cwd state.

Final parent checks: 68 Node tests passed, 13 Python tests passed (including all real DE421 tests; zero skips), strict NodeNext TypeScript exit 0. Coverage was rerun from actual kernel windows. Two child sessions hit provider rate limits after writing files; parent reviewed and completed implementation/validation rather than treating incomplete sessions as passed work.
