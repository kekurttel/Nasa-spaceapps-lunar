# Lunar polar data foundation

This module defines source-backed region identities, DEM coverage states and evidence options. It does **not** calculate terrain shadows, illumination fractions, a permanent-shadow mask, temperature, volatile abundance or mission safety.

- DEM (digital elevation model): a raster of terrain heights/radii.
- PSR (permanently shadowed region): a region receiving no direct sunlight over a stated, sufficient temporal model; not a synonym for a cold pixel or a shadow in one image.
- Coordinate frame: the body-fixed axes to which positions refer. Similar latitude/longitude numbers in different frames are not automatically interchangeable.
- NoData: an absent/invalid terrain sample, not zero height and not an illumination state.

## Ownership and consumers

`src/features/data/polar/**` is additive Agent 1 data code. Existing Site/Scenario contracts and the landing-site catalog remain unchanged. The polar catalog is a **separate region catalog**, not an assertion that region representative coordinates are actual or suitable landing sites.

| Consumer | May consume | Must still provide |
| --- | --- | --- |
| Agent 3 terrain | Region coordinates/provenance, `polarDemDefinition`, `classifyPolarCoverage` | Verified source-frame conversion where needed; matching raw label/image; verified projection; actual raster pixel/mask; all interpolation neighbors and full ray-path coverage |
| Agent 4 analysis | Coverage status, `illumination: 'unknown'`, evidence-family metadata | A stated time span, Sun sampling/model, unknown-data propagation and genuine validation comparisons; no PSR verdict from this module |
| Agent 5 interface | Stable IDs, names, limitations, URLs, independent-data availability | Render unknown/NoData/edge/outside/missing validation distinctly; never paint an unknown pixel as illuminated or permanently dark |
| Agent 2 ephemeris | Unchanged Site/Scenario API | No new ephemeris computation or shared contract modification here |

## Authoritative terrain product boundary

Product `LDEM_80S_80M`, version `V2.1`, dataset `LRO-L-LOLA-4-GDR-V1.0`:

- NASA PDS/LRO LOLA label: <https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/jp2/ldem_80s_80m_jp2.lbl>.
- Label inspected online on **2026-11-14**. No raster or raw label is copied into this Git delivery; Agent 3's fetch workflow owns those artifacts and its existing manifest is not changed.
- 7600 columns × 7600 rows; polar stereographic, spherical radius 1,737,400 m; nominal 80 m/pixel **true at the pole**, not a constant accuracy guarantee.
- Planetocentric latitude −90° to −80°, east-positive longitude, `MEAN EARTH/POLAR AXIS OF DE421` body-fixed rotating frame.
- Signed 16-bit stored integer `dn`: radius in metres = `dn * 0.5 + 1737400`; height relative to that reference sphere = `dn * 0.5`. Do not use the full radius as surface elevation above the sphere.
- Label projection offsets: line/sample 3799.5 pixels; adapters must resolve corner-versus-centre conventions, not blindly pass array indices from another projection.
- Label acquisition interval: `2009-07-13T17:33:17` to `2017-02-02T22:18:35`. These are source terrain observation dates, **not an illumination simulation/validation interval**. They are not inserted as Scenario coverage.
- The inspected label does not declare a missing-value sentinel. `noDataValue` must remain unknown; a raster decoder/mask must supply validity. No signed integer, including 0 or −32768, is silently classified as NoData or sunlight by this layer.

### Geographic cap versus rectangular raster

The approximate −80° to −90° cap is an admission boundary, not proof of a valid sample. A 7600×7600 rectangular footprint includes corners outside the advertised latitude cap. Conversely, accepted geography without an actual verified raster index and valid decoded sample is still unknown. No geographic-to-pixel transform is implemented here; that belongs to Agent 3.

A `usable-dem` result means only that the supplied sample met this gate. It does not establish coverage for its interpolation neighbors, a ray's entire path, sub-pixel terrain, horizon visibility or permanent darkness. Exact south pole terrain geography is supported but north-based observer azimuth is singular; it cannot be advertised as a supported horizon observer by this module. Edge samples require additional context and must not default to illuminated.

## Scientific evidence, not a second shadow engine

Read [PSR-EVIDENCE.md](./PSR-EVIDENCE.md) and the exported evidence registry. Diviner measures thermal emission; LAMP measures ultraviolet radiance/reflectance; LOLA-derived PSR products model illumination using terrain and celestial geometry. The first two are distinct instrument observations but not direct certificates of permanent darkness. A LOLA-derived comparison shares terrain dependencies and is not an independent terrain truth set.

No independent validation raster is bundled. Availability is explicitly missing until a consumer verifies a chosen product's version, coverage, frame, time basis and usage terms, downloads it out of Git, and records a reproducible resampling/comparison procedure. A boolean availability flag never means a validation comparison passed.

## Public API example

```js
import {
  polarRegions, polarEvidenceSources, classifyPolarCoverage,
} from './src/features/data/index.mjs';

const marker = polarRegions.find(region => region.id === 'nobile');
// Sourced representative crater centre, NOT a landing/rim location.
// This module cannot verify or convert its frame or project a raster pixel.
const pending = classifyPolarCoverage({ latDeg: marker.latDeg, lonDeg: marker.lonDeg });
// pending.status === 'footprint-unverified'
// pending.illumination === 'unknown'
// pending.independentValidation === 'missing'
console.log(pending, polarEvidenceSources.map(source => source.url));
```

`projectionVerified`, `frameVerified`, `pixel`, `sample` and `independentValidationAvailable` are **caller assertions**, not work performed by this classifier. Do not set them merely because a named region lies in the approximate latitude cap. Raw sample zero is a valid zero height relative to the reference sphere, not missing data. `metadataUrls` on evidence entries preserves additional provenance-page links where relevant. Validation helpers check metadata structure, not source truth, scientific agreement or licenses.

Shackleton and de Gerlache records deliberately retain stable requested-area IDs while `regionType: 'crater'`, names and provenance label their coordinates as **centre markers**. They are not sourced rim coordinates. Malapert Massif has a verified named NASA product association but no established point here; both coordinates remain `null` and local analysis is unsupported. No region boundary polygon is invented. This is a remaining location-data limitation, not a completed rim/massif sampling dataset.

## Running checks

```sh
node --test src/features/data/tests/polar-*.test.mjs
```

All code uses Node built-ins and existing data validation helpers; no root dependencies, application routing or other agent implementation paths are changed. See `docs/team/01-data.md` for the actual delivery test results and subagent audit.
