# Real sky fixture investigation (JPL Horizons)

## Outcome / scientific status
Two raw, unmodified JSON API responses were successfully retrieved from the official JPL Horizons API. They provide real Sun and Earth apparent topocentric azimuth, elevation, and angular diameter over 2026-11-14 00:00–00:10 UTC at five-minute steps for the *specified Horizons geodetic site* (east longitude 0°, latitude -89.9°, altitude 0.002 km). These are valuable API/data format reference fixtures, but they are **not certified as a surface-registered Agent3 sky fixture**. Horizons reports its site altitude relative to its lunar reference ellipsoid, while the LOLA raster supplies radius relative to a mean 1737.4 km reference sphere and explicitly distinguishes planetary radius from geoid-relative topography. No evidence found establishes that simply using `alt=0.002 km` is the LOLA surface point plus 2 m, or reconciles the two frames/datums. Do not represent this as exact 2 m above the LOLA terrain.

## Saved raw responses
- `data/raw/horizons-sun-20261114.json`: `COMMAND=10` Sun, raw JSON wrapper and full Horizons result text.
- `data/raw/horizons-earth-20261114.json`: `COMMAND=399` Earth, raw JSON wrapper and full Horizons result text.
- Both are 8.8 KB-class small responses, downloaded directly from `https://ssd.jpl.nasa.gov/api/horizons.api` using HTTP GET. The API JSON `signature.source` identifies `NASA/JPL Horizons`; response headers identify Horizons API 1.2.

Request parameters used for both: `format=json`, `EPHEM_TYPE=OBSERVER`, `CENTER=coord@301`, `COORD_TYPE=GEODETIC`, `SITE_COORD=0,-89.9,0.002` (east longitude deg, latitude deg, altitude km), start `2026-11-14 00:00`, stop `2026-11-14 00:10`, `STEP_SIZE=5m`, `QUANTITIES=4,13`, degrees, CSV table embedded in JSON (`CSV_FORMAT=YES`). The API URL/query is reproducible from these parameters; raw result text preserves request context and all returned rows.

## Verified returned samples
Both responses name DE441, Moon (301) center, and give the center site as `0.0, -89.9, .002 {E-lon(deg),Lat(deg),Alt(km)}`. They report `Center pole/equ: MEAN_ME (high precision)` and radii `1737.4, 1737.4, 1737.4 km`; computation is explicitly airless. Rows:

| Target | UTC | Apparent azimuth (deg) | Apparent elevation (deg) | Angular diameter (arcsec) |
|---|---|---:|---:|---:|
| Sun (10) | 2026-11-14 00:00 | 126.619609 | 1.496957 | 1942.009 |
| Sun (10) | 2026-11-14 00:05 | 126.577287 | 1.497017 | 1942.007 |
| Sun (10) | 2026-11-14 00:10 | 126.534966 | 1.497077 | 1942.006 |
| Earth (399) | 2026-11-14 00:00 | 358.772809 | -4.548324 | 6485.989 |
| Earth (399) | 2026-11-14 00:05 | 358.768004 | -4.544821 | 6486.006 |
| Earth (399) | 2026-11-14 00:10 | 358.763199 | -4.541315 | 6486.023 |

Horizons describes `Azi_(a-app), Elev_(a-app)` as airless apparent target-center direction, azimuth clockwise from north (N=0°, E=90°), elevation relative to a plane perpendicular to local zenith, topocentric only. `Ang-diam` is full-disk equatorial angular width, arcseconds. These results must not be mislabeled as terrain-horizon occultation/visibility: DEM-based local terrain obstruction is a separate calculation.

## Terrain site / datum compatibility investigation
The already acquired source LOLA label is `data/raw/lola_ldem_4_float.lbl` (PDS3 `LDEM_4_FLOAT`, `LRO-L-LOLA-4-GDR-V1.0`). It says simple cylindrical, body-fixed `MEAN EARTH/POLAR AXIS OF DE421`; A/B/C and radius offset 1737.4 km; DN values are radius minus the reference sphere, and geoid-relative topography requires `GEOID_RADIUS` from a gravity equipotential model. Horizons instead states `Center pole/equ: MEAN_ME (high precision)`, geodetic ellipsoid radii all 1737.4 km, and coordinate altitude above that ellipsoid. The API metadata does not establish identity of the body-fixed longitude/latitude realization, pixel-center transformation, or the relationship of MEAN_ME to LOLA's ME/DE421 grid and geoid. The matching numeric 1737.4 km radii alone is insufficient to prove datum/frame alignment.

The requested terrain-aware location cannot yet be formed rigorously from the selected low-resolution DEM cell. Blindly setting Horizons site altitude to `2 m` treats the reference surface as the ellipsoid, not the local terrain radius/elevation. Blindly adding LOLA DN to 2 m is also not justified because Horizons site altitude is ellipsoid geodetic height and LOLA distinguishes reference-sphere radius from geoid topography. In addition, the 4 ppd DEM is about 7.58 km/pixel, too coarse for a dependable local surface normal/site elevation at this latitude. This is a scientific blocker for declaring the raw responses aligned to “2 m above LOLA terrain.”

## What is and is not claimed
- **Verified:** genuine JPL Horizons API outputs, targets, timestamps, query site parameters, azimuth/elevation/angular-diameter values, API metadata, and Horizons' stated lunar ellipsoid/frame label.
- **Not verified:** exact site position 2 m above the LOLA terrain; identity/reconciliation of Horizons `MEAN_ME` and LOLA `MEAN EARTH/POLAR AXIS OF DE421`; local terrain occultation; that the reported geometric center is visibility above the terrain.
- Public JPL API documentation and raw metadata were used as provenance. Horizons service attribution is retained inside raw responses. Do not imply NASA endorsement. No special data license was asserted.
- If a downstream tool consumes these files, treat them only as independently sourced direction/time fixtures for the exact Horizons `coord@301` geodetic request, with datum mismatch prominently surfaced. Do not silently call them a validated terrain-registered fixture.
