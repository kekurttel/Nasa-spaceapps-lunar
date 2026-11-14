# Local reference backend

## Compatibility boundary

`/api/ephemeris` preserves request/response shape, **not** the original network engine's arbitrary-coordinate/date domain. Only bundled catalog coordinates and coverage are supported. Unsupported input returns 422; unavailable/invalid reference artifacts return 503. No network/geometric fallback, extrapolation or nearest-site snapping. `app/ephemeris.py` is a local-data facade. Mission atlas search does not expand ephemeris coordinates.

## Install, run, test

From repository root, Python 3.10+:

```powershell
python -m pip install -r backend/requirements.txt
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Fresh test environment:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest backend/tests -q
```

Direct runtime and test dependencies are pinned. `httpx==0.27.2` satisfies the required `<0.28` boundary: FastAPI 0.110.0 / Starlette 0.36.x TestClient still passes the deprecated `app` argument. pytest 8.3.5 and pytest-subtests 0.14.2 support these unittest subtests. These are direct dependency pins, not a transitive lockfile.

Unused Astropy, requests and SciPy removed: repository Python import search found no runtime uses. Runtime reads local artifacts, not live JPL Horizons or Astropy calculations.

### Clean-environment verification — 2026-11-14

Fresh Windows virtual environment, Python 3.13.13; `pip install -r backend/requirements-dev.txt` succeeded. `python -m pytest backend/tests -q`: **67 passed, 15 subtests passed, 3 warnings, 22.85 s**. Warnings: one Starlette/AnyIO alias deprecation; two httpx `app` shortcut deprecations. No failures.

Logs outside repository:

- `%LOCALAPPDATA%\Temp\opencode\e1550ca-backend-clean-venv-install.log`
- `%LOCALAPPDATA%\Temp\opencode\e1550ca-backend-clean-venv-tests.log`

## Hosting and data paths

Deploy `data/lunanav` alongside the backend. Default path is repository-root `data/lunanav`, not an upstream checkout; `app/reference_data.py` resolves the root through `Path(__file__).resolve().parents[2]`. Override before startup:

```powershell
$env:LUNANAV_DATA_DIR = 'C:\path\to\data\lunanav'
```

Check `/api/data/status`. Static frontend hosting cannot execute Python. Production Uvicorn may bind `--host 0.0.0.0` with the platform's required port.

Same-origin deployment must proxy `/api/*` to FastAPI **preserving `/api`**, excluding API paths from SPA fallback. Frontend development default: `http://localhost:8000/api`; production default: relative `/api`.

For separate origins, set frontend `REACT_APP_API_URL=https://api.example.com/api` before building; set backend `CORS_ALLOW_ORIGINS=https://your-frontend.example` (comma-separated exact origins, no paths). Defaults: `http://localhost:3000,http://127.0.0.1:3000`. Credentials disabled. CORS is not authentication or an API access-control boundary.

Static preview at `http://localhost:3001` has no API proxy by default: build with `REACT_APP_API_URL=http://localhost:8000/api`, run backend with `CORS_ALLOW_ORIGINS=http://localhost:3001`. Environment examples require explicit export/configuration; backend does not auto-load `.env.example`.

## Native API

- `GET /api/presets`: catalog from paired skyline/series files and site metadata. Derived sites remain labelled derived.
- `GET /api/data/status`: per-site UTC coverage, cadence, terrain labels, citations and upstream coordinate-verification flag.
- `GET /api/terrain/{site_id}`: precomputed skyline azimuth/elevation, observer height, search radius and source label. Unknown ID: 404.
- `POST /api/ephemeris`, `GET /api/ephemeris/single`: existing shapes with additive provenance, `sun_visible_fraction`, `sun_horizon`, `earth_horizon`.
- `step_hours`: 0.25–24; naive ISO timestamps interpreted as UTC, aware timestamps normalized. Invalid/reversed windows: 422. Maximum 100000 requested samples across sites.

## Actual data and scientific limits

Bundle contains **33 NPZ series and 33 skyline profiles**. Coordinates must match catalog within native roundoff tolerance of 1e-6 degrees; longitude periodicity supported. This is exact-site support, not arbitrary coordinates. Contracts adapter below requires exact equality and matching ID.

Native series cadence is **hourly**. Shackleton coverage: 19008 samples, 2026-11-01T00:00:00Z through 2028-12-31T23:00:00Z. Other sites report their own coverage. Entire request window must fit a series.

Intermediate samples interpolate altitude, azimuth and disk fraction; they do not recompute SPICE geometry or establish validated 15-minute visibility/event timing. Source is labelled `LUNANAV_PRECOMPUTED_INTERPOLATED` where applicable. Summary intervals use the existing duration-weighted local analysis, not root-found events. Visible solar-disk fraction is not incidence-angle-adjusted panel power. Earth-center horizon clearance is not DSN station visibility, RF link budget, relay, propagation or guaranteed communications availability.

Ephemeris reads precomputed NPZ and JSON; it does not load reference Python or recompute skyline from DEM. Separate mission/science services and the frontend terrain renderer consume exported terrain assets. Displayed south-polar DEM is sampled at **200 m spacing**, decimated from 40 m data: spacing is not measurement accuracy. Mesh rendering does not replace backend skyline calculations or expand supported sites. See [terrain attribution](../frontend/public/terrain-data/ATTRIBUTION.md). The original source DEM is not part of the backend reference bundle.

## Contracts adapter and independent engines

- `GET /api/contracts/capabilities`, `POST /api/contracts/local-analysis`: opt-in transport field mapping over this local engine. Current frontend does **not** call it.
- Full UTC `Z` timestamps; 900–86400 second step; exact profile ID/coordinate match; observer height fixed at 2 m; verified surface elevation unavailable.
- Upstream frame remains unverified; `skySeriesCompatible=false`. `IAU_MOON` and `MOON_ME_DE421` requests rejected. Field renaming is not a frame transformation.
- `sunRadiusDeg` is null, not inferred from disk fraction. Caller names/kind/source IDs are labels, not verified provenance.
- Independent CLI engines retain independent frame assumptions. Adapter does not execute them, transform their frames or silently substitute outputs. Agent4 is future integration work, **not integrated** into this runtime.

## Integrity, provenance and license

SHA-256 values identify local artifacts and detect changes; they do **not** prove scientific provenance, frame correctness, upstream geometry, DEM processing, accuracy or publications. `coordinate_verified_upstream` repeats source metadata, not an independent verification. Original terrain labels/citations remain metadata claims.

Reference software: copyright (c) 2026 yutuf, MIT; retain upstream notices in `data/lunanav/LICENSE` and applicable copied assets. MIT is a software license, **not a NASA data license**. NASA/PDS products retain source credits and terms; NASA names imply no endorsement. See [imagery credits](../frontend/public/textures/SOURCES.md) and [terrain attribution](../frontend/public/terrain-data/ATTRIBUTION.md).
