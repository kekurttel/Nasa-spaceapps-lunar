"""Read-only adapter for the separately supplied LunaNav data bundle.

No reference code is imported/executed. File hashes identify local artifacts;
they are not independent scientific validation of the upstream computations.
"""
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import yaml

from .data_paths import DEFAULT_DATA_DIR, data_dir


def utc_datetime(value):
    from dateutil.parser import isoparse
    dt = isoparse(value)
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def catalog():
    root = data_dir()
    profiles_file = root / "horizons.json"
    if not profiles_file.is_file():
        return []
    profiles = json.loads(profiles_file.read_text(encoding="utf-8"))
    metadata = {}
    for name in ("sites.yaml", "derived_sites.yaml", "landed_missions.yaml"):
        path = root / name
        if path.is_file():
            document = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            for site in document.get("sites", []):
                metadata[site["id"]] = site
    result = []
    for profile in profiles:
        site_id = profile["site_id"]
        # Reject IDs that could escape the configured data directory.
        if not site_id.replace("_", "").replace("-", "").isalnum():
            continue
        path = root / "series" / f"{site_id}.npz"
        if not path.is_file():
            continue
        meta = metadata.get(site_id, {})
        result.append({"id": site_id, "name": meta.get("name", site_id),
                       "lat": profile["lat"], "lon": profile["lon"],
                       "description": meta.get("note", "Local precomputed reference point; publication provenance unavailable."),
                       "feature_type": meta.get("category", "reference"),
                       "elevation_m": None, "coordinate_source": meta.get("source"),
                       "coordinate_verified_upstream": bool(meta.get("verified", False)),
                       "profile": profile})
    return result


def match_site(lat, lon):
    # Exact coordinates only (roundoff tolerance ~3 cm latitude). Never snap nearby terrain.
    for site in catalog():
        delta_lon = (lon - site["lon"] + 180) % 360 - 180
        if abs(lat - site["lat"]) <= 1e-6 and abs(delta_lon) <= 1e-6:
            return site
    return None


def load_series(site_id):
    path = data_dir() / "series" / f"{site_id}.npz"
    with np.load(path, allow_pickle=False) as archive:
        arrays = {key: archive[key].copy() for key in archive.files}
    times = arrays["times"].astype(float)
    required = ("sun_alt", "sun_az", "earth_alt", "earth_az", "sun_fraction", "earth_visible")
    if len(times) < 2 or not np.all(np.isfinite(times)) or not np.all(np.diff(times) > 0):
        raise ValueError("Invalid reference time axis")
    for key in required:
        if arrays[key].shape != times.shape or not np.all(np.isfinite(arrays[key])):
            raise ValueError(f"Invalid reference array: {key}")
    return arrays


def iso(timestamp):
    return datetime.fromtimestamp(float(timestamp), timezone.utc).isoformat().replace("+00:00", "Z")


def reference_ephemeris(lat, lon, start, end, step_hours):
    site = match_site(lat, lon)
    if site is None:
        return None
    arrays = load_series(site["id"])
    times = arrays["times"].astype(float)
    first, last = start.timestamp(), end.timestamp()
    if first < times[0] or last > times[-1]:
        return None  # no extrapolation, no mixing engines within a series
    query = np.arange(first, last + 0.00001, step_hours * 3600)
    if query[-1] < last - 0.00001:
        query = np.append(query, last)
    profile = site["profile"]
    def linear(key):
        return np.interp(query, times, arrays[key])
    def azimuth(key):
        return np.degrees(np.interp(query, times, np.unwrap(np.radians(arrays[key].astype(float))))) % 360
    sun_alt, earth_alt = linear("sun_alt"), linear("earth_alt")
    sun_az, earth_az = azimuth("sun_az"), azimuth("earth_az")
    sun_horizon = np.interp(sun_az, profile["azimuths_deg"], profile["elevations_deg"], period=360)
    earth_horizon = np.interp(earth_az, profile["azimuths_deg"], profile["elevations_deg"], period=360)
    # Native solar disk fractions retained. Between native samples these are
    # interpolated estimates, not newly computed SPICE/finite-disk solutions.
    fractions = np.clip(linear("sun_fraction"), 0, 1)
    native_indices = np.searchsorted(times, query).clip(0, len(times) - 1)
    native = np.isclose(times[native_indices], query, rtol=0, atol=0.001)
    earth_visible = earth_alt > earth_horizon
    earth_visible[native] = arrays["earth_visible"][native_indices[native]]
    points = []
    for i, timestamp in enumerate(query):
        points.append({"datetime": iso(timestamp), "timestamp": float(timestamp),
                       "sun_elevation": float(sun_alt[i]), "sun_azimuth": float(sun_az[i]),
                       "earth_elevation": float(earth_alt[i]), "earth_azimuth": float(earth_az[i]),
                       "sun_visible": bool(fractions[i] > 0), "earth_visible": bool(earth_visible[i]),
                       "solar_flux_pct": float(fractions[i] * 100),
                       "sun_visible_fraction": float(fractions[i]),
                       "sun_horizon": float(sun_horizon[i]), "earth_horizon": float(earth_horizon[i])})
    path = data_dir() / "series" / f"{site['id']}.npz"
    metadata = {"engine": "LUNANAV_PRECOMPUTED", "site_id": site["id"],
                "native_step_hours": float(arrays["step_h"]),
                "interpolated": bool(np.any(~native)),
                "sampling": "linear altitude/disk-fraction; unwrapped azimuth; periodic skyline; Earth center threshold between native samples",
                "terrain_source": str(arrays["terrain"]),
                "observer_height_m": profile["observer_height_m"],
                "coordinate_source": site["coordinate_source"],
                "coordinate_verified_upstream": site["coordinate_verified_upstream"],
                "series_sha256": digest(path),
                "horizons_sha256": digest(data_dir() / "horizons.json"),
                "solar_flux_definition": "visible solar disk percent; not electrical power or panel irradiance"}
    return points, metadata


def status():
    sites = []
    for site in catalog():
        try:
            arrays = load_series(site["id"])
            sites.append({k: v for k, v in site.items() if k != "profile"} | {
                "start_utc": iso(arrays["times"][0]), "end_utc": iso(arrays["times"][-1]),
                "native_step_hours": float(arrays["step_h"]), "terrain_source": str(arrays["terrain"])})
        except (ValueError, KeyError, OSError) as exc:
            sites.append({"id": site["id"], "error": str(exc)})
    return {"available": bool(sites), "data_dir": str(data_dir()), "sites": sites,
            "license": "LunaNav MIT, Copyright (c) 2026 yutuf; see backend/THIRD_PARTY_NOTICES.md",
            "verification": "Local artifact metadata only; upstream source claims not independently revalidated",
            "limits": "Exact catalog coordinates only. No DEM loaded. No extrapolation. Sub-hour samples are interpolation of hourly data."}
