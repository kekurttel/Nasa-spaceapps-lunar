# 🌙 LunarSight — Lunar Landing Site Navigator

> **NASA Space Apps Challenge 2026** — *The Next Frontier*

An intuitive web tool that helps mission planners, educators, and the public evaluate lunar landing sites by visualizing **Sun and Earth positions** relative to the local horizon, enabling rapid assessment of **solar power availability** and **direct-to-Earth communication windows**.

## Verified terrain/sky analysis CLI

Separate from existing web backend: real LOLA terrain and geometric SPICE Sun/Earth directions share `MOON_ME_DE421`, DEM-derived surface height, and observer position. Registration is checked before visibility. See [registered workflow](docs/registered-workflow.md) and [frame evidence](docs/frame-registration-evidence.md).

```sh
python -m pip install -r scripts/requirements-registration.txt
node scripts/run-registered-analysis.mjs --output output/registered-analysis.json
```

The bundled global DEM is coarse (~7.58 km/pixel); polar extrapolation and near-field terrain are not landing-safety quality. A separate [80 m polar workflow](docs/polar-workflow.md) downloads a 29.84 MB regional height product and defaults to 80 m radial sampling. Measured default terrain/sky child stages total about 5.43 s; terrain Python process peaks around 208 MiB working set / 922 MiB private commit on the tested Windows machine. Neither CLI replaces the web backend's ephemeris path.

```sh
python -m pip install -r scripts/requirements-registration.txt -r scripts/requirements-polar.txt
python scripts/fetch-polar-lola.py
node scripts/run-polar-analysis.mjs --output output/polar-analysis.json
```

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

- **JPL Horizons System** — Backend query path and archived real Sun/Earth responses, plus new Moon-center DE441 vector queries and reproducible same-epoch comparison with local DE421. Comparison is not surface-observer registration. Registered terrain CLI still uses DE421 SPICE, not Horizons. Backend fallback policy remains separate. See [Horizons evidence](docs/research/horizons-registration-options.md).
- **LOLA (Lunar Orbiter Laser Altimeter)** — Verified global `LDEM_4_FLOAT V3.0` used by existing terrain CLI. Regional `LDEM_80S_80M V2.1` JP2 and label also downloaded and decoded; separate polar CLI verified through real terrain, registered SPICE sky and visibility; 80 m radial sampling is default. Neither terrain path is connected to web results. See [coordinator validation](docs/research/coordinator-polar-validation.md) for actual pixel checks, measured sampling sensitivity and memory limits.
- **NASA/JPL NAIF SPICE / DE421** — Downloaded kernels used by the registered CLI for geometric sky directions in `MOON_ME_DE421`; auxiliary source, not a substitute for the required Horizons integration.
- **NASA Moon Trek** — Frontend basemap configured; independent WMTS capabilities read and target-containing JPEG tile retrieved. Frontend rendering, interactive visual review and numeric elevation use remain unverified. See [map-source evidence](docs/research/map-source-evidence.md).
- **LROC QuickMap** — Required visual review still pending; no completed validation claimed.

Source policy: [sources.md](sources.md). Using all four core sources in their respective roles is a user project requirement, not an asserted NASA requirement. Current source use does not yet meet that full requirement.

## 🏆 NASA Space Apps Challenge 2026

**Challenge:** Lunar Landing Site Navigator  
**Theme:** The Next Frontier  
**Team:** 5 members  

## 📄 License

MIT License — Built for NASA Space Apps Challenge 2026
