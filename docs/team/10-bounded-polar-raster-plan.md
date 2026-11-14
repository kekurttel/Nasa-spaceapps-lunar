# Bounded polar illumination raster plan

Status: SNAPSHOT-ONLY SCOPE APPROVED by user on 2026-11-14: 3×3 grid, three UTC instants; no duration model, large downloads, advanced Sol agent or HTTP/UI exposure. User subsequently approved official NASA/PDS LDEM_80S_80M V2.1 download (29,837,992-byte raster plus label). Download underway; real acceptance remains BLOCKED_ON_VERIFIED_LOCAL_POLAR_DATA until complete size/hash/label validation. Snapshot producer implementation is authorized, with mocks permitted while transfer runs. Read-only `glob **/ldem_80s*` found no matching assets under `/home/ytwrie/Projects/NasaSpaceApp` or `/tmp/opencode`; this bounded search is not a whole-machine inventory. User must supply authorized local image/label paths or explicitly approve a bounded official download. No real-polar product or test executed.

## Current implementation update — 2026-11-14

Authorized raster and label now local, size/SHA-256 verified; see `docs/sources/polar-download-verification.md`. Isolated `.venv` dependencies installed. Remaining sections preserve original proposal and decision gates, not current asset inventory. Real bounded 27-value CLI acceptance passed; nine registration validations true. Actual results and resource limits recorded in `11-polar-snapshot-acceptance.md`. This does not certify physical illumination accuracy or temporal persistence.

Implemented contract uses `timestampsUtc` plus three `frames` containing `timestampUtc` and nine `fractions` each. Rows follow **decreasing projected y**, columns increasing projected x; these are not local east/north axes across polar footprint. Actual smoke budget is **20 km**, 80 m distance steps, 5° azimuth steps, nine site horizons and three timestamps/site. Earlier 200 km/single-timestamp planning text below is superseded, not executed evidence. No new ray engine, HTTP/UI, inferred intervals or duration claims.

## Purpose and boundary

Deliver a small, separately versioned real-polar 2D illumination **snapshot** using existing Agent3 terrain horizon, registered sky, and `computeVisibility` pipeline. Extend producer to iterate a bounded 3×3 grid; do not add or duplicate ray engine. Keep `temporal-illumination/v1` unchanged. Snapshot values are not interval support and must never be adapted into duration analysis.

`illumination.mjs` validates explicit half-open intervals, not instants, and computes duration from those intervals. Reusing its schema or manufacturing intervals from sample cadence would falsely certify time support.

## Prerequisite gate: local polar data

Current local polar availability was **not checked**. Before implementation, perform read-only inventory for polar image/label, manifest, registered sky/kernel assets; record paths, byte sizes, hashes, provenance, coverage, frame, license/authorization. Do not fetch or invoke any downloader. Existing `data/lola-manifest.json` identifies only `LDEM_4_FLOAT` V3.0 global ~7.58084 km/pixel data, explicitly unsuitable for local high-resolution terrain claims; it is not evidence that an 80 m polar product exists. Stop if no authorized, georeferenced 80 m polar DEM and usable sky/kernel inputs already exist locally.

## Bounded producer proposal

- Footprint: one explicitly selected local polar site, 3×3 cells, 80 m nominal pixels, three declared UTC instants: 27 cell-time evaluations, nine reusable site horizons. Horizon and sample budgets remain planning limits, not measured performance. No regional sweep, annual/18.6-year study, refinement, or claims of PSR.
- Existing horizon/visibility computation reused per cell, wired through existing producer interfaces. Keep horizon/sky/visibility provenance and warnings. No alternate or duplicated ray casting.
- Conservative planning ceilings (not measured): 9 cells; at most 9 horizon profiles; 72 azimuth rays/profile; 200 km maximum ray distance; 80 m distance step (up to 2,500 samples/ray, 1.62 million DEM samples total); 1 timestamp; 1 raster. Abort on any exceeded ceiling. This is a planning bound, not runtime or accuracy evidence. Measure wall time/peak memory only after authorization and before expanding scope.
- No interpolation across NoData, DEM edge, or failed rays. Preserve explicit null per output cell; abort if frame/georeferencing invalid or all cells missing. Never convert missing/failed terrain to darkness.

## Product contract sketch (new versioned snapshot product)

Separate schema identifier, e.g. `polar-illumination-snapshot/v1`; schema name/version requires review before implementation. Fields:

- `schemaVersion`, `quantity: "visible-solar-disk-fraction"`, `timestampUtc` (single instant; not interval start/end).
- `grid`: `width: 3`, `height: 3`, row-major north-to-south then west-to-east ordering; projected CRS/WKT explicitly supplied from validated source registration; `frame` and epoch; origin convention (cell corner), axis signs, `originXM`, `originYM`, positive `pixelSizeXM/YM: 80`, units `m`, explicit bounds. Do not infer CRS or relabel geographic degrees as metres. Axis/origin must be verified against source registration and known control points.
- `fractions`: dense row-major values in `[0,1]` or explicit `null`; quantity convention, finite-Sun/penumbra and refraction assumptions explicitly stated by existing engine or marked unresolved (no unsupported assumptions).
- `quality`: DEM product/version/source URL, local path, byte size, SHA-256 and hash origin, source units/scale/offset/NoData, resampling lineage; solar ephemeris source/version and kernel hashes/frame/time coverage; producer branch/SHA, algorithm identifiers, horizon/sky/visibility lineage; warnings, spatial coverage, unresolved limitations.
- Snapshot schema must not masquerade as `temporal-illumination/v1`; no `startUtc`, `endUtc`, interval certification, duration metrics, or PSR label.

## Validation and tests

1. Deterministic mock tests: row-major mapping and exact 3×3 geometry; fraction bounds; explicit null propagation; reject sparse arrays, invalid values, unknown schema, inconsistent frame/grid; verify snapshot cannot enter interval analyzer as certified duration evidence.
2. Real-data gate tests: only run against already-local authorized assets. Validate DEM label/hash, projection and axis controls, cell footprints, frame/epoch, timestamp/ephemeris coverage, reproducibility, and nodata mask. Compare at least one independent reference/control; declare tolerance and source before claiming accuracy. Record actual runtime and peak memory; no claims based on planning budget.
3. Failure gates: missing/unauthorized assets; unknown or mismatched georeference/frame; unsupported quantity/assumptions; DEM NoData or edge intersections not represented as null; non-reproducible provenance; budget overrun; failed reference/tolerance. Any gate failure means no real-polar fixture/product, no fallback to coarse global DEM, and stop for review.

## Explicit user choices before work

**Stage 1 — choose one:** (A) snapshot-only product, no duration analysis; or (B) defer producer pending a real interval-certified contract. Recommended bounded first step: A, only after local-data gate passes.

**Stage 2 — separate opt-in decision:** whether to define a clearly labeled approximate zero-order-held MODEL contract, where each snapshot is assumed constant over an explicitly declared following interval. This is a model assumption, not physical duration proof; requires user approval, uncertainty policy, cadence/gap rules, and separate version/schema review. Until approved, do not emit intervals or run `analyzeIllumination` on these snapshots.

Ask before any advanced Sol/long-horizon analysis. No rollback plan needed before authorization because no implementation or exposure is authorized. After authorization, keep output offline/local; HTTP/UI exposure requires separate review.

## Evidence

- `docs/team/08-agent3-map-contract-request.md`: no large DEM download authorized; no alternate ray engine; explicit grid, quantity, time semantics and provenance required.
- `docs/team/09-polar-producer-contract-mapping.md`: existing producer has site-specific horizon plus registered sky/visibility; timestamps are snapshots; no spatial raster/interval support.
- `src/features/analysis/illumination.mjs`: `temporal-illumination/v1` requires explicit ordered half-open intervals and dense fractions/null; snapshot timestamps do not certify support.
- `data/lola-manifest.json`: local manifest describes coarse global `LDEM_4_FLOAT`, not suitable for local high-resolution terrain claims.
