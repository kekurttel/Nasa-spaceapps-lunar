# 🌙 LunarSight — Lunar Landing Site Navigator

> **NASA Space Apps Challenge 2026** — *The Next Frontier*

An intuitive web tool that helps mission planners, educators, and the public evaluate lunar landing sites by visualizing **Sun and Earth positions** relative to the local horizon, enabling rapid assessment of **solar power availability** and **direct-to-Earth communication windows**.

## Verified terrain/sky analysis CLI

Separate from existing web backend: real LOLA terrain and geometric SPICE Sun/Earth directions share `MOON_ME_DE421`, DEM-derived surface height, and observer position. Registration is checked before visibility. See [registered workflow](docs/registered-workflow.md) and [frame evidence](docs/frame-registration-evidence.md).

```sh
python -m pip install -r scripts/requirements-registration.txt
node scripts/run-registered-analysis.mjs --output output/registered-analysis.json
```

The bundled DEM is coarse (~7.58 km/pixel); polar extrapolation and near-field terrain are not landing-safety quality. This CLI does not replace the web backend's ephemeris path.

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
| Terrain | Verified LOLA DEM in separate CLI; not integrated into web backend |

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

## 📊 Data Sources

- **JPL Horizons System** — Backend query path and archived real Sun/Earth responses; not the registered terrain CLI's ephemeris source. Backend fallback policy remains separate from the CLI.
- **LOLA (Lunar Orbiter Laser Altimeter)** — Downloaded `LDEM_4_FLOAT V3.0` elevation raster and PDS label, verified and used by the terrain CLI; not yet connected to web results.
- **NASA/JPL NAIF SPICE / DE421** — Downloaded kernels used by the registered CLI for geometric sky directions in `MOON_ME_DE421`; auxiliary source, not a substitute for the required Horizons integration.
- **NASA Moon Trek** — Basemap tile URL configured in frontend; successful layer delivery and scientific visual review are not established by that configuration alone.
- **LROC QuickMap** — Required visual review still pending; no completed validation claimed.

Source policy: [sources.md](sources.md). Using all four core sources in their respective roles is a user project requirement, not an asserted NASA requirement. Current source use does not yet meet that full requirement.

## 🏆 NASA Space Apps Challenge 2026

**Challenge:** Lunar Landing Site Navigator  
**Theme:** The Next Frontier  
**Team:** 5 members  

## 📄 License

MIT License — Built for NASA Space Apps Challenge 2026
