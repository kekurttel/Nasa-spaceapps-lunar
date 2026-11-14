# Agent 2 → Agent 3: Moon-fixed solar vectors for shadow simulation

## Scope and ownership

New contract version `1.0.0` is separate from the existing `IAU_MOON`/DE440s SkySeries path. Existing shared delivery `99dfb9efa438dadad251bb1779140df71d7ccd0d` is preserved. This work is delivered only on `feat/lunar-ephemeris-review`; it does not change Agent 3 raster/shadow source or enable a frame conversion.

Agent 3 comparison source: `e241cee6d9f149767379a4891cb0344cf2a7d28d:src/features/visibility/registered-sky.py`. This is a pinned repository implementation, not evidence of a live communication with Agent 3.

## Coordinate meaning

- `sunPositionMoonFixedKm[i] = {x,y,z}`: **position of the Sun centre relative to the Moon centre**, expressed in **MOON_ME_DE421**, kilometres.
- Origin: `MOON`; direction: `MOON_TO_SUN`. Not a unit direction, not a site-relative vector, not an apparent/light-time corrected position.
- Ephemeris family: `DE421`; aberration correction: `NONE`.
- Uses exact four-kernel registered-sky family: `de421.bsp`, `moon_080317.tf`, `moon_pa_de421_1900-2050.bpc`, `naif0012.tls`, with byte counts and SHA-256 verified before computation.
- Frame labels are contractual. `IAU_MOON`, `MOON_ME_DE421` and `ME_DE421_LOCAL_NORTH_EAST` are NOT aliases. No IAU-to-ME relabeling or transformation is performed.

For a raster cell with body-fixed position `p` in the SAME frame and kilometres, form `s = sunPositionMoonFixedKm[i] - p`. Normalize `s` to obtain the illumination ray from cell toward Sun. Use a cell surface normal in this same frame for illumination dot products. Do not reuse one selected site's azimuth/elevation for all cells.

The NEU reference uses planetocentric latitude, east-positive longitude and spherical reference radius `1737.4 km`, plus radial surface and observer heights. A terrain cell's radial height datum and body-fixed coordinates must match Agent 3 registration. Frame agreement alone does not validate a DEM datum or surface normals.

## Distance and solar limb

`sunDistanceKm[i] = norm(sunPositionMoonFixedKm[i])`, from **Moon centre**.

`sunAngularRadiusDeg[i] = asin(695700 / sunDistanceKm[i]) * 180/pi`.

The field is a geometric angular semidiameter, despite the common phrase apparent angular size; `NONE` does not introduce physical apparent-position corrections. It is not a fixed 0.266-degree constant.

At each cell use `norm(s)` instead of Moon-centre distance if doing finite-distance penumbra/solar-disc calculations. The local projection helper reports topocentric distance and topocentric angular radius separately. Agent 3 registered-sky's `sunRadiusDeg` is topocentric and should be compared to this local result, NOT directly to the centre-radius field. Solar-disc visibility is not the same as energy production or a communication link budget.

## Sampling safety

Only explicitly computed epochs are data. No interpolation/extrapolation is supplied by the new solar contract. Missing sampled timestamps and dates outside declared verified coverage fail explicitly.

Coarse screening epochs are not proof of permanent shadow: an event can occur between samples, short illumination can be missed, and a nodal-cycle survey may require terrain, solar-disc and multi-scale convergence studies. Refinement of a sign-changing local tangent altitude bracket is a request plan, not a solved terrain-shadow event. A raster engine must also refine terrain-horizon crossings and tangential/no-sign-change events.

Chunked temporal planning limits memory; it does not improve temporal accuracy by itself. Keep source hashes, exact epoch plan, terrain registration, coverage and warnings with each scientific result.

## Limits on claims

DE421/PCK native coverage is distinguished from UTC clock prediction. Future UTC uses the supplied leap-second kernel and cannot know future announced leap seconds. Near-pole azimuth is condition-sensitive; vector/altitude residuals matter more than azimuth alone. Exact-pole compass bearings are not uniquely defined.

See `02-solar-coverage.md` for measured effective coverage and `02-solar-validation.md` for numerical residuals and tolerances. Cross-validation against registered-sky is an independent local projection implementation using the SAME SPICE/kernel family, not an independent astronomical ephemeris validation and not a proof that a 19-year PSR study has been completed.
