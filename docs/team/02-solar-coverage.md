# DE421 solar generator and measured coverage

## Delivered contract

`src/features/ephemeris/tools/generate_solar_vectors.py` exports
`generate(request, kernels_dir=None)`. The minimal request is
`{"timesUtc":["2000-01-01T00:00:00Z","2019-01-01T00:00:00Z"]}`.
Optional contract fields, when supplied, must agree with the fixed output family.

The schema `1.0.0` output contains `timesUtc`, `sunPositionMoonFixedKm`
(`{x,y,z}` objects), `sunDistanceKm`, `sunAngularRadiusDeg`, and fixed metadata:
`MOON_ME_DE421`, `DE421`, `NONE`, `real`, `MOON`, `MOON_TO_SUN`, `km`.
The source object includes SHA-256 hashes, and coverage contains the common
conservative interval, not merely the sampled endpoints. Each vector comes directly
from `spkezr("SUN", et, "MOON_ME_DE421", "NONE", "MOON")`. Angular radius is
`degrees(asin(695700 / distanceKm))`, at the **Moon center**, not at a surface observer.
No interpolation, extrapolation, fallback, light-time or stellar aberration is used.
This matches Agent3's registered-sky body-frame family; observer subtraction and
local horizon projection belong downstream.

Timestamps must include explicit UTC seconds ending `Z`, with zero or 1–3 decimal
digits. Invalid calendars and leap-second spellings are rejected. Requests contain
1–100000 strictly increasing entries; submit larger runs as independently validated
chunks. Every timestamp must be within one common conservative coverage interval.

CLI:

```text
python src/features/ephemeris/tools/generate_solar_vectors.py --request request.json --output solar.json --kernels-dir KERNEL_DIRECTORY
python src/features/ephemeris/tools/solar_coverage.py --kernels-dir KERNEL_DIRECTORY --output src/features/ephemeris/fixtures/de421-coverage-report.json
```

Generation finishes before atomic output replacement. A unique staging file in the
output directory is flushed and replaced; errors preserve an existing artifact.

## Reproduction and provenance

The manifest and kernels were extracted from
`origin/feat/horizon-visibility:data/kernels/` using Python subprocess byte stdout,
not PowerShell text redirection. LFS pointers are detected and would instead be
fetched from each official manifest URL. In this run actual git blobs were available.
All four byte lengths and SHA-256 digests matched Agent3's manifest. The measured
JSON report records the actual hashes and official NASA/JPL NAIF URLs, as well as
SPICE toolkit and spiceypy versions. Verified files and manifest are shared read-only
at `%LOCALAPPDATA%\Temp\opencode\de421-solar-kernels`.

`solar_coverage.py` is standalone and provides `verify_kernels(directory)`,
`kernel_context(directory)`, `measure_loaded(sources)` and `measure(directory)`.
The generator uses these same functions. Every run verifies the manifest and immutable pinned Agent3-family hashes before
furnishing kernels. Relative furnishing inside a restored working-directory context
avoids CSPICE Windows Unicode pathname failures. Only kernels loaded by the context
are unloaded; unrelated loaded kernels are rejected to prevent precedence pollution.
SPICE and process cwd are global: serialize all SPICE/cwd access, including access
outside these modules, or run the CLI in a dedicated process. No `kclear` is used.

## Measured coverage, not filename guesses

The generator inspects SPK objects and segment descriptors (`spkobj`, `dafus`) to
resolve center chains. The actual chains are SUN `10 → 0` and Moon `301 → 3 → 0`.
Thus the required SPK objects are **10, 301 and 3**: testing only SUN coverage is
insufficient; Earth 399 is not a dependency of this geometric Moon-to-Sun query.
`spkcov` gives each required object's closed ET coverage:

- SPK: `[-3169195200, 1696852800]` TDB seconds past J2000.
- Binary lunar PA PCK, class ID **31006**, measured with `pckfrm` and `pckcov`:
  `[-3155716800, 1609416000]`.
- Their intersection: **`[-3155716800, 1609416000]` ET**.

The PCK, not the SPK, limits usable Moon-fixed coverage. The frame kernel maps the
ME frame to the DE421 PA orientation. Both native intersection endpoints, midpoint,
and inward UTC endpoints were successfully evaluated with real SPICE `spkpos`.

Conservative whole-second labels from the pinned LSK are:

**1899-12-31T23:59:19Z through 2050-12-31T23:58:49Z**.

These are deliberately rounded inward and are **not** predictions of future civil
UTC or proof of historical clock accuracy. Before 1972 the LSK extrapolates its
earliest DELTA_AT; this does not reconstruct historical UTC/UT. `naif0012.tls` cannot
predict future leap seconds. Future endpoint labels can shift after an LSK update;
native ET coverage is the authoritative kernel-domain statement. The output and
coverage report warn about both limitations.

## Supported study interval

**2000-01-01T00:00:00Z to 2019-01-01T00:00:00Z** is fully inside the measured common
coverage: 19 calendar years, approximately 19.000684621 Julian years. Both endpoints
were evaluated successfully and the continuous native interval contains the full
study. This provides a practical ≥18.6-year study window without pre-1972 clock
extrapolation or speculative future UTC.

An 18.6/19-year duration does **not** ensure every shadow is captured. Temporal
sampling, terrain resolution, local observer geometry and event-detection policy
must independently resolve short illumination/shadow events. Kernel coverage is
also not an accuracy certification for the physical model.

## Validation

With spiceypy installed and `SOLAR_KERNELS_DIR` set to the verified directory:

```text
python -m unittest discover -s src/features/ephemeris/tests -p test_solar_vectors.py -v
```

All **8 tests passed**, including real direct-SPICE vector and radius comparison,
coverage endpoints, full-study eligibility, out-of-range rejection, strict input
validation, tampered manifest rejection, failure cleanup, cwd/kernel-pool restoration,
and atomic-output preservation. Real tests explicitly skip without kernels; input
and filesystem tests still execute. No kernels or dependency packages are committed.
