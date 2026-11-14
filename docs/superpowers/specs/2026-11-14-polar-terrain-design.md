# Regional polar terrain upgrade

User delegated source discovery, quality/performance decisions, repair and verified commit. This design records coordinator choices, not a claim that products are already validated.

## Choice

Use a separate product-specific adapter for official LOLA `LDEM_80S_80M V2.1`, keeping the existing verified coarse global loader intact. Candidate download is 29,837,992 bytes (~29.84 MB), while decoded raster is 115.52 MB. Download only this compressed product plus small labels, not the multi-GB WAC imagery. The 80m grid is not an 80m accuracy guarantee. Inspect actual decoder metadata and special values before using samples.

Alternatives: keep coarse global grid (fast but poor polar geometry); 240m polar grid (~10.77MB, lower detail); global high-resolution imagery (not elevation, reject). The 80m candidate covers site -89.9/0 and full 200km search; a smaller 85S cap covers the site but cannot cover the full search radius.

## Boundaries

- `src/features/visibility/polar_lola.py`: product-specific decoder, polar georeference, bilinear radius-offset sampling and existing spherical horizon algorithm, explicit coverage/NoData failure. Bounded raster window and sample work budget; no full Float32 global copy.
- `scripts/fetch-polar-lola.py`: official URL, capped streaming temporary download, validation and atomic installation, source URLs/UTC/hashes/bytes recorded. Raster ignored by git.
- `scripts/run-polar-analysis.mjs`: known terrain producer then existing registered-sky.py and registration gate; same document/sky/visibility schema. Does not accept external sky, does not introduce another sky engine.
- `tests/test_polar_lola.py`, `tests/polar-registration.test.mjs`: projection/scaling/interpolation/invalid coverage/budget tests plus actual product integration. No skipped final acceptance tests.

Default target remains -89.9°, 0°, height2m, 200km finite search. Independent real-product benchmark at 2 m observer height found 0.44558056° maximum shared-bearing change from 240 m to 80 m radial spacing, with 2.68 s versus 5.02 s single-run wall time. Select **80 m radial / 5° azimuth** default (180,000 ray samples). Neither setting guarantees narrow-ridge maxima. A 64 MiB GDAL cache is not a whole-process cap: measured Python terrain peak working set approximately 208 MiB and peak private commit approximately 922 MiB; see docs/research/coordinator-polar-validation.md. Exact-pole directional singularity must fail explicitly unless documented convention is implemented. Reject rays outside product or window, never clamp/extrapolate. Heights and sky observer radius share LOLA1737400m reference and MOON_ME_DE421. Metadata includes actual resolution, search range, sampling, data hashes, measured timings and warnings.

## Integration honesty

Backend/UI unchanged in this terrain-focused upgrade. QuickMap/Moon Trek browser disconnection is not site failure; HTML alone isn't layer use. Horizons diagnostics are kept separate until exact frame/site convention is validated; SPICE isn't relabeled Horizons. Four-source requirement is not marked complete based on this terrain upgrade.

## Acceptance

Authoritative product label and actual decoded raster agree. Projection checked independently, samples checked against direct pixel values, site/ray bounds validated. Real output registration valid. Full Node/Python suites pass, actual decode/sky pipeline run, performance and sampling sensitivity measured. Independent review before commit and branch-only push verification. No huge raw payload in git.
