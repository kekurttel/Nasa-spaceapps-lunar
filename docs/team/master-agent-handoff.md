# Master agent integration handoff

## Scope

Branch: `feat/horizon-visibility`. Baseline: `e241cee6d9f149767379a4891cb0344cf2a7d28d`.
User requested a project commit for master-agent integration; presentation work is excluded. No main/master merge performed.

## Ready for integration review

- Platform-native temporary paths in `scripts/run-polar-analysis.mjs`.
- Strict verified-cache reuse in `scripts/fetch-polar-lola.py`, with regression tests. Existing source hashes and manifest checks retained.

## Experimental scaffold — NOT scientific acceptance

New `illumination_geometry.py`, `illumination_terrain.py`, `illumination_engine.py`, `illumination_sky.py`, runner, benchmark harness and tests are preserved for continuation, not certified results.

Blocking findings in the current engine:

1. Terrain rays use fixed half-pixel marching, not conservative hierarchical bounds. Thin occluders can be missed; the current ray routine never establishes a known clear path, returning unknown after exhausting its sample budget.
2. Surface-normal derivatives use hard-coded 80 m spacing and east/north axes without establishing the projected-grid orientation. Per-cell finite Sun direction/radius is not derived: the Moon-centered direction/radius is reused.
3. Synthetic fixtures with `heights` bypass all terrain occlusion by setting every disk sample visible; these tests do not establish cast-shadow correctness.
4. `max_disk_samples` is validated and recorded but not used for adaptive refinement. Only initial `disk_samples` is evaluated.
5. Source coverage, nodata intersection and full spherical ray-path correctness need independent review. Unknown flags default to zero, not the intended 255 sentinel.
6. Surface normals are not exposed. Irradiance divides by summed positive incidence rather than total disk samples, so its normalization does not match the contract. `castShadowed` uses absence of any visible disk sample rather than center-ray obstruction. Contract and implementation must be reconciled.
7. No independently verified real-DEM tiled run, convergence matrix, runtime/RSS benchmark or full-footprint 80 m performance claim.
8. Web/backend integration is absent. Do not expose this scaffold as validated terrain illumination or landing safety.

The design/contract documents describe requirements, not achieved guarantees. Earlier agent handoff statements about missing modules/kernel availability are historical and superseded by this inventory; they are not independent environment checks.

## Fresh coordinator verification

2026-11-14, current checkout, Python 3.12:

- `python -m pytest tests -q`: **39 passed**, **5 subtests passed**, one Rasterio `PendingDeprecationWarning`.
- `node --test tests/*.test.mjs`: **65 passed**, zero failures/skips.

Passing suites do not resolve the scientific blockers above. Full real-data acceptance remains open. Tests were rerun after the engine disclaimer update before commit.

## Presentation

`explain/` intentionally remains outside the project commit per user instruction. Its files are retained locally; no presentation review or completion claim is part of this handoff.

## Next owner actions

Review workflow fixes separately from experimental illumination. Replace unsafe ray shortcuts with a proven spherical conservative traversal; implement actual adaptive disk estimates, authoritative unknown propagation and complete output contract. Add independent analytical cast-shadow fixtures, pinned real DEM integration, benchmark matrix and scientific review before production integration. Preserve `MOON_ME_DE421`, strict hashes and unknown states.
