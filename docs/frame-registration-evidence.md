# Lunar frame registration evidence

## Conclusion

The LOLA label declares body-fixed `MEAN EARTH/POLAR AXIS OF DE421`. NAIF's official `moon_080317.tf` defines frame ID 31007, `MOON_ME_DE421`, centered on Moon (301), as the DE-421 mean-Earth/polar-axis lunar frame. It defines `MOON_ME` as an alias tied to that DE-421 realization. Thus `MOON_ME_DE421` is the defensible SPICE frame name for vectors intended to align with the label's stated frame. This establishes identity of the named frame realization; it does not independently verify LOLA pixel georeferencing, terrain radius, local normal, or Horizons' `MEAN_ME` site realization.

NAIF `moon_pa_de421_1900-2050.bpc` supplies time-varying orientation for the DE-421 lunar frame. The actual DE421 planetary SPK is `data/kernels/de421.bsp`, retrieved from NAIF's official historical archive `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/a_old_versions/de421.bsp`. Kernel bytes identify it as `DE 421 JPL Planetary Ephemeris SPK`; creation date Feb. 13, 2008. Manifest records the source, exact byte count, and SHA-256. No ephemeris substitution or fallback is used.

For geometric states, call `spkezr(target, et, 'MOON_ME_DE421', 'NONE', 'MOON')`. Subtract observer vector, expressed Moon-centered in this frame, from target position. Do not claim LT+S/apparent/Horizons equivalence for `NONE` results. Applying LOLA's radius-offset DN to a reference sphere can locate a modeled radial point, but the 4 ppd product and its polar cap limits do not certify a precise local normal or small-scale terrain horizon.

## Kernel provenance and limits

`data/kernels/manifest.json` records exact source URLs, byte counts, and SHA-256 digests for all four official NAIF generic-kernel files: FK, binary PCK, LSK, and DE421 SPK. Total download size is 18,497,218 bytes, below 30 MB. CSPICE SPK coverage for Moon (301) is 1899-07-28T23:59:19 through 2053-10-08T23:58:51 UTC, including fixture epoch 2026-11-14. The binary PCK filename declares 1900–2050; FK identifies it as the DE-421 lunar orientation source. No separate SPDX license is asserted; retain NAIF attribution and consult NAIF/JPL terms. No NASA endorsement is implied.

## Verification

With `spiceypy==8.0.0`, run `python scripts/inspect-lunar-frame.py`. It verifies manifest file sizes/digests, frame ID, proper rotation, and finite geometric Sun/Earth Moon-relative position calls at fixture epoch. Verified frame transform determinant: 0.9999999999999996; maximum absolute `R @ R.T - I` element: 4.44e-16. Kernel comment area independently identifies `DE 421 JPL Planetary Ephemeris SPK`; `spice.spkcov('data/kernels/de421.bsp', 301)` confirms coverage above. `bodvrd('MOON','RADII',3)` is unavailable with these kernels; use LOLA product's documented 1737.4 km reference sphere for radial terrain point, not an unsubstantiated kernel radius.
