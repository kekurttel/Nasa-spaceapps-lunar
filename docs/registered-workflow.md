# Registered terrain and sky workflow

`runRegisteredAnalysis()` builds LOLA terrain and observer registration from one site definition, asks the repository's `registered-sky.py` generator for an ephemeris using a temporary JSON request, validates returned registration, then computes visibility. It never accepts a caller-provided SkySeries for real-data visibility.

```sh
node scripts/run-registered-analysis.mjs --site-id Shackleton-reference-example --lat -89.9 --lon 0 --height 2 --start 2026-11-14T00:00:00Z --count 3 --step-minutes 5 --output output/registered-analysis.json
```

Defaults: site `Shackleton-reference-example`, latitude `-89.9`, longitude `0`, observer height `2` m, start `2026-11-14T00:00:00Z`, 3 samples spaced 5 minutes. CLI accepts `--site-id`, `--lat`, `--lon`, `--height`, `--start`, `--count`, `--step-minutes`, and `--output`.

`buildRegisteredRequest(dem, options)` samples surface height via `sampleLolaHeightM`; options cannot override that height. Request records terrain SHA-256, fixed frame `ME_DE421_LOCAL_NORTH_EAST`, and UTC sample times. Validation checks returned site, normalized longitude, coordinates, observer/surface heights (1e-6 m tolerance), observer radius, frames, times, terrain hash against horizon provenance, `NONE` aberration correction, and kernel hashes against the actual files and `data/kernels/manifest.json`. Kernel manifest entries contain `fileName`, `url`, `bytes`, `sha256`.

This validates consistency of generated output and local kernels, not cryptographic identity of the Python process or a signed generator. Do not treat metadata alone as proof against a compromised generator or runtime. Successful output contains `{ horizonDocument, sky, visibility, registrationValidation }`.
