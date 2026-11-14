# Reference parity integration

Reference: local `lmNasa-main`, upstream https://github.com/yutuf/lmNasa (MIT, copyright 2026 yutuf).

## Data priorities
1. Real LOLA terrain mesh, source resolution and coverage.
2. Real skyline profiles from LOLA, 2 m observation height.
3. Native ephemeris coverage and interpolation disclosure; preserve DE421 metadata where provided rather than claiming blanket DE440.
4. Terrain-adjusted Sun/Earth visibility, independent scenarios.
5. Dataset health, explicit out-of-range errors; no silent synthetic fallback.

## Feature parity is not yet complete
The reference also includes mission search across 21,856 points, DSN, eclipse checks, NASA region outlines, rover driving/routing/survival, ice and thermal datasets, language guide, report, sharing and year scan. These require explicit integrations and validation, not merely similar interface labels.

Scientific values must carry provenance and method. 15-minute output derived from hourly vectors is interpolated output, not independent 15-minute DE440 samples. A surface image is not a terrain elevation measurement. Earth geometric visibility is not a communications link guarantee.
