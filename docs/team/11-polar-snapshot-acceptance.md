# Polar snapshot acceptance: inverse mapping and bounded checks

Status: independent acceptance guidance for snapshot-only work. User subsequently authorized bounded official download; complete `data/raw/polar/LDEM_80S_80M.jp2` and `LDEM_80S_80M.lbl` now size/hash verified. Python polar tests: 12 passed, no skips, including actual raster decode and CRS checks. Snapshot/grid tests: 8 passed. These checks do not establish scientific illumination accuracy. Full bounded CLI now passed: 9 sites × 3 instants = 27 finite fractions, nine registration validations true, verified DEM hash preserved. All fractions are 0 for these chosen instants/model; this is not permanent shadow evidence. Measured wall time 11.99780378700234 s; Linux RUSAGE_CHILDREN maximum RSS 181612 KiB (not summed process-tree peak). Output `/tmp/opencode/polar-snapshots-real.json`, resource record `/tmp/opencode/polar-snapshots-resources.json`. Node polar suite 14/14, analysis suite 32/32, HTTP suite 3/3; overlapping counts are not additive. Build compiled successfully. No HTTP/UI exposure or temporal analysis authorized.

## Grid coordinates are projected coordinates

Validated Agent3 input mapping is polar stereographic, Moon radius 1,737,400 m, body-fixed `MEAN EARTH/POLAR AXIS OF DE421`; its input mapping is `x = rho * sin(lon)`, `y = rho * cos(lon)`, `col = sample_offset + x / scale`, `row = line_offset - y / scale`. At the south pole, projected axes do not mean local east/north: local tangent orientation is singular/longitude-dependent there. Label projected grid axes exactly as projected X/Y; do not rename them east/north or use a local tangent-plane approximation.

For a grid node/cell-center in the same validated polar stereographic CRS, invert projected metres to planetocentric latitude/longitude:

- `rho = hypot(x, y)`
- `latitude = -90° + 2 * atan(rho / (2 * R)) * 180/pi`, where `R = 1737400 m`
- `longitude = atan2(x, y) * 180/pi`, normalized to `[-180°, 180°)`
- At `rho = 0`, longitude is undefined; choose canonical `0°` only as a computational convention and record pole special-case. Do not claim unique geographic longitude at pole.

This inverse follows the producer's spherical polar-stereographic formula and radius. It is valid only after source label validation confirms that exact projection, latitude convention, radius, center, and frame; no generic CRS guess, ellipsoid substitution, or independent axis flip. For grid centers, use projected center coordinates derived from explicit corner origin and positive 80 m spacing, not geographic offsets.

## Small deterministic acceptance fixture

Use one small site centered near `latitude=-89.9°, longitude=0°`, 3×3 cells, 80 m spacing, three snapshot instants exactly `2026-11-14T00:00:00Z`, `2026-11-14T00:05:00Z`, `2026-11-14T00:10:00Z`. This is a software/registration acceptance workload, not a validated science study. Select projected origin by forward-projecting that declared center with the validated source registration; document whether origin is outer corner or center. With corner origin, define cell centers at `(originX + (col+0.5)*80, originY - (row+0.5)*80)` for row-major north-to-south, west-to-east, only if that Y sign is explicitly verified against source registration. Do not assume north-to-south ordering from array convention alone.

At each center, apply inverse projection to get geographic coordinates; pass each lat/lon into existing `runPolarAnalysis` / site horizon, registered-sky, and `computeVisibility` pipeline. Reuse existing evaluator; do not add ray engine. Snapshot values are visible-solar-disk fractions (or explicit null), never duration or interval support. Keep `temporal-illumination/v1` isolated.

## Independent geometry controls

Before evaluating illumination, test inverse mapping independently of snapshot producer:

1. Round-trip known controls using independently computed forward mapping and inverse, at south pole, prime meridian, ±90° longitude directions, and known non-polar locations; assert declared angular tolerance and axis signs.
2. Compare sample/line from the producer's validated `label_projection_to_pixel` against the independently calculated mapping for control points; require exact documented affine/offset convention and subpixel tolerance. Do not use the inverse implementation under test to generate its own expected values.
3. Assert center site is near −89.9°, 0°, cells remain inside validated DEM bounds, coordinates are distinct, row-major ordering and 80 m separation hold in projected space. Record geographic coordinate changes without calling them east/north distances.
4. Check longitude wrap and pole special-case explicitly. Reject non-finite inputs and unknown frame/epoch/projection.

## DEM bounds and conservative workload

Compute valid projected bounds from the validated image dimensions, label sample/line offsets, scale, and pixel-center convention. For every horizon ray, enforce `maxDistanceM <= minimum distance from ray start to valid DEM boundary`; cap configured maximum to 200,000 m and fail closed when support cannot be proven. Preserve existing 80 m ray step. Any out-of-bounds or NoData ray must remain an explicit failure/null according to established evaluator contract; never extrapolate or replace missing terrain with darkness. This bound does not prove a horizon is complete beyond DEM coverage.

Use conservative test ceilings: 9 cells, at most 9 horizon profiles, 72 azimuth rays/profile, 2,500 samples/ray, 1.62 million DEM samples total, 3 timestamps, 27 cell-time evaluations, one output raster. Abort on any exceeded ceiling. These ceilings bound test workload only; they are not measured runtime, memory, completeness, or accuracy evidence. Measure actual wall time and peak memory before any scope expansion.

## Temporal nonclaim and acceptance gates

Three UTC timestamps are instantaneous snapshots only. No inference of conditions between samples, interpolation, zero-order hold, interval support, duration, persistence, PSR, or physical availability. Never adapt output to `temporal-illumination/v1`, which requires explicit ordered half-open intervals.

Accept implementation only when:

- Pure evaluator tests prove deterministic projected-grid-to-coordinate mapping, cell ordering/centers, explicit null handling, fraction bounds, and rejection of invalid grid/frame inputs.
- Existing visibility/registration path is reused; no duplicate ray engine or changed interval analyzer.
- Projection controls pass independently, and validated source label/frame/epoch plus raster integrity and coverage are recorded.
- `maxDistanceM` is clipped or rejected against verified DEM support; NoData and boundary failures remain visible, never interpreted as darkness.
- Output carries provenance, warnings, coordinate convention, snapshot instants, and explicit limitation that samples do not establish temporal support.
- Workload ceilings pass; actual resource measurements are reported separately from planning ceilings.
- Without authorized complete local polar DEM and usable registered sky/kernel assets, run mocks only; no real-polar product, fixture, or science claim.

Any failed gate blocks real-polar acceptance. No fallback to coarse global DEM, no data download without explicit authorization, and no UI/API exposure without separate review.
