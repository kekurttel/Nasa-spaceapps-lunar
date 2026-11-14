# LOLA LDEM_4_FLOAT horizon producer

`src/features/visibility/lola.mjs` provides synchronous `loadLolaDem(imageBytes, labelText)`, `sampleLolaHeightM(dem, latDeg, lonDeg)`, and `buildLolaHorizon(dem, options)`.

## Data preparation

Clean-clone data download, hash verification, Python setup and real scientific tests: `node scripts/prepare-data.mjs --setup-python --test`. See [data preparation](data-preparation.md) for offline verification, source manifests and exact verified file sizes/hashes.

## Input and vertical reference

The loader accepts only the supplied authoritative PDS3 LRO/LOLA `LDEM_4_FLOAT` V3.0 image and exact label by SHA-256 (`6eaee9376442dc851b8f8e94790499ec339d923367d7b8608a4316088b85bd45` and `37315910c3064d66623180fe49e91abc6c0c6b43b064042d2ac8002d997479d4`), and also checks dimensions, sample type, units, scaling, radius, coordinate reference, georeferencing limits and stated min/max limits. It checks exact raster length and every decoded value. The loaded array is checked against its original digest before horizon production. Heights returned by sampling are meters of radius offset relative to the product's 1737.4 km reference sphere; these are not geoid or sea-level elevations. The raster is 720 rows × 1440 columns, 4 pixels/degree, little-endian IEEE float32 in kilometers. Coordinates refer to pixel centers: `lat=90-(row+0.5)/4`, `lon=(col+0.5)/4`. Longitude wraps periodically. Valid coordinates in the polar half-cell beyond the outermost pixel-center latitude (±89.875° through ±90°) clamp to the nearest polar row. Coordinates outside ±90° are rejected. This preserves valid polar queries, but does not perform polar extrapolation; the producer warns if the site or radial search enters this cap because longitude-varying edge-row heights can create artificial slopes. Polar profiles should not be treated as reliable local horizons.

The official image source is [NASA PDS Geosciences Node LDEM_4_FLOAT](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/float_img/ldem_4_float.img). PDS label and catalog should be consulted for product interpretation and usage terms; this documentation does not assert a separate SPDX license or NASA endorsement.

## Horizon method and limitations

The producer walks bearings from north clockwise at `azimuthStepDeg` and samples spherical great-circle destinations at positive `distanceStepM` increments through `maxDistanceM`. Each apparent elevation uses `atan2(Rterrain*cos(delta)-Robserver, Rterrain*sin(delta))`; the maximum starts at −90°, so negative horizons remain negative. Search is bounded at 500 km and 200,000 total ray samples; when the requested maximum is not an exact step multiple, the reported maximum is the actual last sample (rounded down to a full step). The output document has a full-circle profile and `ME_DE421_LOCAL_NORTH_EAST` coverage frame and includes source, search settings and algorithm provenance.

**This is a coarse global model, not suitable for landing-safety or local-hazard assessment.** The nominal pixel scale is about 7.58084 km. Small craters, rocks and local slopes are not resolved; near-field terrain and features between radial samples may be under-resolved. Terrain outside the finite `maxDistanceM` search is ignored. The output warnings repeat these limitations. Synthetic hand-built DEMs are labeled `synthetic` and are for tests only.
