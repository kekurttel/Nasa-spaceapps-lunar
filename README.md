# LunarSight — Lunar Landing Site Navigator

NASA Space Apps Challenge 2026 — The Next Frontier.

Compare local Sun visibility and Earth-center horizon clearance at supported lunar sites. Educational planning aid, not a flight-qualified power or communications model.

## Features and limits

- React + TypeScript interface, lunar globe, horizon charts, independent A/B dates and comparison windows.
- FastAPI reads bundled precomputed NPZ series and JSON skyline profiles for **33 exact catalog sites**. No live JPL Horizons, Astropy runtime, arbitrary-coordinate ephemeris, nearest-site snapping or network fallback.
- Native series cadence is **hourly**. Intermediate samples, including 15-minute requests, use interpolation; they are not new SPICE calculations or validated sub-hour events. Query `/api/data/status` for each site's actual coverage.
- Separate measured south-polar LOLA terrain view uses a DEM sampled at **200 m spacing**, decimated from a 40 m source. Sampling spacing is not measurement accuracy. This rendered mesh does not recompute the backend skyline or expand supported ephemeris sites. See [terrain attribution and limits](frontend/public/terrain-data/ATTRIBUTION.md).
- Solar visible-disk percentage is not panel output. Earth-center visibility is not a DSN link budget, relay model or communications guarantee. Battery estimates remain simplified planning aids.
- Mission atlas search is informational; returned coordinates are not automatically supported analysis sites.

## Quick start

From repository root, Python 3.10+:

```powershell
python -m pip install -r backend/requirements.txt
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

In another terminal:

```powershell
cd frontend
npm install
npm start
```

Open http://localhost:3000.

Backend tests, preferably in a fresh virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest backend/tests -q
```

Test tooling pins `httpx==0.27.2` (required `<0.28` for FastAPI 0.110.0 / Starlette TestClient), pytest and pytest-subtests. See [backend documentation](backend/README.md).

## Deployment / API compatibility

**Behavior change:** `/api/ephemeris` retains request/response shape, not the former network engine's arbitrary-coordinate/date support. Unsupported coordinates or coverage return 422; missing/invalid local reference data returns 503. No silent geometric/network fallback.

- Deploy `data/lunanav` with FastAPI; override via `LUNANAV_DATA_DIR` before startup. Check `/api/data/status`.
- Development API default: `http://localhost:8000/api`.
- Production: run `npm ci` then `npm run build` inside `frontend`; serve `frontend/build`. Default API URL is relative `/api`, never the visitor's localhost.
- Same-origin hosting must proxy `/api/*` to FastAPI **preserving `/api`**. Apply SPA fallback only to frontend routes. A static build cannot run Python.
- Separate origins: set `REACT_APP_API_URL=https://api.example.com/api` **before building**; set backend `CORS_ALLOW_ORIGINS=https://your-frontend.example`. Multiple origins are comma-separated. CRA variables are build-time values.
- Static preview at `http://localhost:3001` has no API proxy by default. Build with `REACT_APP_API_URL=http://localhost:8000/api`; run backend with `CORS_ALLOW_ORIGINS=http://localhost:3001`.
- Production backend command: `python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000`.
- Environment examples: [`frontend/.env.example`](frontend/.env.example), [`backend/.env.example`](backend/.env.example). Export/configure values explicitly; backend does not auto-load the example.

## Integration boundaries

`/api/contracts/capabilities` and `/api/contracts/local-analysis` expose an opt-in transport adapter; the current frontend does **not** invoke it. Mapping fields is not a coordinate-frame transformation. Local series frame metadata remains unverified; `IAU_MOON` and `MOON_ME_DE421` requests are rejected. Independent engines retain independent frame assumptions and are not invoked or interchangeable through this adapter. Agent4 remains future integration work, not an integrated runtime engine.

## Sources, integrity and license

Source citations and terrain labels describe upstream metadata, not independently validated accuracy. SHA-256 hashes check artifact identity/integrity; they do **not** establish scientific provenance, frame correctness or model validity. See [backend limits](backend/README.md), [imagery credits](frontend/public/textures/SOURCES.md) and [terrain attribution](frontend/public/terrain-data/ATTRIBUTION.md).

Project/reference software uses MIT licensing with applicable copyright notices retained. MIT is **not a NASA data license**; NASA/PDS imagery and science products retain their source terms and credits. NASA names do not imply endorsement.
