# Moon Trek target and product check — 2026-11-14

## Scope and method

Checked official Moon Trek at https://trek.nasa.gov/moon/ for proposed Mons Mouton target `-85.29,31.95` (latitude, longitude). Reused prior bounded Playwright capture; separately retrieved official catalog metadata for WAC products. No large raster/DEM download. This records portal state and published metadata, not scientific measurements inferred from pixels.

## Target map state

- Browser URL after load: `https://trek.nasa.gov/moon/#v=0.1&x=0&y=0&z=1&p=urn%3Aogc%3Adef%3Acrs%3AEPSG%3A%3A104903&d=&locale=&b=moon&e=-253.12499527831596%2C-175.78124672105275%2C253.12499527831596%2C175.78124672105275&sfz=&w=`.
- Observed map extent `e=`: west `-253.12499527831596`, south `-175.78124672105275`, east `253.12499527831596`, north `175.78124672105275` in map's displayed lunar coordinate system. Initial zoom `z=1`; page body included `1090 km` scale text.
- No target bounds or target-centered map confirmed. `input#flyToInput[placeholder="Lat, Lon"]` remained hidden; coordinate entry was not performed. Search input is not a coordinate field. Layers control was present in DOM but not visible/clickable. Thus this map extent is the initial global view, not Mons Mouton evidence.
- Prior capture references: `docs/sources/portal-evidence/moon-trek-retry.json`; retry summary in `docs/sources/portal-evidence/retry-summary.json`; fuller local browser records/screenshots under `/tmp/opencode/lunar-source-check/`.

## Products and official metadata

Default auto-layer controls in the captured DOM named these products:

| Product identifier | Official catalog record | Metadata evidence |
|---|---|---|
| `LRO_WAC_Mosaic_Global_303ppd_v02` | https://trek.nasa.gov/moon/TrekWS/rest/cat/metadata/fgdc/html?label=LRO_WAC_Mosaic_Global_303ppd_v02 | Catalog search result: title “LRO WAC Mosaic v2”; ASU originator; publication date `20130601`; global bounds longitude `-180..180`, latitude `-90..90`; geographic latitude/longitude resolution `0.003298` degrees; Moon 2000 ellipsoid and altitude datum. Abstract describes preliminary global LROC WAC mosaic from >15,000 images acquired Nov 2009–Feb 2011. Metadata says equatorial mosaic inputs were acquired in three periods during 2010; polar inputs Aug–Sep 2010 (south) and Apr–May 2010 (north). Product intended as imagery/mosaic, not DEM elevation values. |
| `LRO_WAC_Mosaic_NPole60_100mp` | No independently fetched metadata record in this check. | Name is in default layer control only; `100mp` is identifier text, not independently verified measured resolution or accuracy. |
| `LRO_WAC_Mosaic_SPole60_100mp` | https://trek.nasa.gov/moon/TrekWS/rest/cat/metadata/fgdc/html?label=LRO_WAC_Mosaic_SPole60_100mp | Independently fetched official FGDC: ASU, edition 1, publication 20110315; bounds -180..180 longitude, -90..-60 latitude; 18622 × 18622 pixels, 100 m planar grid, Polar Stereographic, Moon 2000 radius 1737400 m. Preliminary LROC image mosaic, not DEM. Main south images 2010-08-10..2010-09-19 with gap fills at other dates. Access/Use_Constraints None. |

Catalog metadata URL for global product above is official NASA/JPL Moon Trek catalog. Its metadata states `Use_Constraints: None`; preserve attribution and metadata rather than interpreting this as a blanket legal opinion. Global metadata gives angular grid resolution `0.003298` degrees; it separately describes WAC global product intent as 100 m/pixel (polar scale varies). Neither is a guarantee of local positional accuracy, feature resolution, or suitability for landing analysis.

Prior Playwright retry recorded `WMTSCapabilities.xml` HTTP 200 for default WAC products, with image tile requests returning HTTP 200 and HTTP 404. Exact requested capabilities/tile URLs were not preserved as a complete list in the committed evidence. This proves service responses for default layers only; no confirmed target footprint, rendered tile value, LOLA product, or elevation query.

## Archived response integrity

Official south-polar FGDC response saved as `portal-evidence/moon-trek-spole-fgdc.html`: 14994 bytes, SHA-256 `d87b1fe397039d0315836498ad650e18efedd78102a2be5259c6f5a2c844d43b`. Local capture integrity only, not a publisher checksum. Six content assertions passed: product filename, dimensions, grid spacing, publication date, use-constraint field and value. HTML generator timestamps may vary between requests.

## Outcome and limits

- Portal starts and exposes initial global bounds. Target coordinate was not selected; target map state remains **unverified**.
- Global WAC metadata identifies a camera image mosaic and reports source/scale context. Do not label it LOLA elevation or infer terrain values from screenshot/map appearance.
- South-polar catalog metadata independently retrieved and archived at `portal-evidence/moon-trek-spole-fgdc.html`. Proposed numeric target lies inside published geographic bounds; this is catalog coverage only, not a rendered target or valid pixel check. Active layer, local pixel validity and Mons Mouton identity remain unverified. Metadata lists `Standard_Parallel: 90.0` even for south-polar product: do not silently correct or use this record as a certified reprojection definition. North-polar catalog metadata remains unverified.
- HTTP 404 occurred for some default tile requests. The evidence does not establish whether tile absence resulted from coverage, service state, or request issue.
- Browser record also logged unrelated analytics failure `net::ERR_NAME_NOT_RESOLVED` for `https://dap.digitalgov.gov/Universal-Federated-Analytics-Min.js?agency=NASA&subagency=MarsTrek&dclink=true&sp=search,s,q&sdor=false&exts=tif,tiff`; this did not validate or invalidate science layers.
- Screenshot is not evidence of scientific values, target coordinates, layer selection, or DEM correctness. No NASA endorsement is implied.
