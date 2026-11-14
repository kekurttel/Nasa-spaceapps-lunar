# Local reference backend

> **Compatibility change:** `/api/ephemeris` keeps the existing request/response contract, not the original network engine's domain of support. The active endpoint intentionally accepts only exact catalog coordinates and bundled time coverage. Unsupported input returns 422; unavailable/invalid reference data returns 503. `backend/app/ephemeris.py` is now a strict local-data facade; the original network engine is not retained. No automatic network or geometric fallback is invoked. Mission atlas search does not expand supported ephemeris coordinates.

## Hosting / CORS

Run the Uvicorn command below from repository root. Production hosts should bind `--host 0.0.0.0` and use the port required by their platform. Install dependencies and deploy the reference bundle alongside the Python app; a static frontend host alone cannot run this backend. Check `/api/data/status` to verify deployed data availability.

For same-origin deployment, reverse-proxy `/api/*` to FastAPI preserving the `/api` prefix. Frontend production builds default to relative `/api`; development defaults to `http://localhost:8000/api`.

A static production preview at `http://localhost:3001` has no `/api` proxy by default. Set frontend `REACT_APP_API_URL=http://localhost:8000/api` before building; set backend `CORS_ALLOW_ORIGINS=http://localhost:3001`. Without this configuration, relative `/api` reaches the static server instead of FastAPI.

For separate origins, set frontend `REACT_APP_API_URL=https://api.example.com/api` before building, then set backend `CORS_ALLOW_ORIGINS=https://your-frontend.example`. Multiple origins are comma-separated, without paths. Defaults: `http://localhost:3000,http://127.0.0.1:3000`. CORS credentials are disabled; browser calls do not require cookies. Prefer exact production origins rather than `*`. CORS is not authentication or an API access-control boundary.

See `.env.example`. Export variables in the shell or hosting platform; the file is not automatically loaded. No Vercel/Netlify config is present; configure an API service/proxy explicitly.

Run from repository root (Python 3.10+):

```powershell
python -m pip install -r backend/requirements.txt
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
python -m pip install pytest httpx
python -m pytest backend/tests -q
```

Default bundle: packaged repository `data/lunanav`, not the upstream checkout. Deploy this directory with the backend. Override before server startup:

```powershell
$env:LUNANAV_DATA_DIR = 'C:\path\to\data\lunanav'
```

`Path(__file__).resolve().parents[2]` in `backend/app/reference_data.py` is the repository root (`parents[0]=app`, `[1]=backend`, `[2]=repository`). Tests verify the default directory.

## API

- `GET /api/presets`: all local skyline + series site pairs; metadata from `sites.yaml`, `derived_sites.yaml`, `landed_missions.yaml`. Derived points remain labelled derived; no invented elevation.
- `GET /api/data/status`: per-site UTC coverage, native cadence, terrain label, source citations, upstream coordinate verification flag, limitations.
- `GET /api/terrain/{site_id}`: original azimuth/elevation skyline, observer height, search radius, source label. Unknown IDs: 404.
- Existing `POST /api/ephemeris` and `GET /api/ephemeris/single` contracts retained. Additive per-site `provenance`, point `sun_visible_fraction`, `sun_horizon`, `earth_horizon`.
- `step_hours`: float, 0.25–24. UTC normalization; naive ISO dates interpreted UTC. Reversed/invalid windows: 422. Request limit: 100000 samples across sites.
- **Strict local data only.** Unsupported coordinates/coverage: 422. Missing/invalid reference data: 503. No geometric fallback, network request, extrapolation, nearest-site snapping, or legacy approximation endpoint.

## Actual data / precision limits

Inspected local bundle contains 33 series and 33 skyline profiles. Shackleton series: 19008 hourly samples, 2026-11-01T00:00:00Z through 2028-12-31T23:00:00Z. Other sites report their own coverage through status; do not assume common coverage.

Coordinates must match catalog within 1e-6 degrees (roundoff tolerance); longitude periodicity supported. Entire window must fit one series. No arbitrary-coordinate DEM calculation. Runtime reads precomputed NPZ + JSON; never loads reference Python or DEM.

Native timestamps retain precomputed solar visible disk fractions and Earth booleans. Non-native timestamps use linear altitude/disk-fraction interpolation, unwrapped azimuth interpolation, periodic skyline lookup; Earth center compared against skyline. These estimates are explicitly `LUNANAV_PRECOMPUTED_INTERPOLATED`, **not 15-minute SPICE calculations or newly resolved terrain transitions**. Hourly native data cannot establish sub-hour event accuracy. Solar fraction interpolation can smear short transitions.

`solar_flux_pct` means visible solar disk percentage, not panel irradiance, generated electrical power, or incidence-angle-adjusted flux. Summary hours use left-held sample intervals; final endpoint contributes zero hours. Summary windows approximate sampled transitions, not exact root-found event times. Earth visibility means Earth center clears terrain; no DSN station visibility, RF link budget, relay, propagation, occultation margin, or availability guarantee.

Provenance includes SHA-256 of local series and horizons files, original terrain label and coordinate citation. Hashes identify artifacts; they do not independently verify the upstream astronomical model, DEM generation, publications, or claimed coordinate verification. `coordinate_verified_upstream` repeats upstream metadata only. Source DEM is not bundled in this backend. Reference attribution below does not replace source-data terms.

Tests exercise native values, quarter-hour estimates, strict failures, duration accounting, timezone normalization, skyline lookup, missing data, default path. Tests require the supplied local bundle. No frontend/reference files changed.
