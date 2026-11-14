# Reference parity integration

Reference: local `lmNasa-main`, upstream https://github.com/yutuf/lmNasa (MIT, copyright 2026 yutuf).

## Data priorities
1. Real LOLA terrain mesh, source resolution and coverage.
2. Real skyline profiles from LOLA, 2 m observation height.
3. Native ephemeris coverage and interpolation disclosure; preserve DE421 metadata where provided rather than claiming blanket DE440.
4. Terrain-adjusted Sun/Earth visibility, independent scenarios.
5. Dataset health, explicit out-of-range errors; no silent synthetic fallback.

## Feature parity is not yet complete
The reference includes mission search across 21,856 points, DSN, eclipse checks, NASA region outlines, rover driving/routing/survival, ice and thermal datasets, language guide, report, sharing and year scan. Local mission search and some layers are exposed; this does not establish complete feature parity or scientific validation. Remaining features require explicit integrations, not merely similar interface labels.

## Current execution boundary
The ephemeris/terrain UI calls the existing local `/api/ephemeris`, `/api/ephemeris/single` and `/api/terrain/{id}` routes using bundled LunaNav artifacts. Mission search calls `/api/mission/search`, a local NumPy atlas adaptation. These UI paths do **not** invoke teammate CLI engines or `/api/contracts/local-analysis`. The contract bridge is a separate transport, not proof of teammate-engine integration.

## Ranking is a heuristic, not a mission decision
Inspected `backend/app/mission_search.py`, `evaluate_windows` and `search`: the fixed score is `round(100 * (0.4 * sun_fraction + 0.3 * earth_fraction + 0.3 * battery_margin) * multiplier, 1)`. Sun fraction counts hourly samples with at least 50% of the solar disk visible; Earth fraction counts geometric visibility samples. Battery margin is `clip((minimum_soc - min_soc)/(1 - min_soc), 0, 1)`. Multiplier is `1` for threshold passes, `0.25` otherwise. Rank is score descending, atlas index ascending; earliest start wins score ties.

Slope is a prefilter. The backend `go` flag checks only selected Sun, Earth, longest-darkness and minimum-battery thresholds under this simplified model. `feasible_*`, `go_count` and `battery_survived` are model-specific field names, **not scientific feasibility, landing safety or GO/NO-GO certification**. The UI labels them as threshold passes. The 40/30/30 weights are fixed reference choices, not validated physical trade-offs.

NASA/USGS attribution concerns upstream-declared data provenance; MIT concerns software licensing. Neither establishes scientific accuracy or endorsement. SHA-256 establishes byte integrity against a manifest, not source authenticity or scientific validation.

Scientific values must carry provenance and method. 15-minute output derived from hourly vectors is interpolated output, not independent 15-minute DE440 samples. A surface image is not a terrain elevation measurement. Earth geometric visibility is not a communications link guarantee.
