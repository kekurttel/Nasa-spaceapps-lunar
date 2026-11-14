# Lunar surface illumination design

Status: **draft pending implementation-owner agreement**. The algorithm and contract are concrete; the owner must confirm exact engine integration/API before implementation. Existing four-source requirements and their gaps remain unchanged; this design does not close any requirement.

## Decision

Build a separate local illumination product on verified NASA PDS LOLA `LDEM_80S_80M` V2.1 (7600×7600, nominal 80 m, polar stereographic). Reuse the existing pinned image/label, hashes, decoder/georeference, and coverage checks; do not fetch alternate terrain or treat nominal spacing as accuracy. Preserve existing horizon and registered-sky products.

Use tiled hierarchical terrain ray traversal in spherical ECEF. Adaptively refine terrain traversal using tile bounds; never infer illumination through uncovered terrain. Compute surface normals from ECEF finite differences of neighboring DEM elevations, respecting projection, reference radius, and nodata. Exact API and tile hierarchy integration are implementation-owner decisions requiring agreement; benchmark first.

Use finite solar disk geometry from DE421 `NONE` states: geometric Sun direction and angular radius at each UTC, no atmospheric/refraction model. Estimate disk visibility with deterministic nested/adaptive disk samples (7, 19, 61); stop on convergence criterion documented in metadata. This is a deterministic sampling estimate, not a statistical error bound or proof of complete visibility; even identical samples do not establish mathematical completeness. Do not claim false/statistical error guarantees. For each disk sample, independently compute its positive normal-cosine contribution and trace terrain occlusion. Center-ray self-shadow is a flag only: incidence cosine `<= 0` sets `selfShadowed`, but does not imply zero finite-Sun irradiance or skip disk-ray traversal; limb samples may illuminate a facet while the center ray is below its horizon. Disk geometric visibility is independent of surface normal. `castShadowed` reports center-ray terrain blocking independently of normal orientation; also retain disk-sample terrain occlusion in geometric visibility, including when the center-ray normal is self-shadowed. Agree detailed shadow-class precedence with engine owner; contract enum is `UNKNOWN=0`, `LIT=1`, `SELF=2`, `CAST=3`, `PARTIAL=4`, `MIXED=5`. `solarDiskVisibleFraction` is disk-visible fraction; unsupported ray coverage produces NaN, never illuminated. Optional lower/upper bounds may accompany the estimate.

Incidence angle derives from the ECEF normal and Sun direction. Direct irradiance is the cosine-weighted integral over visible solar-disk samples, normalized to unobstructed perpendicular irradiance at the same Sun distance and uniform disk radiance. Therefore unobstructed perpendicular surface is 1; terrain/self-shadow may reduce it to 0. No atmospheric, albedo, thermal, diffuse-sky, or panel-orientation effects are included.

## Benchmark gate

Before rollout to the full engine, benchmark actual implementation on 64×64, 512×512, and a full coarse overview. Record measured wall time, peak memory, ray/tile counts, coverage and convergence; do not extrapolate these to an 80 m full-map runtime. Full `LDEM_80S_80M` illumination remains explicitly **unbenchmarked** until run. Set and report resource limits from measured runs before enabling full-resolution production. No claim of full-product feasibility based on small fixtures.

## Product and provenance

Write numeric NPZ tiles only: `elevationM`, `incidenceAngleDeg`, `solarDiskVisibleFraction`, `relativeDirectIrradiance` as float32; `shadowClass`, `selfShadowed`, `castShadowed`, `coverageStatus` as uint8. Preserve NaN for unknown floating outputs. Include tile counts and convergence/sample metadata. `shadowClass` uses contract enum values `UNKNOWN=0`, `LIT=1`, `SELF=2`, `CAST=3`, `PARTIAL=4`, `MIXED=5`. Self-shadow and terrain cast-shadow are independent and may coexist; `MIXED` represents both flags. Set `PARTIAL` for nonzero, nonunit disk visibility absent self/cast combination; final precedence follows the explicit contract. Unknown coverage always wins.

Manifest records output projection and affine transform, actual resolution, ROI, source image/label hashes, UTC, DE421 Sun vector/frame, algorithm version, ray coverage, benchmark scope, and warnings. Stable timestamps and exact source pins must survive fetch reuse. Never fabricate illumination for unknown coverage, silently substitute synthetic data, or use a flat/global fallback. Synthetic fixtures are test-only and explicitly labelled.

## Validation

Use labelled synthetic terrain only for deterministic algorithm tests: ECEF normal/incidence controls, horizon-blocked rays, finite-disk partial visibility, self-shadow versus cast-shadow separation, nodata/coverage unknown propagation, nested sample convergence, NPZ dtype/schema and manifest provenance. Real-data tests must verify exact pinned product and georeference; synthetic outputs cannot satisfy real-data acceptance. Run the three benchmark sizes before full-engine rollout and report full 80 m as unbenchmarked absent an actual run.

## Scope limits

No code/dependency changes are authorized by this documentation task. Keep existing four-source requirements and gaps unchanged. Existing Linux `os.tmpdir` fetch-reuse fix, exact pins, and stable timestamps remain intact. Exact engine API remains subject to owner agreement; do not invent an incompatible public API.