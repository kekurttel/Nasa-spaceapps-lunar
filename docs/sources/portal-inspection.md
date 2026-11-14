# Portal visual inspection — 2026-11-14 UTC

## Scope and method

Attempted real browser visual-layer inspection of QuickMap and Moon Trek at proposed Mons Mouton coordinates `-85.29,31.95`. This is a development proposal, not a separately confirmed geographic target. Reused installed Playwright Core `/home/ytwrie/.npm/_npx/bbb8a2c4738e2b0c/node_modules/playwright-core` and Chromium `/home/ytwrie/.cache/ms-playwright/chromium-1148/chrome-linux/chrome`; browser arg `--disable-http2`. On bounded retry, `PW_TEST_SCREENSHOT_NO_FONTS_READY=1` applied to screenshot readiness only. TLS verification stayed enabled; CORS unchanged; no installation or DEM download.

## First attempt

- Existing records `/tmp/opencode/lunar-source-check/quickmap-controls.json` and `/tmp/opencode/lunar-source-check/moon-trek-controls.json` captured initial portal controls, not verified data layers.
- QuickMap navigation failed with `page.goto: net::ERR_NAME_NOT_RESOLVED at https://quickmap.lroc.im-ldi.com/`.
- Moon Trek screenshot timed out waiting for fonts (`page.screenshot: Timeout 30000ms exceeded`, waiting for fonts to load). Its initial runner did not enter target coordinates.

## Bounded retry

Full records: `/tmp/opencode/lunar-source-check/quickmap-retry.json`, `/tmp/opencode/lunar-source-check/moon-trek-retry.json`; summary `/tmp/opencode/lunar-source-check/retry-summary.json`. DOM/network recorded before screenshot.

### QuickMap

- Retry got portal document HTTP 200 and JS/CSS/font assets HTTP 200.
- App still did not render usable DOM in this capture: body empty, coordinate input absent, Layers control absent. No target coordinate entered; no layer selection or scientific tile requests observed.
- Screenshot: `/tmp/opencode/lunar-source-check/quickmap-retry.png`. Not evidence of target view or identified layer.

### Moon Trek

- Tutorial dismissed. Actual coordinate input is `input#flyToInput[placeholder="Lat, Lon"]`, but it was hidden and not fillable. The search field `input#searchSidebarSearchInput[placeholder="Search for..."]` is not a coordinate field. Proposed coordinate was not entered.
- Layers UI text was in DOM but not visible/clickable: `locator.click: Timeout 30000ms exceeded ... element is not visible`. No manual layer selection.
- Auto layers generated requests for LRO WAC products `LRO_WAC_Mosaic_Global_303ppd_v02`, `LRO_WAC_Mosaic_NPole60_100mp`, and `LRO_WAC_Mosaic_SPole60_100mp`. Their `WMTSCapabilities.xml` responses were HTTP 200; observed image-tile endpoints returned both HTTP 200 and HTTP 404. This confirms WAC imagery requests, not a coordinate-specific view or LOLA topography.
- Screenshot: `/tmp/opencode/lunar-source-check/moon-trek-retry.png`. Does not prove proposed coordinate was selected. No provider attribution, layer use terms, or product metadata were inspected.

## Final status — bounded retry closed

- **QuickMap:** Portal startup document and JS/CSS/font assets returned HTTP 200, but app DOM stayed empty. No coordinate entry, visible layer controls, scientific image/topography layer, tile, product metadata, license/use terms, or target location verified. Scientific visual inspection is **blocked**; startup HTTP 200 is recorded separately and is not layer access.
- **Moon Trek:** Tutorial could be dismissed and default `LRO_WAC_Mosaic_*` image mosaics issued capabilities/tile requests. But `input#flyToInput[placeholder="Lat, Lon"]` was hidden, so proposed coordinates were not entered; Layers control was not visible/clickable. No target-specific layer, product metadata, source/license terms, or LROC/LOLA provenance verified. Coordinate-specific scientific inspection is **blocked**. These requests establish only default WAC imagery service activity, not target imagery and not LOLA elevation.
- `-85.29,31.95` remains a development proposal; selected demo scope does not verify this location. No screenshots prove target coordinates or selected layers. No DEM download, elevation decoding, or numerical integration occurred. Do not claim NASA endorsement.
- **Test/evidence:** bounded browser retry only; result JSON `/tmp/opencode/lunar-source-check/quickmap-retry.json`, `/tmp/opencode/lunar-source-check/moon-trek-retry.json`, summary `/tmp/opencode/lunar-source-check/retry-summary.json`; screenshots `/tmp/opencode/lunar-source-check/quickmap-retry.png`, `/tmp/opencode/lunar-source-check/moon-trek-retry.png`. Existing portal startup records `/tmp/opencode/lunar-source-check/quickmap-controls.json` and `/tmp/opencode/lunar-source-check/moon-trek-controls.json`. No automated scientific-data test run; no claim of integration.

## Four-source project gate status

This task exercised only QuickMap and Moon Trek; it did not fulfill the full four-source project workflow.

| Source | Gate status from this inspection | Evidence / missing gate |
|---|---|---|
| QuickMap | Portal startup reached; scientific layer gate blocked | UI assets HTTP 200 only; no target, selected layer, product metadata, terms, or useful tile evidence. |
| Moon Trek | Default image service activity observed; target scientific inspection blocked | WAC capability/tile requests; no target coordinate, product metadata/terms, verified LOLA layer, or elevation product. |
| LRO/LOLA | Not open | No specific LOLA product/label fetched or validated; no DEM downloaded. |
| JPL Horizons | Not open by this portal task | No target-specific query or response exercised here. |

No source gate is marked complete for coordinate-specific scientific analysis. Startup HTML/UI and default image requests do not satisfy source/product/coordinate/license validation.
