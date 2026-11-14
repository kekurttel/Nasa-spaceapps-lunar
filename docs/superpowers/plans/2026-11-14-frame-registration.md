# Sky–Terrain Registration Implementation Plan

> **For agentic workers:** Use subagent-driven implementation with file ownership. User explicitly requested nasa-luna implementation and commit/push after verification.

**Goal:** Compute real geometric Sun/Earth directions at the same DEM-derived observer position and ME/DE421 frame used by terrain horizons.

**Architecture:** Do not reinterpret Horizons MEAN_ME as DE421. Use official NAIF DE421 trajectory/orientation/frame kernels; explicitly request MOON_ME_DE421. Observer Cartesian radius is 1737400m + sampled LOLA surface height + observerHeightM. Both branches use the same radial north/east/up basis and request. A registration gate rejects mismatched site, height, frame, DEM hash, times or kernel hashes before visibility.

**Tech Stack:** Existing Node.js modules; Python 3.12 + pinned spiceypy for real ephemerides. No analytical/synthetic fallback in registered workflow.

**Spec:** User request to match sky position to terrain with verification; existing docs/lola.md, docs/quality-audit.md and original agent3/son requirements.

## Global Constraints
- Implementers use 9router/nasa/nasa-luna; coordinator discloses nasa-sol.
- Only feat/horizon-visibility, no default branch push or automatic merge.
- Official downloaded data; preserve binary and source label bytes; source URLs and hashes recorded.
- Geometric simultaneous vectors with aberration correction NONE, not apparent Horizons equivalence.
- Coarse 7.58km DEM/polar limitations remain in outputs; matching coordinates does not improve terrain resolution.
- Do not modify other agents' backend ephemeris, catalogue, analysis or UI files.

## Review Focus
- Wrong frame/datum: exact MOON_ME_DE421 and 1737.4km radius offset, never implicit IAU_MOON.
- Wrong observer: surface height comes from verified DEM, not arbitrary input override; compare registration fields.
- Tampered data: kernel and DEM hashes verified, no fabricated real inputs accepted by default registered command.
- Missing coverage/time ordering: explicit failures, no fallback or silently intersected timestamps.
- Numerical orientation: independent cardinal, orthonormal basis, topocentric parallax and frame-transform consistency checks.

## Task 1: Official frame evidence and kernel set
Files: data/kernels/**, scripts/inspect-lunar-frame.py, docs/frame-registration-evidence.md.
- [x] Download official moon_080317.tf, moon_pa_de421_1900-2050.bpc, naif0012.tls, de421.bsp, recording URLs/bytes/SHA256 in manifest.json `{files:[{fileName,url,bytes,sha256}]}`.
- [x] Match LOLA label definition to explicit DE421 ME frame using official frame kernel text.
- [x] Run frame transform orthogonality/determinant and timestamp coverage checks.

## Task 2: Registered sky producer
Files: src/features/visibility/registered-sky.py, tests/test_registered_sky.py, scripts/requirements-registration.txt, docs/registered-sky.md.
Consumes manifest and request {scenarioId,siteId,latitudeDeg,longitudeDeg,observerHeightM,surfaceHeightM,terrainSha256,frame,timesUtc}.
Produces SkySeries plus registration {siteId,latitudeDeg,longitudeDeg,observerHeightM,surfaceHeightM,observerRadiusM,terrainSha256,bodyFixedFrame,localFrame,aberrationCorrection,kernelHashes}.
- [x] Write independent geometry/metadata rejection tests before implementation.
- [x] Use SPICE DE421 body-center vectors in MOON_ME_DE421, subtract exact observer Cartesian position, project to north/east/up; derive solar angular radius from distance.
- [x] Verify manifest files before loading kernels; reject unsupported time range and malformed UTC.
- [x] Run `python -m unittest discover -s tests -p test_registered_sky.py -v` including actual kernel integration, no skipped acceptance tests.

## Task 3: Registration gate and real end-to-end command
Files: src/features/visibility/registration.mjs, scripts/run-registered-analysis.mjs, tests/registration.test.mjs, docs/registered-workflow.md.
- [x] Implement buildRegisteredRequest(dem,options) deriving surface height internally.
- [x] Implement validateRegistration(sky,document,request) checking the same location/radius/frame/hash/time fields and kernel hashes.
- [x] Run Python producer in isolated subprocess, gate before computeVisibility, write horizon/sky/visibility/validation output without synthetic fallback.
- [x] Add tamper tests and actual end-to-end CLI test.

## Coordinator verification and publication
- [x] Transfer audited initial deliverable onto actual integration base e744dc6; node tests48/48; commit3ff91e6; push successful.
- [x] Read all new code and tests personally; independently reconstruct observer/basis/vectors and compare projections.
- [x] Run Node suite, Python suite, kernel inspection and real registered CLI. Review metadata and numeric errors, not merely exit codes.
- [x] Update team note and current workflow docs (historical limitations marked superseded where registration resolves them).
- [ ] Commit verified changes, push feat/horizon-visibility and verify remote SHA. No PR/merge before complete.

## Verification record

Coordinator reran kernel inspection (frame ID 31007; orthogonality error 4.44e-16), Python acceptance suite (8 passed, no skips), Node suite (56 passed, no skips), and real CLI on 2026-11-14. Read-only Luna review found no confirmed production geometry/provenance bug; request longitude normalization and test kernel lifetime issues found during review were corrected and suites rerun. Output registration at -89.9/0, height2m uses sampled surface96.89049795269966m and radius1737498.8904979527m. Generated output stays ignored and reproducible. Backend/UI remains unchanged.
