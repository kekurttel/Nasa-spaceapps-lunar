# Agent3 — versioned illumination raster contract request

Status: BLOCKED_ON_PRODUCER_CONTRACT. Consumer delivered on `feat/lunar-navigator-unified` (`e40edc6`, follow-up `0a34776`). Remote checked 2026-11-14: `feat/horizon-visibility` at `e241cee6d9f149767379a4891cb0344cf2a7d28d`; polar DEM/registration code present, no versioned 2D illumination output found. No merge requested. This is a request, not an approved upstream schema.

## Required delivery

1. Branch, commit SHA, schema path, producer function signature and minimal real-polar fixture with reproducible command.
2. Explicit schemaVersion and compatibility policy.
3. Grid width/height, row-major ordering, CRS/WKT or fully specified projection, body-fixed frame/epoch, origin at corner or center, axis signs, pixel dimensions/units and bounds. State vertical datum, observer height convention and DEM validity mask. Geographic degrees must not be relabeled metres.
4. Illumination quantity definition: fraction of visible solar disk, irradiance, or binary state; thresholds, finite-Sun/penumbra treatment, refraction assumptions. Our consumer accepts visible fraction 0..1 and explicit null NoData only.
5. UTC timestamp semantics and producer time scale conversion; start/end interval support or instantaneous snapshot semantics. Explain whether output actually certifies state over `[startUtc,endUtc)`. Consumer must not turn snapshots into full-duration truth, fill gaps, or extend last timestamp.
6. DEM source URL, product/version, spatial resolution/coverage, file bytes/hash and checksum origin, source units/scale/offset/NoData, processing/resampling lineage; solar ephemeris source/version/kernel hashes/query/frame/time coverage.
7. Warnings and unresolved coverage (spatial and temporal); provenance must preserve uncertainty. Missing cells must not become dark terrain.
8. Test fixture for moving shadow boundary, NoData barrier and temporal gap; independent real-polar reference comparison and limits. 18.6-year elapsed span alone is not permanent-PSR proof.

## Consumer mapping / acceptance

- `src/features/analysis/illumination.mjs`: isolated `temporal-illumination/v1` adapter input; retain upstream metadata intact, never claim wire compatibility by matching field names.
- Reject unknown versions, inconsistent geometry, unsupported quantity, unordered/overlapping intervals, frame mismatch and invalid fractions.
- If producer supplies snapshots only, expose sampled evidence separately; do not populate interval-duration analysis without explicit supported approximation and uncertainty contract.
- Run existing point regression plus real raster adapter tests. Check total supported/missing duration, DEM/kernel lineage, unchanged NoData masks and reproducible SDF.
- Keep boundary migration/connectivity experimental. No HTTP/UI enablement until producer mapping is reviewed.

## Response template

```text
branch / SHA:
schema path / version:
producer signature:
fixture + command:
CRS / frame / axis / origin:
NoData / quantity:
time semantics / interval support:
DEM + ephemeris provenance:
independent validation / unresolved limitations:
```

No large DEM download authorized by this request. No alternate ray engine requested.
