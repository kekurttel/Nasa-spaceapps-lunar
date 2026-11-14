# South-polar LOLA DEM options for −89.9°, 0°

**Research retrieval:** 2026-11-14 UTC. PDS catalog and product labels fetched live over verified HTTPS. Initial research did not download a raster; later implementation (label at `2026-11-14T12:26:07.232866+00:00`, raster at `2026-11-14T12:26:51.279611+00:00`) downloaded the 80 m JP2 (29,837,992 bytes) and matching label to ignored `data/raw/polar/`, under the 30,000,000-byte cap. Product size rows include label declarations and later observed transfer evidence.

## Recommendation

Use the official PDS LOLA polar product **`LDEM_80S_80M`** (PDS3 product version V2.1, dataset `LRO-L-LOLA-4-GDR-V1.0`) as the first local polar DEM candidate. It covers planetocentric latitude −90° to −80°, hence includes −89.9°, and its compressed JP2 is 29,837,992 bytes (28.45 MiB), just under a 30,000,000-byte cap. The PDS label declares an equivalent uncompressed 7600 × 7600, signed little-endian 16-bit raster: 115,520,000 bytes (110.13 MiB) of raw samples, or approximately 220 MiB if both a decoded Int16 raster and Float32 radius raster are simultaneously resident. This is a whole-cap product, not a 200 km crop; windowed decoding/cropping is a follow-up optimization, not verified here.

Official directory and exact resources:

- Directory (live PDS browse index): https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/jp2/
- 80 m label: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/jp2/ldem_80s_80m_jp2.lbl
- 80 m data: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/jp2/ldem_80s_80m.jp2
- 240 m alternative label/data: `ldem_75s_240m_jp2.lbl` / `ldem_75s_240m.jp2` in the same directory.
- Global baseline inspected in code: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/float_img/ldem_4_float.img

The quoted source coordinates are angular coordinates, not grid indices. At the exact pole all longitudes meet; at −89.9°, longitude 0° is close to but not exactly the pole. Use the label's polar stereographic map geometry and the application's declared planetocentric/body-fixed frame to map the site to raster coordinates. Do not feed polar-grid rows/columns through the current 4-pixel/degree cylindrical lookup.

## Live label and header evidence

All three southern LOLA GDR labels identify LRO/LOLA, `LRO-L-LOLA-4-GDR-V1.0`, producer LRO_LOLA_TEAM / David E. Smith / Goddard Space Flight Center, acquisition through 2017-02-02, creation 2017-06-15, and map values as **radius relative to 1,737,400 m**. They are LOLA-derived shape maps, not single direct shot measurements at every cell. The labels note adjusted LOLA Laser 1/2 data through LRO_ES_54 and consistency with GRAIL 900C gravity; the 80 m and 120/240 m labels also describe comparisons with SELENE Terrain Camera where overlap exists. The 80 m label says about 0.004% of points flagged erroneous after comparison with filtered data. This is not a universal vertical-accuracy guarantee.

| Product | Coverage and pixel spacing | Label dimensions / raw decoded raster | JP2 bytes (HEAD) | Assessment |
|---|---|---:|---:|---|
| `LDEM_80S_80M`, V2.1 | −90°…−80°; 80 m/pixel true at pole | 7600 × 7600; 115,520,000 bytes signed 16-bit | 29,837,992 | **Recommended compromise:** covers target, best spacing among candidates under 30 MB, but whole raster decoding has a significant memory cost. |
| `LDEM_75S_120M`, V2.1 | −90°…−75°; 120 m/pixel true at pole | 7624 × 7624; 116,250,112 bytes signed 16-bit | 33,948,010 | Exceeds 30 MB compressed cap; broader coverage than necessary. Not preferred. |
| `LDEM_75S_240M`, V2.1 | −90°…−75°; 240 m/pixel true at pole | 3812 × 3812; 29,065,888 bytes signed 16-bit | 10,766,928 | Low-storage fallback, but coarser and broad coverage; a compact comparison/test option. |
| Existing `LDEM_4_FLOAT`, V3.0 | global cylindrical; 4 px/degree (~7.58 km/pixel at equator) | 1440 × 720; 4,147,200 bytes float32 | Existing repo data, not re-fetched here | Existing implementation's global coarse product; polar longitude-row extrapolation is unsuitable for local polar horizon work. |

JP2 sizes for candidate rows came from fresh PDS `HEAD` responses (HTTP 200, `application/octet-stream`) and matched label `REQUIRED_STORAGE_BYTES`. Labels fetched live. The 80 m JP2 was subsequently downloaded and decoded, as recorded below; other products were not decoded.

### Verified PDS fields for recommended 80 m label

- Product/version/dataset: `LDEM_80S_80M`, V2.1, `LRO-L-LOLA-4-GDR-V1.0`.
- Projection: polar stereographic, spherical; latitude type planetocentric; map scale 80 m/pixel; projection center (−90°, 0°); bounds −90°…−80°; no west/east longitude bounds.
- Frame: body-fixed rotating, `MEAN EARTH/POLAR AXIS OF DE421`; positive longitude east.
- Body radii: A/B/C = 1737.4 km.
- Uncompressed `IMG`: 7600 lines × 7600 samples; `SAMPLE_BITS=16`, `SAMPLE_TYPE=LSB_INTEGER`, `UNIT=METER`; scale 0.5, offset 1,737,400. The label describes each sample as radius relative to the offset. Thus radius metres = stored signed integer × 0.5 + 1,737,400. Treat the result as radius, not elevation above a geoid. Convert to radius-relative height only by subtracting the same 1,737,400 m reference radius.
- Label gives derived valid minimum/maximum DN −14592/+14052. No separate special missing-value sentinel is declared in the image object; do not invent one. Check complete PDS label and JP2 decoder metadata for invalid-pixel semantics before treating any sample as valid; NaN/JP2 mask behavior remains unverified.
- Label-declared JP2 payload requirement: 29,837,992 bytes; corresponding uncompressed IMG has 15,200-byte records × 7600 = 115,520,000 bytes.

The 240 m option label likewise declares LSB signed 16-bit, scale 0.5, offset 1,737,400 m, 3812 × 3812, polar stereographic centered −90°/0°, planetocentric, east-positive, same DE421 body-fixed frame, and −90°…−75° coverage. Its raster is 29,065,888 bytes uncompressed; JP2 is 10,766,928 bytes. It also declares no separate special missing DN in the image object. Product label: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/jp2/ldem_75s_240m_jp2.lbl

## Fit to the application and adapter plan

`src/features/visibility/lola.mjs` currently hard-codes a 1440×720 float32 little-endian cylindrical `LDEM_4_FLOAT` product, validates its label and file SHA-256, then indexes by latitude/longitude at 4 pixels/degree. It assumes the value is km radius offset. Replacing only the URL or dimensions would be incorrect: the polar product is signed 16-bit integer radius in metres on a polar stereographic grid, with distinct coordinates and scaling.

Recommended adapter strategy (not implemented in this research task):

1. Keep the current global loader intact as the broad fallback. Add a distinct product-specific polar loader rather than weakening its checks or changing the meaning of its existing data.
2. Obtain the JP2 plus matching `.LBL` and `.AUX.XML`; verify byte count/checksum if PDS supplies one, hash locally, retain provenance. Prefer PDS's corresponding uncompressed IMG for a simple first adapter only if a later approved download is acceptable (115.52 MB, above the current transfer cap); otherwise use a tested JPEG2000 decoder or decoder windowing. No decoder/library choice is proven here.
3. Parse and validate the actual label fields. Decode signed little-endian 16-bit samples; apply `radius_m = DN * 0.5 + 1,737,400`, mask invalids before scaling, and retain radius/reference/frame metadata. Do not convert to the existing float/km representation without a clear, tested contract.
4. Implement PDS polar-stereographic forward/inverse coordinate transforms from the archive's `DSMAP_POLAR.CAT` definition and label parameters. Honor planetocentric latitude, east-positive longitude, DE421 body-fixed frame and pixel-center offsets. Validate at known coordinates and against an independent trusted implementation before sampling horizons.
5. For the requested 200 km terrain radius around −89.9°, calculate the projected bounding window with enough margin for map distortion and ray sampling; sample only within validated coverage and propagate NoData as unknown, never zero. 200 km is the existing horizon search distance, not a property of the DEM. Test coverage/window edges and compare horizon profiles at 80 m versus 240 m / current global resolution.
6. Do not claim the finer grid guarantees corresponding absolute accuracy or resolves landing hazards: grid spacing is not measurement accuracy; products are gridded/adjusted, and small boulders/roughness may remain unresolved. Report the product's source mixture caveat and resolution limits explicitly.

## Local decode and profile run (2026-11-14)

The actual 29,837,992-byte official JP2 and exact matching PDS label were fetched from URLs above. UTC retrievals from manifest: label `2026-11-14T12:26:07.232866+00:00`, raster `2026-11-14T12:26:51.279611+00:00`; both HTTPS HTTP 200. SHA-256 label `497512747bb56490d50cf3f4945f2cb736bf61cd19b65fa61a826825e2a35d79`; JP2 `c088dd4f510e879375ee7e6f0d320ba84115f535f45fb592dd7f83a7d2e83ae3`. Rasterio 1.4.3 / GDAL decoded actual JP2 as 7600×7600 `int16`, with embedded Moon2000 south-polar stereographic WKT and 80 m affine. Independent rasterio/PROJ projection checks of (0°,−90°), (90°,−89°), (0°,−89°) matched expected PDS orientation after affine corner-to-center conversion. PDS catalog: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/catalog/dsmap_polar.cat. Southern-cap check: east is increasing column; prime meridian moves toward decreasing row.

Target profile at (−89.9°, 0°), observer 2 m, full-circle 200 km: single-run Windows Python 3.12 wall times: 5° × 240 m = 60,000 ray samples, 2.66 s; 5° × 80 m = 180,000, 4.93 s. At shared bearings, maximum absolute elevation change from radial interval 240 m to 80 m = 0.4456° (sampling sensitivity, not truth/accuracy). 240 m interval is 3 DEM cells; use 80 m as better-aligned default, within 200,000 workload limit. Profile extrema at 5°/240 m: −1.8959° to +22.3995°. Near-field terrain inside roughly one 80 m cell remains unresolved; finer raster sampling cannot establish absolute terrain accuracy. These machine-specific timings used tiny raster windows with 64 MiB GDAL cache. Earlier 1.5 m observer explorations are not the committed benchmark; these 2 m runs match the coordinator's request.

`surfaceHeightM` is measured from actual DEM site pixel and serialized in generated output. Do not treat it as Horizons `SITE_COORD` reference height without reconciling all body/frame/radius conventions. Initial research-only note that said no DEM download was true at that phase; implementation subsequently fetched the raster, as exact UTC retrievals and checksums above record. Initial note that timestamps were only date precision likewise predates the actual raster download; later manifest has exact UTC.

## Evidence status and limits

- PDS polar browse directory: accessed live while researching; listing exposed actual filenames and product byte sizes.
- 80 m, 85S/40 m, 75S/120 m, and 75S/240 m labels: accessed live; 80 m, 85S/40 m, and 75S/120/240 m JP2 `HEAD` requests returned HTTP 200. Only the 80 m and 75S/240 m label details are fully transcribed above; 85S/40 m was inspected as another option; its 24,960,972-byte JP2 covers −90°…−85°, so it includes −89.9° but does not cover the full 200 km radial search (approximately 6.6° of lunar surface arc).
- No data raster downloaded, decoded, cropped, or numerically compared. No resolution-accuracy validation performed. Retrieval timestamps are date-only because exact clock time was not available; no checksum or license/terms claim was verified in this pass.

## Sources

1. NASA PDS Geosciences Node, LRO LOLA RDR polar JP2 archive browse directory: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/jp2/
2. PDS label for `LDEM_80S_80M`: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/jp2/ldem_80s_80m_jp2.lbl
3. PDS label for `LDEM_75S_240M`: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/jp2/ldem_75s_240m_jp2.lbl
4. Existing adapter examined: `src/features/visibility/lola.mjs` (repository working tree).
