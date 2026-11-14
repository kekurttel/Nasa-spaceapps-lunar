# Contract compatibility: explicit local transport bridge

## Boundary

This adapter maps teammate Scenario inputs to the existing strict-local backend through `routers.build_site`. It does **not** implement a scientifically compliant `IAU_MOON` SkySeries. Field mappings are **not frame transformations**. Native coordinate-frame metadata is unverified; response provenance always says `frame: "UNVERIFIED_UPSTREAM_FRAME"`, `frameVerified: false`, `frameTransformationApplied: false`. Coordinate-source verification flags and artifact hashes do not verify a reference frame.

Independent CLI engines remain independent. Neither endpoint executes external engines, loads their code, invokes SPICE, supplies geometric fallback, nor silently substitutes their outputs. A future verified frame implementation needs real metadata, convention checks and transformations; renaming arrays is insufficient.

Existing API remains unchanged. Coordinator mounts the new router in `backend/app/main.py`:

```python
from app.contracts_router import router as contracts_router
app.include_router(contracts_router)
```

## Endpoints

- `GET /api/contracts/capabilities`: machine-readable supported transport, limits, explicit incompatibilities.
- `POST /api/contracts/local-analysis`: direct Scenario body; response contract `local-analysis/v1`, explicitly `skySeriesCompatible: false`.

Example (replace coordinates with exact values from `/api/presets`):

```json
{
  "id": "scenario-1",
  "site": {
    "id": "shackleton_ridge",
    "name": "Caller label",
    "latDeg": -89.45,
    "lonDeg": 137.4,
    "surfaceElevationM": null,
    "observerHeightM": 2,
    "kind": "reference",
    "sourceIds": []
  },
  "startUtc": "2026-11-01T00:00:00Z",
  "endUtc": "2026-11-01T02:00:00Z",
  "stepSeconds": 900,
  "frame": "UNVERIFIED_UPSTREAM_FRAME"
}
```

The example coordinates are illustrative, **not authoritative**; GET presets first. `frame` may be omitted, meaning acceptance of the explicitly unverified local transport, never an implicit IAU frame. Requests specifying `IAU_MOON` or `MOON_ME_DE421` receive 422. Unknown fields (including alternative frame selectors) receive 422 instead of being ignored.

## Validation and mapping

| Scenario input | Local handling |
| --- | --- |
| `id` | Echoed scenario identifier |
| `site.id` | Must identify a local catalog/profile; must also match coordinate lookup |
| `site.latDeg`, `site.lonDeg` | Must exactly equal that profile's catalog coordinates; no tolerance, snapping or longitude normalization in this bridge |
| `site.name`, `site.kind`, `site.sourceIds` | Caller labels only; echoed, not scientific verification; source IDs marked unverified |
| `site.surfaceElevationM` | Only null/omitted; every non-null value rejected, including zero; no verified elevation datum |
| `site.observerHeightM` | Exactly native 2 m; also checked against profile metadata; other heights rejected, not corrected |
| `startUtc`, `endUtc` | Full `YYYY-MM-DDTHH:MM:SS[.fraction]Z`; valid calendar dates; strictly positive window |
| `stepSeconds` | Finite 900–86400 seconds; divided by 3600 for `build_site`; existing sample limit retained |

Missing bundle: 503. Unknown profile, mismatched coordinates, unavailable dates or incompatible native height: 422. No extrapolation. Native endpoint sampling includes the requested end even when off-grid; time differences need not all equal `stepSeconds`.

## Response

`scenario` echoes validated input. `series` contains equal-length parallel arrays, indexed by `timeUtc`:

| Local-analysis array | Existing point |
| --- | --- |
| `timeUtc` | `datetime` |
| `sunElevationDeg`, `sunAzimuthDeg` | `sun_elevation`, `sun_azimuth` |
| `earthElevationDeg`, `earthAzimuthDeg` | `earth_elevation`, `earth_azimuth` |
| `sunHorizonDeg`, `earthHorizonDeg` | `sun_horizon`, `earth_horizon` (nullable) |
| `sunVisible`, `earthVisible` | `sun_visible`, `earth_visible` |
| `sunVisibleFraction` | `sun_visible_fraction` (nullable) |
| `sunRadiusDeg` | **null at every sample**: native series lacks solar angular radius |

These SkySeries-like arrays are a separately named local transport, not a declaration of SkySeries schema or frame compliance. Solar radius cannot be inferred from visible fraction. Visibility/horizon fields preserve upstream semantics: native solar disk fractions retained; intermediate disk fractions/altitudes interpolated; azimuth unwrapped; skyline periodic; intermediate Earth visibility uses the existing center-threshold calculation. Solar disk percent is not panel power or irradiance.

`summary` preserves the existing `SiteSummary` field names, units and duration-weighted implementation without recomputation. `provenance` preserves engine, interpolation flag, sampling description, profile identity, observer height and hashes, adding explicit unverified-frame/transport flags. `warnings` describes missing radius, frame incompatibility, label trust and independent-engine boundary. Clients must not discard these flags and relabel the result `IAU_MOON`.

## Verification

```powershell
python -m unittest discover -s backend/tests -p test_contracts.py
```

Eight tests cover real local array mapping/duration, explicit HTTP routing, frame/height/elevation rejection, strict UTC/window/step validation, exact identity, out-of-coverage rejection, missing data and capability honesty. Router tested in an isolated FastAPI app; main application mounting belongs to the coordinator.
