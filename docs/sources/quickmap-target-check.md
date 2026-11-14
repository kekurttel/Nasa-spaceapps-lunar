# QuickMap Mons Mouton target check — 2026-11-14

## Scope and method

Checked current official portal startup and bundled client configuration for proposed coordinates `-85.29,31.95`. Target remains a proposal; no claim that QuickMap location is Mons Mouton or that it is an approved landing site. No browser interaction, layer query, tile fetch, product metadata retrieval, or computation completed in this check. No large data downloaded.

## Live access observed

- Requested historical entry URL: `https://quickmap.lroc.asu.edu/`.
- HTTP 200; redirected to `https://quickmap.lroc.im-ldi.com/`; final response `text/html`, 8160 bytes. HTML references `/assets/index-DeMHb3Go.js`.
- Bundled JS URL: `https://quickmap.lroc.im-ldi.com/assets/index-DeMHb3Go.js`; HTTP 200, 4,172,793 bytes, saved as `/tmp/opencode/quickmap-app.js` for bounded inspection.
- Bundle identifies app text as “LROC QuickMap, a powerful map interface to browse Lunar data from NASA/LRO and other missions”, attribution text “Developed by Applied Coherent Technology and customized for the LROC team at ASU”; build timestamp `2026-07-29T17:56:05.963Z`, version `866d2613`.
- Client code contains default lunar terrain configuration `https://dem-tiles.b-cdn.net/lunar/qts_demstack/`, names `lunar-fulleqc` and `lunar-polarshifted-eqc`. This is static bundled configuration only: service response, layer selection, target coverage, actual product identity, provenance and license were not verified.

## Verification boundary

| Claim | Result |
|---|---|
| QuickMap portal reachable | Verified: HTML HTTP 200 after redirect |
| Target `-85.29,31.95` entered or rendered | Not verified |
| Mons Mouton identity / geographic placement | Not independently verified |
| Scientific imagery or elevation layer selected / returned for target | Not verified |
| Dataset/product ID, version, resolution, acquisition, processing, datum or NoData metadata | Not verified |
| Provider attribution and reuse/license terms for a product | Not verified; app attribution text is not product license |
| Terrain/illumination calculation or target suitability | Not performed |

## Outcome

Startup and client bundle accessed, but QuickMap target/product gate remains blocked. Do not describe bundled configuration as a target observation, verified terrain product, license, or computed result. Prior bounded browser inspection also found empty app DOM/no usable layer controls; see `portal-inspection.md` and `/tmp/opencode/lunar-source-check/quickmap-retry.json`.
