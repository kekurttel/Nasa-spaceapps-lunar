# Registered real lunar SkySeries

`src/features/visibility/registered-sky.py` produces topocentric Sun and Earth directions in `ME_DE421_LOCAL_NORTH_EAST`, registered to an explicit lunar site and terrain surface height. It is a geometric SPICE calculation using the DE421 ephemeris, `MOON_ME_DE421` body-fixed frame, and aberration correction `NONE`; it is not a Horizons observation and does not include light-time or stellar aberration.

Install the pinned dependency with `python -m pip install -r scripts/requirements-registration.txt`. The runner requires `data/kernels/manifest.json` with a `files` array containing records `{ "fileName", "url", "bytes", "sha256" }` for each of the four required kernels. Every kernel is verified against the manifest before SPICE loads it. Missing files, hashes, kernels, invalid UTC, or inconsistent time ordering are fatal; there is no synthetic fallback.

Request JSON shape:

```json
{
  "scenarioId": "scenario-1",
  "siteId": "site-1",
  "latitudeDeg": 0,
  "longitudeDeg": 0,
  "observerHeightM": 2,
  "surfaceHeightM": 0,
  "terrainSha256": "<64 hex characters>",
  "frame": "ME_DE421_LOCAL_NORTH_EAST",
  "timesUtc": ["2026-11-14T00:00:00Z"]
}
```

Optional `kernelsDir` selects another kernel directory; the source hashes still come exclusively from that directory's manifest, never from caller-provided hash values. Execute with:

```powershell
python src/features/visibility/registered-sky.py --request request.json --output sky.json
```

The output aligns each numeric series to `timesUtc` and records the site, radius, terrain digest, frame, aberration setting, and verified kernel hashes in `registration`. Sun angular radius uses a fixed 695,700 km solar radius and the geometric topocentric range. Angles are azimuth clockwise from local north and altitude above the local tangent plane. Run geometry tests with `python -m unittest discover -s tests -p test_registered_sky.py` (requires the pinned dependency).
