# LunarSight surface integration

## Implemented
- Three.js globe with locally served NASA SVS LROC global imagery, synthetic displacement clearly identified.
- Demand rendering, keyboard rotation/zoom/reset, WebGL fallback, resource cleanup.
- Turkish/English switch, persisted language, translated scientific components.
- Actual display aids: grid, shadow lifting, illustrative detail, angular rings; unavailable measured layers disabled.
- Independent A/B dates and 7/30/90/365-day durations; separate existing API calls, explicit calculation action.
- Timeline pin passes actual ephemeris moment into globe lighting.
- Power estimate based on longest dark interval and editable load; geometric communication limits disclosed.
- CSV and JSON exports include scenario periods. Unsupported heuristic feasibility score removed.

## Verification
- Production build compiled successfully.
- Three React tests pass (controls/no automatic calculation, Turkish switching, honest service error).
- Production screenshots at 1440 and 390 px inspected. Mobile globe displays real lunar imagery.
- Production preview: http://localhost:3001 . Existing :3000 dev server had a stale TypeScript overlay; not a production build error.

## Still missing
- DEM-derived local terrain scene and measured LOLA skyline; current globe is not a local surface reconstruction.
- Yale star catalogue, LROC 100 m local brightness layer, 15-minute backend sampling.
- Measured skyline clearance, comprehensive populated-result browser verification, full reference feature parity.
- Full visual quality gate not rerun; no claim of gate pass.

NASA imagery source and processing credit: frontend/public/textures/SOURCES.md.
Other agents' backend/data files unchanged. No raw 680 MiB TIFF published.
