# Measured lunar terrain: data, provenance, limitations

## Included asset

`pole_dem.bin` (4,602,602 bytes, unchanged copy) from
`lmNasa-main/web/public/data/pole_dem.bin` in this repository.

SHA-256: `940998902349d937387aa7cd151dbdc704b5a820f7261a76daf490a886c9cfcd`

Source science data: NASA Lunar Reconnaissance Orbiter (LRO), Lunar Orbiter
Laser Altimeter (LOLA), Planetary Data System (PDS) south-polar gridded elevation
product `ldem_85s_40m.img` with its accompanying PDS label.

PDS archive:
https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/

NASA / LRO / LOLA and the NASA PDS Geosciences Node are credited for the
measurements and distribution. NASA names do not imply endorsement. The MIT
license below covers the reference software; it does not relicense NASA data.
Scientific data retain their original NASA/PDS provenance and archive terms.

Reference software copyright (c) 2026 yutuf, MIT License. Full original license:
[LICENSE-MIT.txt](LICENSE-MIT.txt). Parser, projection and sampling adapted from
`lmNasa-main/web/src/terrain.ts` and `lmNasa-main/lunanav/polar_grid.py`.

## Export history and binary layout

`lmNasa-main/scripts/make_polar_grid.py` selects every fifth sample of the
40 m product, yielding 200 m sample spacing (decimation, not new measurements).
`lmNasa-main/scripts/export_web_data.py` writes the fine polar grid to this
binary. The component does not use generated noise, crater approximations,
global texture relief or fabricated data as a fallback.

All fields little-endian:

| Offset | Type | Meaning / included value |
| --- | --- | --- |
| 0 | uint32 | rows: 1517 |
| 4 | uint32 | columns: 1517 |
| 8 | float32 | projected sample spacing: 200 m |
| 12 | float32 | line origin: approximately 758.3 |
| 16 | float32 | sample origin: approximately 758.3 |
| 20 | float32 | height scale: 0.5 m per digital number |
| 24 | int16[rows * columns] | row-major elevations |

Grid indexing: `col = sample0 + x / spacing`, `row = line0 - y / spacing`.
South-polar stereographic projection: `rho = 2 R tan((90° + latitude) / 2)`,
`x = rho sin(longitude)`, `y = rho cos(longitude)`, `R = 1,737,400 m`.

## Rendering and honest bounds

- A 40 × 40 km projected window is sampled at 200 m spacing around the selected
  position, using bilinear interpolation of actual DEM cells.
- Dataset footprint is a square approximately ±151.6 km in polar projection;
  its inscribed latitude is approximately 85° S. Corners extend farther north.
  Coverage is tested against the actual grid, not a claimed global DEM.
- Signed-int16 special/missing values at or below -32767 are rejected. Any
  triangle touching unavailable samples is omitted. No extrapolation.
- Each sample is inverse-projected to lunar latitude/longitude and positioned
  at radius `1,737,400 m + measured elevation`. Cartesian coordinates are then
  rotated into the selected site's east/up/south tangent frame. Thus real
  curvature and metre-for-metre elevations are retained, vertical scale 1:1.
- Elevations are metres relative to the 1,737.4 km lunar reference sphere, not
  metres above terrestrial sea level. 0.5 m encoding is **not** measurement
  accuracy. 200 m sampling is **not** 200 m horizontal accuracy.
- Ground view uses eye height 2 m above the rendered mesh; WASD movement stops
  at data gaps or the mesh boundary. It cannot resolve rocks, rover hazards,
  sub-grid slopes, engineering landing safety or metre-scale topography.
- Selected `EphemerisPoint.sun_elevation` and `sun_azimuth` define the local
  directional sunlight (azimuth clockwise from north). Local terrain casts
  mesh shadows. This is not a full distant-horizon, solar-disk visibility,
  thermal, photometric or physical regolith model. A disclosed faint ambient
  inspection light keeps unlit terrain legible. Without valid ephemeris,
  explicitly labelled neutral inspection lighting is used.
- The cyan orbit marker indicates the selected site; it is not measured relief.
- Missing asset, unsupported WebGL and coordinates outside the measured DEM
  produce explicit messages; no synthetic fallback.

## Component integration

```tsx
import MeasuredTerrain from './components/MeasuredTerrain';

<MeasuredTerrain site={site} moment={selectedEphemerisPoint} language={language} />
```

`site: SiteRequest`, optional `moment: EphemerisPoint`, `language: 'tr' | 'en'`.
Uses installed `three`; no new dependency. Asset URLs respect CRA `PUBLIC_URL`.
Pointer drag rotates/looks; wheel zooms orbit; arrows look; WASD moves in ground
view; R or Reset restores the selected site. Canvas is keyboard focusable.
No App or backend modifications are required by the component itself.
