# Map-source evidence: QuickMap and Moon Trek

**Research pass:** 2026-11-14, 12:06–12:10 UTC (tool runtime clock). Scope: official challenge resource page, current QuickMap and Moon Trek landing pages, the documented Moon Trek WMTS service used by the frontend, a tile request at longitude 0°, latitude −89.9°, and attempted same-coordinate portal view.

## Evidence and status

| Source | What I could establish in this pass | Status / limits |
|---|---|---|
| NASA Space Apps 2026 Lunar Landing Site Navigator resources | Attempted the challenge URL with the web fetcher; it returned `Transport error (GET https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/?tab=resources)`. Browser verification could not be attempted because the in-app browser reports `[browser.disconnected] No desktop browser is connected to this session`. | **Blocked** for a live read in this pass. No claim about current page contents, its resource list, or a live challenge attribution is made here. The challenge URL itself is recorded above. |
| Current LROC QuickMap | `https://quickmap.lroc.im-ldi.com` returned its HTML landing document. It identifies the product as “LROC QuickMap”, says it browses NASA/LRO and other-mission lunar data, and names Applied Coherent Technology as developer and customization for the LROC team at ASU. The document loads a JavaScript application and describes 2D/3D browsing. | **Reached (landing HTML only)**. No interactive map, layer catalog, tile, scientific product metadata, raster, or analysis was verified. |
| Moon Trek | `https://trek.nasa.gov/moon/` returned its HTML landing document. Its metadata describes a NASA web-based Moon exploration portal with layered browsing of NASA-collected data. The frontend's configured layer's explicit capabilities document was fetched from `https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd/1.0.0/WMTSCapabilities.xml` (HTTP 200, `application/xml`, 6,932 bytes). It identifies an OGC WMTS 1.0.0 layer `LRO_WAC_Mosaic_Global_303ppd`, coverage −180 to 180° longitude / −90 to 90° latitude, `image/jpeg`, tile matrix set `default028mm`, CRS `urn:ogc:def:crs:EPSG::104903`, 256×256 tiles, matrices 0–7, and the REST template. The exact zoom-7 tile corresponding to the tile grid at 0° lon / −89.9° lat (`row=127`, `column=128`) was requested using the capabilities-advertised template: HTTP 200, `image/jpeg`, 14,895 bytes, JPEG signature. | **Capabilities reached; one rendered image tile retrieved**. This is a rendered visual basemap tile, not a height raster. The capabilities identify the layer and service but do not specify the underlying mosaic's acquisition epoch, detailed processing/version lineage, pixel ground resolution, usage license/terms, or sensor/product citation. No metadata record was found in this pass to fill those gaps. |
| Same-site coordinate view, −89.9°, 0° | The tile grid was derived from the capabilities TopLeftCorner (−180°, 90°), matrix 7 dimensions (256 columns × 128 rows), and 256-pixel tiles. This locates a tile containing that coordinate; it does not establish the map was interactively viewed or visually interpreted. No browser connection was available to set/confirm the coordinate in either portal. | **Single tile retrieved; visual portal comparison blocked / not performed**. No claim of visual inspection or successful same-site exploration.

## WMTS tile evidence and provenance

The running frontend configures this same Moon Trek URL template in `frontend/src/components/MoonMap.tsx` (line 58); it uses a Leaflet `TileLayer`. Its attribution string says “NASA Moon Trek / LROC / USGS”, but the WMTS capabilities response itself names the layer `LRO_WAC_Mosaic_Global_303ppd` and does **not** identify the mosaic's instrument/data producer. Therefore LROC/USGS attribution in the app is not enough to assign product provenance, and the tile must not be called a LOLA DEM. The capabilities-advertised REST tile template is documented service evidence, not an invented endpoint.

Coordinator independently re-fetched capabilities (6,932 bytes) and advertised tile `https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd/1.0.0//default/default028mm/7/127/128.jpg`: HTTP 200, `image/jpeg`, 14,895 bytes, SHA-256 `2be4265dffa9993f6f9a4bdf13c17d94bab60e0ae9dc1d824c7a6aaac4b48928`, JPEG prefix `ffd8ff`. This remains retrieval, not visual interpretation.

At zoom 7, the published matrix is 256 columns by 128 rows with origin (−180°, 90°) and 256×256 tiles. Thus column `floor((0+180)/360*256)=128`; row `floor((90−(−89.9))/180*128)=127`. The requested JPEG is authentic image-format payload (HTTP metadata and JPEG signature); it only establishes successful retrieval of that tile. No pixel values were decoded or treated as elevation, and no human visual inspection was performed.

## Provenance distinctions

QuickMap's landing-page wording separates the LROC QuickMap interface from its data: it is a browsing tool for NASA/LRO **and other missions**, developed by Applied Coherent Technology and customized for the LROC team at ASU. That is not evidence that every displayed layer is an LRO or NASA-produced product. The live challenge page was unreachable here, so its current developer/resource wording could not be independently checked in this pass. Moon Trek's HTML describes it as a NASA portal, but this alone does not establish the producer, version, resolution, or terms for any particular layer.

LROC is the Lunar Reconnaissance Orbiter Camera instrument/system; LOLA (Lunar Orbiter Laser Altimeter) is a distinct instrument, not a camera layer. A map image can help answer “what does this area look like?”; it is not, by itself, a numeric elevation model or proof of a terrain horizon. Do not infer elevation from ordinary imagery or treat dark pixels as proof of permanent shadow.

## Evidence record (required metadata)

### QuickMap

```yaml
source_name: LROC QuickMap landing page
provider_and_mission: Interface by Applied Coherent Technology, customized for LROC team at ASU (as stated in landing HTML); sources described broadly as NASA/LRO and other missions; specific layer producer unverified
source_url: https://quickmap.lroc.im-ldi.com
product_layer_id_or_full_query: no QuickMap layer selected; not verified
version: not exposed in fetched landing HTML
retrieved_at_utc: 2026-11-14T12:06Z (landing page)
observation_time_and_time_scale: not applicable; no layer selected
coordinate_frame_and_longitude_convention: not verified
vertical_reference_and_units: not verified
resolution_coverage_nodata: not verified
processing_steps: fetched landing HTML only
raw_file_sha256: not recorded
used_by_code_or_result: portal provenance research only; no map layer retrieved
citation_usage_terms: not verified for any particular layer
validation_and_limitations: landing document reached; interactive app/layers and same-coordinate visual inspection not verified
```

### Moon Trek

```yaml
source_name: Moon Trek portal landing page
provider_and_mission: NASA portal per landing-page metadata; producer of any particular layer unverified
source_url: https://trek.nasa.gov/moon/
product_layer_id_or_full_query: no layer selected; not verified
version: not exposed in fetched landing HTML
retrieved_at_utc: 2026-11-14; time-of-day unavailable
observation_time_and_time_scale: not applicable to landing HTML; no observation layer selected
coordinate_frame_and_longitude_convention: not verified; target coordinate not set
vertical_reference_and_units: not verified
resolution_coverage_nodata: not verified
processing_steps: fetched landing HTML only; no map interaction or scientific processing
raw_file_sha256: not recorded
used_by_code_or_result: none
citation_usage_terms: not verified for any particular layer
validation_and_limitations: landing document reached; interactive app, 3D view, layer metadata, and same-coordinate inspection not verified
```

## What can be used, and what cannot

The live WMTS evidence now establishes a documented, reachable image-tile service for the configured WAC mosaic layer, and one tile for the target coordinate's containing grid was retrieved. This does **not** establish that the tile was rendered in the frontend or visually inspected, nor that numeric DEM data is available. The frontend URL itself remains configuration evidence; the independent tile request adds retrieval evidence only.

Before using this layer for science or redistribution, find a publisher/catalog metadata record that establishes actual product producer and citation, acquisition/processing lineage, effective resolution, and use terms. Do not interpret display tiles as elevation-encoded data. For visual exploration, reopen the portals in a connected browser, set the same coordinate on both, note the visible layers and metadata, and keep visual observations distinct from elevation/horizon measurements. The failed browser connection is a harness availability limitation, not evidence that either site is down.
