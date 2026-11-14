# Full-screen Moon shell handoff

## Scope / stack

Retained React 19 + TypeScript + CRA + Three 0.160, Recharts and Leaflet. No dependency migration: minimizes integration risk while real scientific contracts remain pending. No backend/science changes, no Git history manipulation, commit or push.

`App.tsx`: 100dvh Moon-first shell; Regions, Scenarios, Results & evidence, Settings native-dialog panels. Independent A/B date/duration analysis and catalog/coverage guards unchanged. Exports in Results. Existing measured terrain, horizon, timeline, search and science panels retained inside evidence drawer. Settings preserve existing A/B/C palette storage. No fake percentages or substitute analysis.

`ScenePanel.tsx`: native modal dialog, Escape, explicit close, browser focus containment/restoration. `ScenePanel.test.tsx`: panel state/Escape/close and single accessible shine name. Existing App integration tests mock presentation wrapper to retain scientific guard assertions; actual panel tested separately.

`ShineText.tsx` + `SceneShell.css`: stable text plus aria-hidden masked duplicate; narrow band travels left-to-right over 1100–1200ms once on entrance/hover/focus. Reduced-motion CSS disables decoration; globe selection snaps instead of flight when OS reduced-motion enabled.

`LunarSurface3D.tsx`: existing on-demand Three renderer retained, real packaged LROC albedo plus reference-derived normal. Removed invented radial relief and artificial vertex colours. Sphere shape, illustrative lighting explicitly labelled; not a shadow solver. 900ms selection orientation, drag/keyboard rotate, wheel/+/- zoom, reset. DPR capped 1.5 mobile/2 desktop; no perpetual animation loop. Visibility skips rendering; resources disposed; texture load failure labelled. No stars/rovers/game scene.

## Scientific boundary

200 m measured mesh remains separate from illustrative globe. 80 m DEM delivered separately on remote horizon work; numerical shadow atlas API contract pending. No shadow routes/types/adapters invented. Needs versioned CRS/tile matrix/time samples/layer units/nodata/pixel inspection/fingerprint/boundary semantics. IAU_MOON versus ME_DE421 remains unverified; point local-analysis data is not an atlas substitute. DSN geometry not antenna allocation/link budget guarantee.

## Assets

Existing `moon-lroc-2k.jpg`: 553,660 bytes. Added `moon_normal.jpg`: 1,062,320 bytes, reference MIT Copyright 2026 yutuf preserved in `frontend/public/textures/lmNasa-LICENSE.txt`. Details `frontend/public/textures/SOURCES.md`. Reference normal is enhanced LOLA gradient shading, not elevation truth. No pole textures or rover assets copied. Local packaged URLs only.

## Validation

- Main `frontend`: `npm ci --no-audit --no-fund` succeeds (1363 packages; existing CRA deprecation warnings).
- `CI=true npm test -- --watchAll=false --runInBand`: 5 suites, 45 tests passed.
- `npm run build`: passed; gzip main JS 399.09 kB, CSS 17.96 kB. First build exceeded 120s, retry 300s succeeded.
- Clean existing backend venv `python -m pytest backend/tests -q`: 97 passed, 15 subtests, 5 dependency warnings.
- Skill `shoot.mjs` produced desktop/mobile screenshots: `docs/team/moon-shell-{1440,1024,768,390,320}.png`; 320 reduced-motion. Actual headless Chromium captures, no fake screenshots.
- Skill layout checker crashed `Cannot read properties of undefined (reading 'map')`, then `r.sections is not iterable`. No checker pass claimed. Screenshots cover shell only, static server has no API so catalog failure appears.

## Remaining review / limits

Image captures could not be reliably inspected in model context (image tool returned success but subsequent image context omitted). Coordinator must visually inspect screenshots before approval. No claim of visual gate pass, measured FPS, full browser keyboard audit or WebGL/texture fault-injection test. Interactive native dialog appearance, actual API results drawer, focus restoration and all breakpoint collision checks need coordinator browser review. Final localization/measured-view CSS fixes postdate screenshots; final main-workspace test rerun passed 45/45 and production build passed (399.08 kB JS, 18.05 kB CSS gzip). No Vite/R3F migration attempted. CSS intentionally overrides old dashboard styles; future cleanup could replace old unused shell rules after visual approval.
