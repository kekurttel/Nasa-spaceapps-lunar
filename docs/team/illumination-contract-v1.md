# Illumination product contract v1

Status: **draft pending implementation-owner agreement**. Required serialized names and value semantics; exact engine call signatures remain owner-approved integration decisions. Version changes require explicit schema/version update.

## NPZ tile arrays

Each tile stores same-shaped numeric arrays, no object dtype:

| Key | dtype | Semantics |
|---|---|---|
| `elevationM` | float32 | LOLA elevation in meters relative to the product reference sphere; source nodata remains NaN. |
| `incidenceAngleDeg` | float32 | Angle between local outward ECEF normal and center-Sun direction; degrees `[0,180]`; NaN if geometry/coverage unknown. |
| `solarDiskVisibleFraction` | float32 | Deterministic visible fraction of finite solar disk, `[0,1]`; NaN if any required ray coverage prevents a defensible result. |
| `relativeDirectIrradiance` | float32 | Uniform-radiance, cosine-weighted visible-disk integral normalized to unobstructed perpendicular surface at the same Sun distance; `[0,1]`; NaN if unknown. |
| `shadowClass` | uint8 | Stable enum below. |
| `selfShadowed` | uint8 | `1` iff center-Sun incidence cosine `<= 0`, otherwise `0`; `0` does not assert terrain clearance. `255` unknown. |
| `castShadowed` | uint8 | Center-ray terrain-blocked flag independent of normal orientation; `1` if terrain blocks center-Sun ray, `0` otherwise, `255` unknown. Must not be inferred from `selfShadowed`; traversal remains enabled when self-shadowed. Disk-sample terrain occlusion is separately represented by `solarDiskVisibleFraction`. |
| `coverageStatus` | uint8 | Stable coverage enum below. |

`shadowClass` values and precedence: `0=UNKNOWN`, `1=LIT`, `2=SELF`, `3=CAST`, `4=PARTIAL`, `5=MIXED`. `UNKNOWN` wins whenever required coverage is insufficient. `MIXED` means self-shadow is set and at least one finite-disk sample is terrain-occluded; center-ray `castShadowed` remains an independent flag and is not required for `MIXED`. Otherwise `SELF` applies when center-ray incidence cosine `<=0`; `CAST` when terrain blocks the center ray; `PARTIAL` when finite-disk geometric visibility is strictly between 0 and 1; `LIT` otherwise. This classification precedence does not discard independent flags, visibility fractions, or irradiance. `selfShadowed` may coexist with positive finite-Sun irradiance: solar limb samples can have positive normal cosine. Never infer zero irradiance from the self-shadow flag.

`coverageStatus` values: `0=UNKNOWN`, `1=COMPLETE`, `2=PARTIAL`. `PARTIAL` describes available geometric tile support but insufficient ray coverage for a complete illumination result; dependent floats remain NaN. `COMPLETE` requires all required terrain rays covered and valid. `UNKNOWN` means terrain/sample state itself cannot be established. Writer must not encode nodata as `COMPLETE`.

## Finite Sun and calculation

Input solar geometry uses DE421 `NONE` state at the recorded UTC and explicit frame. Disk sampling is deterministic, nested/adaptive 7, 19, then 61 samples. Record used sample count and convergence criterion/result; these are numerical sampling metadata, not statistical confidence/error bounds. Incidence uses ECEF finite-difference terrain normal. For center-ray cosine `<=0`, set `selfShadowed=1` only; still evaluate every required disk sample and its terrain path. Compute each sample's positive cosine contribution independently, so limb illumination can yield positive irradiance. Determine `castShadowed` from center-ray terrain occlusion independent of normal orientation. Compute disk geometric visibility independently of normal and center-ray terrain state. Disk fraction is a deterministic sampling estimate, not proof of complete visibility, even when samples agree. Unknown required path coverage yields `coverageStatus=0` or `2`, dependent floats NaN, and `shadowClass=0`.

Irradiance equals normalized sum of each terrain-visible sample's positive normal cosine, weighted by uniform disk radiance, divided by the unobstructed perpendicular-surface sum at the same Sun distance. Do not discard positive limb contributions when center-ray cosine is `<=0`. No atmospheric/refraction, diffuse, albedo, thermal, or panel model is implied.

## Manifest

Manifest must include:

- `contractVersion`: `1`.
- Output projection identifier, affine transform, actual pixel resolution, ROI, tile dimensions/counts.
- Source product/version and exact image/label SHA-256 values; source `LDEM_80S_80M` V2.1.
- UTC timestamp, Sun vector, vector frame, DE421 kernel/state provenance.
- Algorithm version, terrain traversal/tile hierarchy settings, finite-disk sample set, convergence criterion/results.
- Ray coverage summary, unknown/partial counts, benchmark scope and measured timings/memory where available.
- Warnings, including that full 80 m map remains unbenchmarked unless actually run; nominal 80 m spacing is not accuracy.
- Stable/reproducible timestamps; fetching reused pinned files must not rewrite timestamps or pins.

Synthetic fixtures must be explicitly labelled synthetic/test-only and cannot populate or pass real-data provenance. No fallback, flat global Moon, or unknown-as-lit behavior is permitted. Existing four-source requirements and gaps remain unchanged.