# Git integration audit — 2026-11-14

## Inspected remote branches
- `origin/feat/data-scenarios`: eb3f97a6704daa8107383af550bb1ca3ad5ac369. Unrelated root history; do not wholesale merge over application.
- `origin/feat/lunar-ephemeris-review`: f1e5d12772d29826549be58ab0e948031e21b334.
- `origin/feat/horizon-visibility`: 7b11a4553b42600dbc973dae8272fbb6066dd8aa.

Ephemeris and visibility branches do not modify the application's backend/frontend paths relative to e744dc6. They add independent source modules and workflows, not FastAPI routes. This integration does not merge those independent workflows or claim to execute them.

## Scientific compatibility
- IAU_MOON sky vectors are not MOON_ME_DE421 registered terrain observations. No frame relabelling or implicit transformation is performed.
- LunaNav precomputed artifacts remain a distinct backend engine, with artifact provenance, exact catalog matching, fixed native observer parameters and hourly cadence.
- A schema adapter does not establish scientific frame compatibility. Missing solar radius, unverified upstream frames and incompatible observer elevations must not be fabricated.
- Independent catalog entries are not automatically supported local series. No nearest-site snapping.
- Source and transport contracts differ: camelCase parallel arrays versus snake_case point records. See contract compatibility document.

## Repository reproducibility
All required Python modules, frontend components, runtime data, notices and tests must be committed together. `data/lunanav` is the bounded distributable bundle; local `lmNasa-main`, browser profiles and screenshots remain untracked/ignored. Do not commit unrelated user notes.

## Independent branch tests
Read-only archived test runs: data 36/36; ephemeris 57/57; visibility 52/58. Six registration tests blocked by missing spiceypy; registered sky integration is not verified. No claim of full branch merge or full reference parity.

## Visual check
Build succeeds. Frontend visual gate has open failures, including landing-page rhythm checks inappropriate to this dense scientific workspace; no visual-gate pass claimed. A genuine terrain badge overlap was corrected.
