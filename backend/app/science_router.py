"""Strict read-only science API for local LunaNav artifacts.

Integration: ``from .science_router import router as science_router`` then
``app.include_router(science_router)``. Router already includes /api/science.
LUNANAV_DATA_DIR selects NPZ directory; LUNANAV_WEB_DATA_DIR selects binary/
manifest directory (default: ../web/public/data relative to NPZ directory).
No source code from the supplied bundle is imported or executed.
"""
import json
import math
import os
import struct
from zipfile import BadZipFile
from pathlib import Path

import numpy as np
from fastapi import APIRouter, HTTPException, Query

from .data_paths import web_data_dir
from .reference_data import data_dir, digest, iso, utc_datetime

router = APIRouter(prefix="/api/science", tags=["science"])





def unavailable(path, reason):
    raise HTTPException(503, detail={"error": "science_data_unavailable", "artifact": path.name, "reason": reason})


def read_bytes(path):
    try:
        return path.read_bytes()
    except OSError:
        unavailable(path, "Local artifact missing or unreadable; no fallback")


def load_npz(path):
    try:
        with np.load(path, allow_pickle=False) as archive:
            return {key: archive[key].copy() for key in archive.files}
    except (OSError, ValueError, EOFError, BadZipFile):
        unavailable(path, "Local NPZ missing or invalid; no fallback")


def time_axis(arrays, path):
    try:
        times = np.asarray(arrays["times"], dtype=float)
        if times.ndim != 1 or times.size < 2 or not np.isfinite(times).all() or not (np.diff(times) > 0).all():
            raise ValueError()
        kernel = arrays["ephemeris"].item()
        if not isinstance(kernel, str) or not kernel.strip():
            raise ValueError()
        return times, kernel
    except (KeyError, ValueError, TypeError):
        unavailable(path, "Invalid time axis or absent ephemeris metadata")


def coverage(times, timestamp, path):
    if not times[0] <= timestamp <= times[-1]:
        raise HTTPException(422, detail={"error": "outside_coverage", "artifact": path.name,
                                        "start_utc": iso(times[0]), "end_utc": iso(times[-1]),
                                        "reason": "No extrapolation"})


@router.get("/dsn")
def dsn(datetime: str = Query(...)):
    """Moon-centre station geometry, not terrain visibility or DSN scheduling."""
    try:
        instant = utc_datetime(datetime)
        timestamp = instant.timestamp()
    except (ValueError, TypeError, OverflowError):
        raise HTTPException(422, detail="datetime must be an ISO-8601 datetime (naive values mean UTC)")
    root = data_dir()
    dp, ep = root / "dsn.npz", root / "earth_distance.npz"
    a, b = load_npz(dp), load_npz(ep)
    times, kernel = time_axis(a, dp)
    distances_times, distance_kernel = time_axis(b, ep)
    try:
        names = a["stations"]
        elevations = np.asarray(a["moon_elevation_deg"], dtype=float)
        coords = np.asarray(a["station_coords"], dtype=float)
        if names.ndim != 1 or not len(names) or elevations.shape != (len(names), len(times)) or coords.shape != (len(names), 3):
            raise ValueError()
        if not np.isfinite(elevations).all() or not np.isfinite(coords).all():
            raise ValueError()
        if (np.abs(elevations) > 90).any() or any(not isinstance(n, str) or not n for n in names.tolist()):
            raise ValueError()
    except (KeyError, TypeError, ValueError):
        unavailable(dp, "Invalid DSN arrays")
    try:
        distances = np.asarray(b["earth_moon_km"], dtype=float)
        if distances.shape != distances_times.shape or not np.isfinite(distances).all() or not (distances > 0).all():
            raise ValueError()
    except (KeyError, TypeError, ValueError):
        unavailable(ep, "Invalid Earth-Moon distance array")
    if kernel != distance_kernel:
        unavailable(ep, "DSN and distance ephemeris metadata disagree")
    coverage(times, timestamp, dp)
    coverage(distances_times, timestamp, ep)
    stations = []
    for i, name in enumerate(names.tolist()):
        stations.append({"name": name, "lat": float(coords[i, 0]), "lon": float(coords[i, 1]),
                         "height_m": float(coords[i, 2]),
                         "moon_elevation_deg": float(np.interp(timestamp, times, elevations[i]))})
    return {"datetime": iso(timestamp), "stations": stations,
            "earth_moon_km": float(np.interp(timestamp, distances_times, distances)),
            "provenance": {"ephemeris": kernel, "earth_distance_ephemeris": distance_kernel,
                           "dsn_sha256": digest(dp), "earth_distance_sha256": digest(ep),
                           "interpolated": bool(not np.any(times == timestamp) or not np.any(distances_times == timestamp)),
                           "sampling": "Linear interpolation between native samples; no extrapolation",
                           "dsn_coverage": {"start_utc": iso(times[0]), "end_utc": iso(times[-1])},
                           "distance_coverage": {"start_utc": iso(distances_times[0]), "end_utc": iso(distances_times[-1])},
                           "limits": "Moon centre apparent elevation at DSN complexes; not antenna availability, link budget, or lunar terrain visibility. Local artifact metadata, not independent validation."}}


def binary_grid(path, count):
    raw = read_bytes(path)
    if len(raw) < 12:
        unavailable(path, "Truncated binary header")
    n, spacing, half = struct.unpack_from("<Iff", raw)
    if not n or not math.isfinite(spacing) or not math.isfinite(half) or spacing <= 0 or half <= 0:
        unavailable(path, "Invalid binary grid geometry")
    if len(raw) != 12 + count * n * n:
        unavailable(path, "Binary layer size does not match header")
    values = np.frombuffer(raw, dtype=np.uint8, offset=12).reshape(count, n, n)
    return n, spacing, half, values


@router.get("/layers")
def layers(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180)):
    if not math.isfinite(lat) or not math.isfinite(lon) or not -90 <= lat <= 90 or not -180 <= lon <= 180:
        raise HTTPException(422, detail="Finite lat [-90,90], lon [-180,180] required")
    if lat >= 0:
        raise HTTPException(422, detail={"error": "outside_coverage", "reason": "South-polar maps only; no fallback"})
    # terrain.ts/engine.ts: spherical south-polar stereographic, +x 90E, +y 0E.
    rho = 2 * 1737400 * math.tan((math.pi / 2 + math.radians(lat)) / 2)
    x, y = rho * math.sin(math.radians(lon)), rho * math.cos(math.radians(lon))
    pp, tp = web_data_dir() / "psr.bin", web_data_dir() / "thermal.bin"
    pn, pm, ph, psr = binary_grid(pp, 4)
    tn, tm, th, thermal = binary_grid(tp, 3)
    if (pn, pm, ph) != (tn, tm, th):
        unavailable(tp, "Thermal grid does not match science grid")
    col, row = math.floor((x + ph) / pm), math.floor((ph - y) / pm)
    if not 0 <= col < pn or not 0 <= row < pn:
        raise HTTPException(422, detail={"error": "outside_coverage", "reason": "Outside local science grid; no clamping or fallback"})
    p, t = psr[:, row, col], thermal[:, row, col]
    return {"lat": lat, "lon": lon, "x_m": x, "y_m": y,
            "science": {"psr": int(p[0]) / 255, "sun": int(p[1]) / 255,
                        "earth": int(p[2]) / 255, "ice": int(p[3]) / 255 * .85},
            "thermal": {"avgK": int(t[0]), "maxK": int(t[1]) * 2,
                        "iceM": None if t[2] == 255 else int(t[2]) / 100},
            "provenance": {"psr_sha256": digest(pp), "thermal_sha256": digest(tp),
                           "grid": {"n": pn, "m_per_px": pm, "half_extent_m": ph, "row": row, "col": col},
                           "sampling": "Containing cell; little-endian uint32/float32 header, uint8 layers; terrain.ts scaling",
                           "projection": "Spherical south-polar stereographic; radius 1737400 m; longitude east",
                           "science_source": "NASA GSFC PGDA product 69; USGS ice favorability index (upstream export_psr.py)",
                           "thermal_source": "LRO Diviner Polar Resource Product, dlre_prp_south.tab (upstream export_thermal.py)",
                           "limits": "Quantized upstream exports, not live predictions. PSR export encodes source NaN as zero; original nodata cannot be distinguished. Thermal exporter fills empty cells by nearest neighbour. Ice favorability is an index, not detected ice or probability; null iceM means encoded no stable ice. No runtime gap filling."}}


@router.get("/regions")
def regions():
    path = web_data_dir() / "manifest.json"
    try:
        manifest = json.loads(read_bytes(path))
        items = manifest["regions"]
        if not isinstance(items, list) or not items:
            raise ValueError()
        for region in items:
            if not isinstance(region["name"], str) or not region["name"] or not region["rings"]:
                raise ValueError()
            for ring in region["rings"]:
                points = np.asarray(ring, dtype=float)
                if points.ndim != 2 or points.shape[1] != 2 or len(points) < 4 or not np.isfinite(points).all():
                    raise ValueError()
    except (ValueError, KeyError, TypeError):
        unavailable(path, "Invalid region manifest")
    # Deliberately omit global manifest sources: its generic DE440 claim conflicts
    # with actual local NPZ ephemeris=de421.bsp. Region polygons need no ephemeris.
    return {"regions": items, "provenance": {"manifest_sha256": digest(path),
            "source": "NASA Artemis III candidate regions (Oct 2024), USGS region grids; local LunaNav manifest",
            "coordinates": "South-polar stereographic [x_km,y_km], not [lon,lat]; radius 1737.4 km, +x toward 90E, +y toward 0E",
            "limits": "Upstream region outlines, not certified landing sites; no independent boundary validation. Generic manifest ephemeris claims not used."}}
