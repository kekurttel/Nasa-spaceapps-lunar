# Reproducible LOLA terrain workflow

This workflow builds a terrain horizon from the inspected NASA PDS LOLA `LDEM_4_FLOAT` product. The runner loads the actual image and label through `loadLolaDem(imageBytes, labelText)`, then calls `buildLolaHorizon(dem, options)`. It does **not** create a SkySeries.

## Data and limits

`data/lola-manifest.json` records the official PDS image and label URLs, the product identity, acquisition period, local byte counts, and SHA-256 hashes. The checked-in/source-provided raster is 4 pixels per degree (about 7.58 km per pixel), global and low-resolution. It is appropriate for coarse regional exploration only—not claims about small craters, boulders, or high-resolution landing-site horizons. Elevations derive from a 1737.4 km reference sphere, not mean sea level. Keep the source attribution; no separate SPDX license is asserted and NASA endorsement is not implied.

Run `node scripts/fetch-lola.mjs` to reuse files that already match the manifest or fetch missing/mismatched files. `--force` re-downloads both. Downloads have a 30-second timeout and 5 MiB limit; each response is checked against the pinned byte count and SHA-256 before saving.

## Terrain only (default)

```sh
node scripts/run-real-terrain.mjs --site-id Shackleton-reference-example --lat -89.9 --lon 0 --height 2 --output output/real-terrain.json
```

The default site is an explicitly named Shackleton reference example, not a validated landing point. The runner uses frame `ME_DE421_LOCAL_NORTH_EAST`; its default horizon sampling settings come from `buildLolaHorizon`. Override sampling with `--azimuth-step`, `--distance-step`, or `--max-distance` (meters for distances). The result is the horizon document including the producer's coverage, sources, and provenance metadata. The producer must declare any sampling limits/coverage honestly; `loadTerrainHorizon` rejects mismatched site, observer height, frame, or non-full-circle coverage.

## Registered real sky and terrain

Use the separate workflow in [registered-workflow.md](registered-workflow.md) to generate real SPICE sky directions at the DEM-derived observer position. It uses explicit `MOON_ME_DE421`, checks kernel/terrain hashes and registration before visibility, and retains coarse DEM warnings. The legacy runner below remains deliberately restrictive; do not bypass its real-sky rejection by relabeling inputs.

## Optional visibility from supplied test ephemeris

```sh
node scripts/run-real-terrain.mjs --site-id Shackleton-reference-example --lat -89.9 --lon 0 --height 2 --sky path/to/real-sky-series.json --output output/real-visibility.json
```

The JSON must conform to the project's SkySeries contract, including aligned arrays and `quality.frame` matching `ME_DE421_LOCAL_NORTH_EAST`. For safety, the runner rejects SkySeries marked `quality.dataKind: "real"`: frame equality alone does not verify ephemeris provenance or that its site matches the selected terrain coordinates. `synthetic` or `mixed` SkySeries may be used for integration testing; output quality is correspondingly mixed with the real terrain. Do not treat this as real visibility analysis. The raw LOLA label identifies `MEAN EARTH/POLAR AXIS OF DE421`; this workflow's local frame registration is fixed but must not be taken as proof of external SkySeries alignment. Missing SkySeries means terrain-only output—never fabricated visibility. Earth visibility remains geometric center visibility, not a communications-link guarantee.

Run tests with `node --test tests/*.test.mjs` from the repository root.
