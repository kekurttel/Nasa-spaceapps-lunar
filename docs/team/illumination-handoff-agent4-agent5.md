# Illumination handoff: agents 4–5

> Historical agent report. Current coordinator inventory, test results and scientific blockers: [`master-agent-handoff.md`](master-agent-handoff.md). Modules now exist; the engine remains experimental and fails scientific acceptance. Do not treat statements below about absent files or environment availability as current verification.

## Implemented owner-facing contract

- `src/features/visibility/illumination_sky.py` loads the existing `registered-sky.py` helper by file path; verifies required kernel bytes/hash manifest; computes strict UTC DE421 `SUN` state with `MOON_ME_DE421`, correction `NONE`; returns position/distance in meters, solar angular radius, epoch/frame/ephemeris/kernel hashes. All loaded kernels are unloaded in `finally`.
- Terrain loading delegates to `illumination_terrain.load_verified_terrain(image_path=None, label_path=None, manifest_path=None)`. Engine delegation is `illumination_engine.compute_tile(terrain, sun, window, output_step=1, disk_samples=19, max_disk_samples=61)`. The terrain and engine modules were not present in this checkout during this agent's run; integration calls deliberately fail with an explicit unavailable API error until supplied.
- ROI dimensions determine returned output shape by ceiling division; no requested output step is silently changed. Runner bounds ROI to verified 7600×7600, defaults to 64×64, never defaults to a 57.76M-pixel run.
- Eight NPZ keys and dtypes enforced; NaNs retained; no pickle. Sidecar JSON records contract/algorithm, ROI/resolution, source pins, epoch/Sun state, requested sampling and benchmark warning. Engine extras are filtered before writing.
- CLI: `scripts/run-illumination.py --epoch ... [--window row,col,height,width | --full-footprint] [--output-step N] [--tile-size N] [--disk-samples 19] [--max-disk-samples 61] [--output PATH]`. `--full-footprint` requires an explicit coarse step in practice (e.g. 120); no full-resolution claim.
- Benchmark harness targets 64², 512², full-coarse; captures per-case wall time, subprocess output/exit status and process peak RSS when available. Windows RSS uses `psapi`; Unix uses `resource`. Outputs remain in designated output dir.

## Engine semantic requirement: center-incidence / finite disk

Do not infer zero direct irradiance from center-Sun incidence `<=0`. Set `selfShadowed=1`, but still evaluate the solar disk; limb samples with positive normal cosine and clear terrain paths can produce positive irradiance. The revised shared contract also makes `castShadowed` center-ray terrain occlusion independent of normal orientation, and distinguishes `PARTIAL`/`MIXED` classes. Values: unknown 0, lit 1, self 2, cast 3, partial 4, mixed 5. Never fabricate visibility for unsupported terrain coverage; float outputs NaN.

## Verification status / blocker

`python -m pytest tests/test_illumination_sky.py -q`: 3 passed. Output-writer tests added; run in the integration environment. Initial test invocation found pytest absent; pytest was installed into the local Python environment. Terrain/engine APIs and SPICE kernels/data are not available in this checkout, so actual DEM benchmark runs cannot be completed here. Do not report benchmark numbers or real-data success from synthetic tests. Agent 5 must run the harness with both engine modules, pinned terrain and verified kernels installed; attach exact JSON results, convergence/ray coverage metadata, measured RSS, and failures. Full 80 m remains unbenchmarked unless actually completed.
