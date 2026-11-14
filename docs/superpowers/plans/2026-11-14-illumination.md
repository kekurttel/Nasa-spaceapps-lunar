# Lunar surface illumination implementation plan

> **For agentic workers:** Execute only after the implementation owner agrees on the exact engine API. Use the approved subagent workflow; do not edit outside the owned paths without authorization.

**Goal:** Produce provenance-complete, coverage-honest finite-Sun lunar illumination tiles from the pinned real polar LOLA terrain.

**Architecture:** Add an illumination engine using tiled hierarchical terrain ray traversal in spherical ECEF, ECEF-derived normals, and deterministic adaptive solar-disk samples. Persist numeric NPZ tiles and a manifest; gate full-resolution rollout on actual small/medium/coarse benchmarks.

**Tech Stack:** Existing Python polar LOLA decoder/georeference and pinned PDS inputs; NumPy NPZ; existing DE421 `NONE` state provider. No new dependencies authorized.

**Spec:** `docs/superpowers/specs/2026-11-14-illumination-design.md`

## Global constraints

- Terrain: exact pinned `LDEM_80S_80M` V2.1 image/label and existing verified hashes/georeference.
- Unknown coverage remains unknown/NaN; no synthetic substitution, flat horizon, or global fallback.
- Sun states: DE421 `NONE`; report UTC, frame, and vector.
- Disk samples: deterministic nested 7/19/61; no statistical error claim.
- Separate self-shadow (`cosine <= 0`) from terrain cast-shadow.
- Bench 64×64, 512×512, full coarse overview before full-engine rollout; full 80 m runtime unbenchmarked until actually measured.
- Preserve existing Linux `os.tmpdir` fetch-reuse fix, exact pins, stable timestamps, and all four-source requirement gaps unchanged.
- No new dependencies.

## Review focus

- DEM nodata or out-of-product traversal: output unknown, never illuminated.
- Back-facing normal: self-shadow only; no terrain cast-shadow ray required.
- Sun disk straddling a terrain horizon: finite-disk partial visibility with deterministic refinement.
- Projection/tile edge: correct ECEF geometry and explicit coverage status.
- Coarse synthetic fixtures: clearly labelled test-only, never accepted as real product.

## Task 1: Confirm engine interface and benchmark harness

**Files:**
- Modify: none until owner approval
- Test/benchmark: agree exact existing engine/provider interfaces with owner

- [ ] Record owner-approved signatures for terrain tile access, DE421 Sun state access, and output invocation in this plan before implementation.
- [ ] Add benchmark harness for actual 64×64 and 512×512 subsets plus full coarse overview; report wall time, peak memory, ray/tile counts, coverage, convergence.
- [ ] Run baseline benchmark; preserve outputs and source hash/UTC context. Do not extrapolate to full 80 m map.

## Task 2: ECEF terrain geometry and traversal

**Files:**
- Create: implementation-owner-approved illumination engine module
- Test: focused illumination geometry tests

- [ ] Add failing tests for ECEF finite-difference normals on a flat sphere and known slope; pin incidence-angle values and orientation.
- [ ] Add failing tests for hierarchical tile-bound traversal hitting an intervening ridge and missing a clear ray.
- [ ] Add failing tests for nodata and out-of-product rays returning unknown coverage, never visible.
- [ ] Implement approved tile access and traversal signatures; use spherical ECEF positions and finite terrain coverage, no global flat substitution.
- [ ] Run focused tests; require exact expected classifications and no unknown-to-visible conversion.

## Task 3: Finite-Sun disk visibility and irradiance

**Files:**
- Modify: approved illumination engine module
- Test: finite-Sun and shadow-classification tests

- [ ] Add failing tests showing center-ray incidence cosine `<= 0` can coexist with positive irradiance from visible limb samples; self-shadow must not skip disk traversal.
- [ ] Add deterministic 7/19/61 nested solar-disk sample tests, including unobstructed, fully blocked, and partially blocked disks; identical samples must not be treated as proof of complete visibility.
- [ ] Pin convergence metadata; assert no probabilistic/statistical error field or guarantee.
- [ ] Implement DE421 `NONE` direction/angular-radius input, disk visibility, incidence angle, and cosine-weighted direct-irradiance normalization to the same-distance unobstructed perpendicular value.
- [ ] Assert unobstructed perpendicular irradiance equals 1; unknown coverage produces NaN.
- [ ] Run focused tests.

## Task 4: NPZ tile and manifest contract

**Files:**
- Create: approved tile/manifest writer
- Test: output schema and provenance tests

- [ ] Add failing tests for exact float32 keys `elevationM`, `incidenceAngleDeg`, `solarDiskVisibleFraction`, `relativeDirectIrradiance`; uint8 keys `shadowClass`, `selfShadowed`, `castShadowed`, `coverageStatus`.
- [ ] Use contract enum values `UNKNOWN=0`, `LIT=1`, `SELF=2`, `CAST=3`, `PARTIAL=4`, `MIXED=5`; coordinate exact precedence with implementation owner before serialization.
- [ ] Add failing tests for output projection, affine, actual resolution, ROI, source hashes, UTC, DE421 vector/frame, algorithm version, ray coverage, benchmark scope, warnings, sample/convergence metadata.
- [ ] Implement writer; preserve NaNs and stable timestamps; validate actual source hashes before real-product output.
- [ ] Run schema/provenance tests and reopen produced NPZ to verify numeric dtypes.

## Task 5: Real-data validation and rollout gate

**Files:**
- Modify only owner-approved illumination integration/runner files
- Test: real pinned-product integration and benchmark coverage

- [ ] Run real-data checks against pinned image/label, existing georeference and actual ROI; synthetic fixtures remain explicitly test-only.
- [ ] Run benchmark harness on actual 64×64, 512×512, and full coarse overview; record measurements and resource limits.
- [ ] Confirm no full 80 m performance claim unless a full 80 m run is actually measured; mark it unbenchmarked otherwise.
- [ ] Verify fetch reuse retains Linux `os.tmpdir` behavior, exact pins, and stable timestamps.
- [ ] Run full relevant Python/Node suites; report results and four-source gaps without changing their status.
- [ ] Request independent review before branch integration; make no commit/push unless separately authorized.