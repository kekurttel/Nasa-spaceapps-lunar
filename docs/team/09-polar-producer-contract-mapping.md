# Agent3 polar producer contract mapping

Checked remote branch `feat/horizon-visibility`, SHA `e241cee6d9f149767379a4891cb0344cf2a7d28d` at `kekurttel/Nasa-spaceapps-lunar`. Read through GitHub Contents API; no checkout, merge, execution, or download. Request baseline: `docs/team/08-agent3-map-contract-request.md` in consumer repo. Consumer contract: `src/features/analysis/illumination.mjs`, `temporal-illumination/v1`.

## Finding

**No spatial 2D illumination raster and no per-cell time fractions are produced.** Producer emits a site-specific 1D terrain horizon profile and a sky/visibility time series for that site. Distinct UTC samples do not define intervals or duration support. This branch does not satisfy the requested versioned raster contract; do not adapt these values into temporal-illumination frames.

## Producer evidence

Remote `scripts/run-polar-analysis.mjs`:

- `runPolarAnalysis(options = {})` (line 25) accepts one site (`siteId`, latitude/longitude, observer height; lines 26–29); defaults to three samples (`count=3`, `stepMinutes=5`, lines 30–35).
- `timesUtc` is an array of instants generated at `start + i * stepMinutes` (lines 42–44). Request contains site coordinates, `timesUtc`, and frame only (line 47), no interval boundaries.
- Calls `scripts/polar-lola.py` for horizon output (lines 60–70), then registered sky generator and `computeVisibility` (lines 71–79). Writes one `output/polar-analysis.json` bundle, default (lines 79–83), containing `horizonDocument`, `sky`, `visibility`, registration validation, timings. No raster-frame writer or spatial grid iteration exists.
- `scripts/polar-lola.py` lines 13–19 is CLI (`--request`, `--output`, image/label paths) delegating to `write_horizon`.

Remote `src/features/visibility/polar_lola.py`:

- `compute_horizon(image_path, *, site_id, latitude_deg, longitude_deg, observer_height_m, azimuth_step_deg=5.0, distance_step_m=80.0, max_distance_m=200_000.0, label_text=None) -> dict[str, Any]` (lines 135–138) computes one horizon around one observer. It iterates azimuth and distance rays (172–217), retaining maximum elevation per bearing; result arrays are `azimuthDeg` and `elevationDeg` (lines 95–97, 218–225). These are angular profile axes, not map rows/columns or illumination fractions.
- `horizon_document(...) -> dict[str, Any]` (lines 87–90) stores site/profile/coverage/source/provenance. It records warnings (lines 91–94) and profile model `terrain`, `dataKind: real` (lines 95–97). No illumination quantity, fractions, schemaVersion, spatial grid dimensions, or time fields.
- `write_horizon(request_path, output_path, image_path, label_path)` (line 228) serializes horizon JSON, not map output.

## Geometry, axes, NoData

DEM source is a 7600×7600, signed-int16 polar stereographic LOLA product; this is input terrain geometry, not output illumination geometry. `validate_label` (lines 49–65) pins `MAP_PROJECTION_TYPE="POLAR STEREOGRAPHIC"`, planetocentric latitudes −90..−80, center at (−90°,0°), east-positive longitude, body-fixed frame `MEAN EARTH/POLAR AXIS OF DE421`, 80 m map scale, sample/line offsets 3799.5, scale 0.5, radius offset 1,737,400 m. `label_projection_to_pixel` (lines 68–84) defines `x=rho*sin(lon)`, `y=rho*cos(lon)`, `col=sample_offset+x/scale`, `row=line_offset-y/scale`; orientation text says x east/y north, increasing longitude 90° increases column (lines 70–75). Runtime affine controls verify pole/east/prime-meridian orientation (lines 179–203). Therefore producer verifies input DEM handedness; it does not define consumer-ready output grid CRS/WKT, origin, bounds, or axes.

DN-to-radius conversion: `decode_sample_radius_m(dn)` line 36–39 and bilinear sampler lines 120–132 use `DN * 0.5 + 1737400 m`. Raster masked values become NaN and trigger `ValueError("Horizon ray intersects NoData in DEM")` (lines 125–129); out-of-bounds four-pixel neighborhoods also fail (lines 120–123). Missing terrain aborts ray production rather than yielding map NoData cells. Profile `coverage` uses azimuth coverage and finite ray range/spacing (lines 98–102); it is not cell validity mask.

## Time and provenance

Runner timestamps are snapshots only: generated values in `timesUtc` (line 44) flow to sky request (lines 47, 71), with no `[startUtc,endUtc)` support, certified validity span, interpolation or gap policy. `count` and cadence create samples; they do not certify any interval. Sky and visibility values are site/time outputs, not spatial maps. Thus duration fraction per spatial cell is absent, not merely undocumented.

Terrain provenance is comparatively strong: runner pins product/version/dataset/source URLs, retrieval records, file sizes and SHA-256s (lines 14–15, 48–55); manifest `data/polar-lola-manifest.json` lines 2–24 records PDS URLs, HTTP status, retrieval UTC, byte count and locally computed hashes. Python validates raw/canonical label and raster hashes (polar_lola.py lines 152–171). `horizon_document` provenance records product/version/dataset, height reference, frame, nominal resolution, site/ray sampling and SHA-256 (lines 103–111). Manifest lines 35–38 says hashes locally calculated (not publisher checksums), raw inputs retained, and explicitly limits validation; no solar ephemeris/kernel lineage is emitted by this terrain producer itself. The runner's sky stage uses `data/kernels` by default and passes kernels directory (run-polar-analysis.mjs lines 71–77), but its result mapping does not establish illumination raster provenance or interval certification.

## Mapping to request and consumer

The request (`docs/team/08-agent3-map-contract-request.md` lines 5–21) requires a versioned 2D raster, explicit projected metre grid, fraction quantity and explicit null NoData, temporal interval semantics, provenance, uncertainty and raster fixtures. Current producer delivers none of the spatial raster schema or interval support. It cannot meet consumer `temporal-illumination/v1`: `validateIlluminationSeries` requires schemaVersion, projected metre grid and explicit half-open start/end plus frames (illumination.mjs lines 15–33); fractions must be dense 0..1 or explicit null (line 30). Analyzer treats durations strictly as interval support, not snapshot counts (lines 42, 55–67). Do not create frames from sky timestamps or infer fractions from horizon profile.

## Response-template status

- Branch / SHA: `feat/horizon-visibility` / `e241cee6d9f149767379a4891cb0344cf2a7d28d`.
- Schema path / version: no illumination-raster schema or schemaVersion found in examined producer paths.
- Producer signatures: `runPolarAnalysis(options = {})`; `compute_horizon(...) -> dict[str, Any]`; `write_horizon(request_path, output_path, image_path, label_path)`.
- Fixture + command: site horizon integration path documented in remote `docs/polar-workflow.md` lines 3–11; not a spatial illumination fixture. No real-polar map fixture/command.
- CRS/frame/axis/origin: input DEM label/frame and axis mapping above; no output illumination-grid contract.
- NoData / quantity: DEM NoData fails ray sampling; no illumination fraction or raster NoData.
- Time semantics / interval support: UTC snapshots; no interval support.
- DEM provenance: pinned PDS LDEM_80S_80M V2.1, dataset `LRO-L-LOLA-4-GDR-V1.0`, nominal 80 m, locally verified SHA-256 and manifest retrieval metadata. Sky lineage is separate and does not turn output into interval map.
- Validation / limitations: projection controls, label/raster integrity, ray sampling tests are terrain-horizon validation only; no independent spatial illumination reference, temporal-gap fixture, or PSR evidence from this output.

## Decision

Status remains `BLOCKED_ON_PRODUCER_CONTRACT`. Keep temporal-illumination analysis isolated. Request producer deliver a separately versioned spatial illumination product with explicit grid, fractions/NoData, time support and provenance before adapter work or HTTP/UI enablement. No new engine, downloads, or merge performed.
