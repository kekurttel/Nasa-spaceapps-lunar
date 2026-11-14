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
