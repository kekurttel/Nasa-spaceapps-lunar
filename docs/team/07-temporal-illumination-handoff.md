# Temporal Shadow Intelligence — Agent5 handoff

## Delivery status

Temporal reducer and experimental spatial descriptors implemented. **Agent3 versioned 2D map contract is absent in this checkout and neighboring visibility-work/lunar-repo.** Existing Agent3 supplies single-site HorizonProfile/VisibilitySeries, not raster maps. Therefore this delivery defines an isolated adapter boundary, not verified upstream compatibility. No second ray engine, fabricated DEM maps, or real-polar validation claim.

## Temporal adapter

`src/features/analysis/illumination.mjs` exports:

- `validateIlluminationSeries(input)`
- `analyzeIllumination(input, { atUtc = input.startUtc, seasons = [] } = {})`
- `planHierarchicalIllumination(options = {})`

```js
const input = {
  schemaVersion: 'temporal-illumination/v1',
  grid: {width: 1, height: 1, crs: 'producer-projected-CRS', units: 'm',
    originXM: 0, originYM: 0, pixelSizeXM: 80, pixelSizeYM: 80},
  startUtc: '2026-01-01T00:00:00Z', endUtc: '2026-01-01T01:00:00Z',
  frames: [{startUtc: '2026-01-01T00:00:00Z', endUtc: '2026-01-01T01:00:00Z', fractions: [0]}],
  quality: {dataSource: 'producer-source', demSha256: 'producer-hash',
    solarEphemerisSource: 'producer-kernel-lineage', frame: 'producer-body-frame'}
};
```

Row-major fractions: 0 umbra, strictly 0..1 penumbra, 1 fully sunlit, null NoData. Grid must stay fixed. Dense arrays only. Explicit half-open intervals, ordered/nonoverlapping, inside evaluation interval. **Producer must justify interval support. Instantaneous snapshots are not automatically interval observations.** No final-frame extrapolation. Gaps and NoData remain unknown, break continuous runs and transition comparisons.

Totals use seconds, not frame counts. Illuminated duration means fraction > 0; equivalent-full-Sun seconds integrates fraction. Duty cycles divide observed support, not requested interval; coverage fraction is returned alongside them. Longest sunlit run means any sunlight including penumbra. Three-state transitions and binary illumination transitions returned separately. First illumination is supported interval start; last illumination is exclusive interval end, not an observed physical sunset. Next sunlight is null if a preceding unknown interval blocks inference or no supported future sunlight exists; zero if currently lit. Times never extrapolate past evaluated interval.

Season bins are caller-defined UTC intervals; no inferred lunar seasons from Earth calendar. At least two fully covered bins required for variance. Variance is duration-weighted population variance of bin duty cycles; units dimensionless squared. Seasonal phase/physical interpretation remains producer responsibility.

## Conservative classifications / SDF

Complete umbra support gives `PERSISTENT_SHADOW_IN_INTERVAL`; never permanent PSR. Other classes: `ALWAYS_ILLUMINATED_IN_INTERVAL`, `INTERMITTENTLY_ILLUMINATED`, `PARTIAL_ILLUMINATION_REGIME`, `UNKNOWN_OR_INSUFFICIENT_COVERAGE`. Any gap/NoData makes interval classification unknown. `nodalCycleDurationSatisfied` checks only elapsed 18.6 Julian years and support: not astronomical coverage, sampling convergence, cross-validation, or permanent-shadow proof. `permanentShadowClaim` always false.

SDF version `shadow-dynamics-fingerprint/v1`: named raw physical features. Duty cycles/coverage normalized 0..1; durations remain seconds, counts integer, variance unscaled. No arbitrary combined score. Unknown metrics null, never zero-filled. `uncertaintyClass` denotes temporal support only, not overall physical accuracy. Source quality preserved; metadata completeness reported but hashes/CRS not independently certified here. Temporal discretization and spatial resolution remain limitations even with full coverage.

## Hierarchy / performance

Planner only: A coarse polar screening (default 1280 m, 6 h, at least 18.6 years); B refine transition brackets (default 300 s); C selected regions/windows at source finest-supported resolution (requested 80 m, **not available current LOLA 7.58 km/pixel**). Plan does not execute ray tracing or certify a DEM supports 80 m. Before long-term claim: run adaptive producer, convergence tests against smaller spatial/time steps, kernel coverage checks, unresolved-gap accounting, peak-memory/runtime measurements and independent reference validation.

Synthetic benchmark `node scripts/benchmark-illumination.mjs`: 4096 cells × 96 intervals (393216 cell-intervals), 32.26 ms, process RSS 85,344,256 bytes, Node v26.13.0 in this run. RSS is process resident memory after run, **not measured peak memory**. Not real-polar or 18.6-year performance/convergence evidence. Reducer time O(cells × frames × (1 + season bins)); retains per-cell outputs, validates all input raster values.

## Boundary migration / connectivity — experimental

`src/features/analysis/illumination-spatial.mjs` exports `analyzeIlluminationSpatial({grid,frames,scenario,maxComparisons?})`. Same grid/fraction/explicit-interval shape; scenario `{startUtc,endUtc}`. Read module JSDoc for coordinate convention and outputs. Boundary motion uses nearest boundary geometry on common known support, not identity tracking, optical flow or terrain travel speed. Midpoint-to-midpoint elapsed time; metres, m/s, km/h; zero-displacement direction undefined. Gaps do not create migration links. Repeated observed threshold crossings are discrete lower bounds. Spatial resolution and sampling may alias fast motion; nearest geometry may pair unrelated edges. Comparison cap fails explicitly.

Connectivity uses exact fully sunlit fraction 1, 4-neighbor raster components; penumbra not corridor. Persistent intersection requires complete temporal support, excludes unknown cells. Not traversability, vehicle route, power guarantee or landing assessment. Connectivity and boundary descriptors remain separate from temporal metrics.

## Evidence / remaining gates

Synthetic tests cover unequal intervals, missing support, exact interval boundaries, penumbra, long dark runs, transitions, short/incomplete nodal coverage, changed resolution, NoData, reproducible SDF, moving edge, stationary boundary, unknown barriers, disconnected islands and search cap. Existing point API retained; fractional UTC bug fixed without changing signature.

**Open integration gates:** obtain Agent3 versioned map contract; map actual CRS/origin/pixel-axis/NoData/provenance and certified temporal support explicitly; real polar boundary validation; actual 80 m DEM availability; temporal/spatial convergence and independent long-term PSR cross-validation. No HTTP/UI wiring until contract verified. No source portals treated as integrated inputs.
