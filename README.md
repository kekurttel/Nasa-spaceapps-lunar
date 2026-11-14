# 🌙 LunarSight — Lunar Landing Site Navigator

> **NASA Space Apps Challenge 2026** — *The Next Frontier*

An intuitive web tool that helps mission planners, educators, and the public evaluate lunar landing sites by visualizing **Sun and Earth positions** relative to the local horizon, enabling rapid assessment of **solar power availability** and **direct-to-Earth communication windows**.

## 🚀 Features

- **Interactive Moon Map** — Click anywhere on the lunar surface to select a landing site
- **Sun & Earth Horizon Charts** — Visualize elevation angles over time
- **Power Window Analysis** — When is solar energy available at your site?
- **Communication Window Analysis** — When can you communicate directly with Earth?
- **Multi-Site Comparison** — Compare multiple landing sites and dates side-by-side
- **Preset Sites** — Quick access to notable South Pole candidate sites (Shackleton, Nobile, de Gerlache, etc.)

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript |
| Moon Map | Leaflet + NASA Moon Trek tiles |
| Charts | Recharts |
| Backend | Python FastAPI |
| Ephemeris | JPL Horizons API + Astropy |
| Terrain | LOLA DEM (future enhancement) |

## 📦 Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm start
```

Open http://localhost:3000

## Deployment / API compatibility

**Behavior change:** the active `/api/ephemeris` endpoints retain their request/response shape, but now intentionally use strict local reference data. They do **not** preserve the original network engine's arbitrary-coordinate or arbitrary-date behavior. Unsupported coordinates/coverage return 422; missing/invalid reference artifacts return 503. No silent network/geometric fallback. `backend/app/ephemeris.py` is now a strict local-data facade; the original network engine is not retained. See [backend documentation](backend/README.md) for precision and provenance limits. Atlas mission search is informational; its coordinates are not automatically supported analysis sites.

- Development: run FastAPI on port 8000, then `npm start` in `frontend`. The default API URL is `http://localhost:8000/api`.
- Production: run `npm ci` then `npm run build` in `frontend`; serve `frontend/build`. The default API URL is relative `/api`, never a visitor's localhost.
- Static preview on `http://localhost:3001` has no `/api` proxy by default. Before building, set `REACT_APP_API_URL=http://localhost:8000/api`; start the backend with `CORS_ALLOW_ORIGINS=http://localhost:3001`. Rebuild after changing the frontend variable. Otherwise relative `/api` targets the static preview server, not FastAPI.
- Same-origin hosting: forward `/api/*` to FastAPI **preserving `/api`**. Apply SPA fallback to frontend routes only, not API requests. The static build does not include a Python API.
- Separate backend: set `REACT_APP_API_URL=https://api.example.com/api` **before building**. Set backend `CORS_ALLOW_ORIGINS=https://your-frontend.example` (comma-separated exact origins for multiple sites). CRA environment values are build-time, not runtime.
- Backend: install `backend/requirements.txt`; start `python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000` from repository root. Deploy the packaged `data/lunanav` reference bundle (the default, not the upstream checkout); set `LUNANAV_DATA_DIR` only if stored elsewhere. Check `/api/data/status` after deployment.
- No Vercel/Netlify deployment configuration is checked in. On a static platform, configure an external FastAPI service plus an `/api` proxy/rewrite, or use the separate-backend setting above. Do not assume Python runs alongside the CRA build.

Environment templates: [`frontend/.env.example`](frontend/.env.example), [`backend/.env.example`](backend/.env.example). Backend environment variables must be exported/configured by the host; the example file is not automatically loaded. Browser API calls do not use cookie credentials. Cross-origin access defaults to local development origins only.

## 📊 Data Sources

- **JPL Horizons System** — Sun & Earth ephemeris data
- **LOLA (Lunar Orbiter Laser Altimeter)** — Surface elevation data
- **NASA Moon Trek** — Lunar basemap tiles
- **LROC QuickMap** — Reference & validation

## 🏆 NASA Space Apps Challenge 2026

**Challenge:** Lunar Landing Site Navigator  
**Theme:** The Next Frontier  
**Team:** 5 members  

## 📄 License

MIT License — Built for NASA Space Apps Challenge 2026
