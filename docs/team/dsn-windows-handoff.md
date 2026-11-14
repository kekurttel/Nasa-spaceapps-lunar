# DSN sampled windows API handoff

`POST /api/science/dsn/windows`

```json
{"start_utc":"2026-11-01T00:00:00Z","end_utc":"2026-11-01T06:00:00Z","step_seconds":3600,"elevation_mask_deg":10}
```

Both timestamps require explicit UTC offsets. Step: 60–86400 seconds; mask: -90–90 degrees. Maximum 31 days and 2000 samples. Start and end must both lie inside both artifact coverages. Samples begin at start, advance by step, and stop at or before end; end is not appended unless aligned.

Response: `times_utc`, `step_seconds`, `elevation_mask_deg`, `earth_moon_km` and `stations`. Each station has coordinates, `moon_elevation_deg` and `above_mask` arrays aligned with `times_utc`, plus `sampled_windows` containing inclusive `start_index`, `end_index`, `start_utc`, `end_utc`. Mask comparison is >=. Windows describe consecutive samples, not exact crossings. `provenance` gives artifact hashes, coverage, ephemeris, interpolation disclosure, frame description and limitations. This is Moon-centre station geometry, not link, antenna availability or lunar terrain visibility. Missing/invalid artifacts return 503; invalid requests or out-of-coverage dates return 422. No extrapolation.
