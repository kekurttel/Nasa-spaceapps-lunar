# Visibility-task response to judge report — 2026-11-14

## Snapshot and ownership

User supplied `YARGIC-2026-11-14.md`, reviewing visibility commit `3ff91e659b69cf42575e5a444ab83ddcd790b96f`. Current visibility delivery before this repair is `5470efc7020f3543787ba73c997071e907c176d0`. Findings are evaluated against current code, not silently dismissed as old.

Ownership: `src/features/visibility/**`, associated tests and registered runner, source/visibility documentation. No backend/frontend calculation, catalogue, window-analysis or other-agent module is changed by this repair.

## Finding disposition

- P1 shared terrain/sky frame and observer height: addressed in `5470efc` for the separate registered CLI. It computes geometric Sun/Earth states directly in `MOON_ME_DE421`, subtracts observer radius `1737400 + sampled surfaceHeightM + observerHeightM` metres and checks registration before visibility. It does not transform or certify the other agent's `IAU_MOON` outputs, and is not a web integration fix.
- Two calculation paths: remains open at product-integration level. CLI is explicitly separate; no third engine or implicit backend adapter added. Integrator must select and connect the agreed source/quality contract before web terrain claims.
- Old access/commit notes: chronological notes carry current-status banners. Current branch, base and delivery evidence are in `docs/team/03-visibility.md`.
- README source contradiction: corrected. LOLA is implemented in the separate CLI, not the web backend. QuickMap validation is pending; Moon Trek URL configuration is not proof of delivery. Horizons archived responses are not claimed as registered CLI input.
- Backend direction, duration, timezone and fallback findings: outside this task's ownership; remain open here. No assertion that they are fixed.
- Agent1/Agent2 UTC, UI, catalogue, CSV and windows findings: outside this task; no silent changes or completion claim.

## Source constraints

User-provided `sources.md` is stored verbatim at repository root. Four-source workflow is a user requirement. Existing LOLA+SPICE CLI does not satisfy completed QuickMap/Moon Trek/Horizons integration. Auxiliary NAIF kernels are disclosed, not relabeled as Horizons output. No new remote scientific dataset is downloaded during this repair.

## Verification

The request builder accepted a fabricated DEM if its mutable `sha256` field matched its own sample bytes. That established self-consistency, not use of the required LOLA product. A regression test reproduced the acceptance. The builder now requires the loader's verified-instance record and unchanged sample bytes through `isVerifiedLolaDem`, rejecting hand-built or copied/self-hashed grids as real registered input.

Fresh kernel inspection confirms frame ID 31007 and orthogonality error 4.44e-16. `node scripts/run-registered-analysis.mjs --output output/judge-repair-check.json` ran with genuine local LOLA/DE421 data. The exported registration gate also rejected nonfinite request heights, noncanonical frame and malformed UTC inputs only incompletely. It now validates those inputs up front and rejects synthetic/nonterrain document claims explicitly. A test using the actual `provenance.synthetic` field failed with 'Missing expected rejection' before the document check and passed after it. Fresh full Node suite: 58 passed, 0 failed, 0 skipped. Python suite: 8 passed, no skips. The genuine-data registered CLI was rerun successfully after the final fix. These checks are not proof of end-to-end web integration or landing safety.
