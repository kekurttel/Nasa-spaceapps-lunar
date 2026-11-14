# Horizons lunar-vector registration research

**Status:** Official-document review and two live vector queries completed 2026-11-14. Raw request responses, HTTP headers and hashes are in `docs/research/horizons/`. No production code or engine changed.

## Finding

Horizons returns genuine vector ephemerides, but current results identify `DE441`; project SPICE vectors use `DE421`. Thus Horizons can serve as a separately labeled comparison/source candidate, not an interchangeable substitute for the registered DE421 vectors. This experiment compares Moon-centered ICRF vectors directly; no lunar-frame transform is needed for that comparison. It does not certify lunar-surface observer angles or register Horizons vectors in `MOON_ME_DE421`.

The Horizons manual (v4.98e, 2026-08-25) lists “Lunar mean Earth (DE421)” among reference frames, and documents lunar surface targets in mean-Earth coordinates. That proves Horizons documents a DE421-labeled lunar frame capability. It does **not** prove its `MEAN_ME` site realization and orientation are identical to NAIF frame `MOON_ME_DE421` in `docs/frame-registration-evidence.md`. Do not infer frame identity or DE421 dynamics from matching names. The manual describes major-body states as interpolated from ephemerides such as DE441; this live response explicitly reports `{source: DE441}`.

Recommendation: keep currently registered SPICE/DE421 geometric vectors for registered output. If genuine Horizons is a requirement, expose Horizons as its own source and preserve the DE441 provenance and compatibility status. Do not register it as DE421. If comparing/using local surface angles, separately validate site height/datum, frame axes and local azimuth/elevation convention.

## Official references

- JPL Horizons API v1.3 (2025 June): https://ssd-api.jpl.nasa.gov/doc/horizons.html — endpoint, `EPHEM_TYPE=VECTORS`, `CENTER`, `REF_SYSTEM`, `REF_PLANE`, `VEC_CORR`, `OUT_UNITS`, `TIME_TYPE`, `TLIST`, response signature/version.
- JPL Horizons manual v4.98e (2026-08-25): https://ssd.jpl.nasa.gov/horizons/manual.html — reference-frame list includes Lunar mean Earth (DE421); surface-target coordinates and observer definitions; geometric versus astrometric/apparent output.
- Local NAIF frame/kernel evidence: `docs/frame-registration-evidence.md` and `data/kernels/manifest.json`.

API query semantics used: `CENTER='500@301'` is Moon center (301), not barycenter 3; `VEC_CORR='NONE'` selects geometric state vectors; `REF_SYSTEM='ICRF'`, `REF_PLANE='FRAME'`, `OUT_UNITS='KM-S'`. Body headers in both responses confirm Moon (301), center-site BODY CENTER, ICRF, geometric cartesian state, and DE441 source.

## Reproducible live request and provenance

Queries used documented GET endpoint `https://ssd.jpl.nasa.gov/api/horizons.api`, `format=text`, one discrete TDB epoch, and two targets:

```text
COMMAND='10' and COMMAND='399'
EPHEM_TYPE='VECTORS'
CENTER='500@301'
REF_PLANE='FRAME'
REF_SYSTEM='ICRF'
VEC_CORR='NONE'
OUT_UNITS='KM-S'
TIME_TYPE='TDB'
TLIST='2461358.500800781'
CSV_FORMAT='YES'
```

The epoch is UTC `2026-11-14 00:00:00`, converted to `JDTDB 2461358.500800781` with repository LSK `data/kernels/naif0012.tls` and SPICE ET `847886469.1827118` s past J2000. Horizons labels returned TDB instant `2026-Nov-14 00:01:09.1875` (TDB differs from UTC; do not compare as if identical clock labels).

Both GETs returned HTTP 200, `Content-Type: text/plain`, `API VERSION: 1.2`, source `NASA/JPL Horizons API`; both target headers state `{source: DE441}`. The live API documentation is 1.3, so retain observed 1.2 and version-check parsers. Raw text responses and response headers are saved as:

- `docs/research/horizons/sun.txt`, `sun.headers.txt`
- `docs/research/horizons/earth.txt`, `earth.headers.txt`
- `docs/research/horizons/manifest.json` records byte counts and SHA-256 hashes.

No raw response was synthesized from a request template. `TLIST` was used instead of a start/stop interval, avoiding any assumption that an equal start and stop are accepted.

### Numeric comparison at matched TDB epoch

Horizons target-minus-Moon-center position, in ICRF km:

| Target | Horizons DE441 (km) | SPICE DE421 `J2000`, geometric (km) | Horizons − SPICE (km) | Angular separation |
|---|---:|---:|---:|---:|
| Sun (10) | (-92,746,483.273525, -105,575,550.598018, -45,738,753.141762) | (-92,746,483.316523, -105,575,550.517773, -45,738,753.227435) | (+0.042998, -0.080244, +0.085673) | ~0.000000049° (0.00018 arcsec) |
| Earth center (399) | (-92,440.724606, 352,267.636227, 178,495.846359) | (-92,440.719200, 352,267.637427, 178,495.847216) | (-0.005406, -0.001200, -0.000858) | ~0.00000080° (0.0029 arcsec) |

SPICE values were independently computed with local `data/kernels/naif0012.tls`, `moon_080317.tf`, `moon_pa_de421_1900-2050.bpc`, and `de421.bsp`, via `spkezr(target, et, 'J2000', 'NONE', '301')`. Comparison script `docs/research/horizons/compare.py` parses the persisted `$$SOE` CSV rows, verifies all raw-file hashes in the manifest, and computes ET directly from the returned JDTDB: `et = (jd - 2451545.0) * 86400.0`. It reproduces the vectors and residuals above. The Horizons returned calendar string is rounded to 0.1 ms, so do not use its rounded time string for the calculation. Residual norms are 0.125011 km for the Sun and 0.005603 km for Earth at this epoch; they do **not** prove identical models, source registration, accuracy, or performance over other epochs. API source headers establish DE441 versus local DE421, so retain that difference in metadata.

This comparison is a one-epoch Moon-center vector check only. It does not test a surface observer, altitude conversion, observer subtraction for a local site, local horizon basis, time-series coverage, or registration acceptance thresholds. It does not validate the prior OBSERVER claim.

## Integration/quality contract

Store with each returned result: provider and source URL; exact query; retrieval UTC; HTTP status/content type; API signature version; target ID and header; center ID/site; source ephemeris from response header; reference system/frame; correction mode; requested and returned time scale/epoch; position and velocity units; parsed fields; validation/comparison status and residuals; transformation provenance if any; missing-data/errors; limitations. Preserve raw payload and headers plus SHA-256. Do not treat HTTP 200 as scientific validation. Reject missing/unexpected API version, API error, wrong target/center/source/frame/epoch, absent table markers, malformed rows, or missing values.

For Horizons `OBSERVER` results, require independently verified site latitude/longitude convention, height datum, ellipsoid/radii and local azimuth/elevation basis. Confirm response header's center geodetic/pole/equ/radii against selected surface model. LOLA's radial radius-offset values are not automatically Horizons geodetic altitude. Keep surface az/el distinct from Cartesian vectors; do not relabel observer output as a registered-frame vector.

## Disposition

- **Registered result now:** existing SPICE DE421 geometric vectors in `MOON_ME_DE421`; provenance recorded locally. This is not Horizons data.
- **Horizons vectors:** valid genuine JPL/Horizons data; live response is DE441. Use as separately sourced comparison or separate mode, with version/provenance. Not interchangeable with DE421 solely because numerical residuals at one epoch are small.
- **Horizons surface observer:** official interface supports site observables, but this research did not query it or verify datum/frame compatibility; no claim of successful -89.9° observer test is made.
- **Unproven:** Horizons `MEAN_ME` site equivalence to NAIF `MOON_ME_DE421`; local site height conversion; multi-epoch residual behavior; any quality acceptance tolerance. Registration remains blocked on those requirements.
