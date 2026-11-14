# Terrain quality/performance implementation plan

> For agentic workers: use bounded, non-overlapping subagent tasks. User explicitly delegated source discovery and implementation choices; no repeated request to user to find data.

**Goal:** Replace coarse-only terrain limitations with an evidenced, bounded-resource upgrade where an authoritative compatible product is available, and fix proven failures before committing.

**Architecture:** Preserve React/FastAPI and existing visibility contracts. Research official products before choosing a decoder/projection. Prefer regional height raster with windowed reading over loading global multi-GB imagery. Camera mosaics are not DEMs. Current registered CLI remains separate from backend until an explicit tested adapter is delivered; do not claim integration from research.

**Tech stack:** Existing Node.js visibility modules and Python SPICE; add dependencies only when selected product warrants them.

**Policy:** root sources.md and user-provided FEYNMAN_AGENT.md. Existing source roles and shortcomings remain disclosed. No scientific data mislabeled synthetic/real. No huge dataset in git. Large downloads need a stated size and consent; initial research may fetch small labels/headers only.

## Tasks

- [x] Official LDEM_80S_80M V2.1 JP2 and exact label researched, downloaded, hashed and actually decoded. Coordinator independently verified both hashes and four-pixel site interpolation (625.9534540020704 m). Research and exact metadata in docs/research/polar-dem-options.md; independent checks in docs/research/coordinator-polar-validation.md.
- [x] QuickMap/Moon Trek/challenge research recorded with explicit limits. Moon Trek WMTS capabilities and target-containing JPEG independently re-fetched by coordinator; frontend visual rendering and QuickMap scientific layer inspection remain unverified because browser is disconnected. Challenge page retrieval failed; no claim of current resource-list verification. See docs/research/map-source-evidence.md.
- [x] Coarse performance baseline recorded in docs/research/terrain-performance-audit.md. Polar performance/convergence remains pending actual downloaded raster and final implementation; denser coarse samples are not higher-resolution measurements.
- [x] Horizons registration research recorded with actual raw Sun/Earth DE441 vectors, HTTP headers, query, file hashes and reproducible comparison script. Coordinator independently reran `python docs/research/horizons/compare.py`: same JDTDB residual norms 0.125011003529 km Sun and 0.005603175645 km Earth against local DE421. This is one Moon-center epoch, NOT surface-observer registration or DE421 equivalence. See docs/research/horizons-registration-options.md.
- [x] Coordinator selects exact product and bounded download/read architecture from evidence. Selected official LDEM_80S_80M V2.1 JP2, 29,837,992 bytes; decode bounded region with Rasterio, no full Float32 copy. Design in docs/superpowers/specs/2026-11-14-polar-terrain-design.md. Decoder/fetch/tests and new runner/tests have separate file owners; existing sky engine reused.
- [x] Product-specific decoder, source/label pins, projection/pixel-center controls, NoData/edge sampling, work budget and separate runner implemented. Actual source hashes and four-neighbor site height independently confirmed. Default polar runner actually generated registered sky and visibility; partial 1000 m request reports actual 960 m samples. Final coverage regression/review cleanup still gated below.
- [x] Coordinator reran Node **64/64**, Python **26/26**, zero skipped; real default polar CLI exited 0, all registration checks true. Independent reviews drove runtime/provenance/coverage fixes; final review closure pending. Sampling and process-memory measurements in docs/research/coordinator-polar-validation.md; 64 MiB cache is not process limit.
- [ ] Commit verified deliverable on feat/horizon-visibility; push only authorized branch, verify remote SHA. Mark unresolved source/portal integration gaps instead of claiming all-source completion.

## Acceptance gates

Research alone is not a working high-resolution terrain upgrade. New height product must pass label/schema checks, true radius/height conversion, same body frame/local basis, valid site/ray coverage, NoData propagation, bounded I/O and memory, and actual result tests. At polar singularity, azimuth convention must be explicit. Performance defaults must report tested sampling and finite-search limits. Product choice and any dependency choice remain pending actual research, not assumed from filenames.
