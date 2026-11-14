"""Sample local DSN Moon-centre elevation artifacts; no scheduling inference."""
from datetime import timezone
import math

import numpy as np
from dateutil.parser import isoparse
from fastapi import HTTPException
from pydantic import BaseModel, Field

from .reference_data import data_dir, digest, iso
from .science_router import load_npz, time_axis, coverage, unavailable


class WindowsRequest(BaseModel):
    start_utc: str
    end_utc: str
    step_seconds: int = Field(..., ge=60, le=86400)
    elevation_mask_deg: float = Field(..., ge=-90, le=90, allow_inf_nan=False)


def windows(q: WindowsRequest):
    try:
        dates = [isoparse(x) for x in (q.start_utc, q.end_utc)]
        if any(d.tzinfo is None or d.utcoffset().total_seconds() != 0 for d in dates):
            raise ValueError()
        start, end = [d.astimezone(timezone.utc).timestamp() for d in dates]
        if not math.isfinite(start) or not math.isfinite(end) or end < start:
            raise ValueError()
    except (ValueError, TypeError, OverflowError, OSError):
        raise HTTPException(422, detail="start_utc and end_utc must be ordered explicit UTC datetimes")
    count = math.floor((end - start) / q.step_seconds) + 1
    if count > 2000 or end - start > 31 * 86400:
        raise HTTPException(422, detail="Maximum 2000 samples and 31 days")
    dp, ep = data_dir() / 'dsn.npz', data_dir() / 'earth_distance.npz'
    a, b = load_npz(dp), load_npz(ep)
    t, kernel = time_axis(a, dp)
    dt, distance_kernel = time_axis(b, ep)
    try:
        names = a['stations']
        elev = np.asarray(a['moon_elevation_deg'], dtype=float)
        coords = np.asarray(a['station_coords'], dtype=float)
        if names.ndim != 1 or not len(names) or elev.shape != (len(names), len(t)) or coords.shape != (len(names), 3) or not np.isfinite(elev).all() or not np.isfinite(coords).all() or (np.abs(elev) > 90).any() or any(not isinstance(n, str) or not n for n in names.tolist()):
            raise ValueError()
    except (KeyError, TypeError, ValueError):
        unavailable(dp, 'Invalid DSN arrays')
    try:
        distance = np.asarray(b['earth_moon_km'], dtype=float)
        if distance.shape != dt.shape or not np.isfinite(distance).all() or not (distance > 0).all() or kernel != distance_kernel:
            raise ValueError()
    except (KeyError, TypeError, ValueError):
        unavailable(ep, 'Invalid distance array or mismatched ephemeris')
    for axis, path in ((t, dp), (dt, ep)):
        coverage(axis, start, path)
        coverage(axis, end, path)
    samples = start + np.arange(count) * q.step_seconds
    stations = []
    for name, row, coord in zip(names.tolist(), elev, coords):
        values = np.interp(samples, t, row)
        mask = values >= q.elevation_mask_deg
        runs = []
        first = None
        for i, visible in enumerate(mask):
            if visible and first is None:
                first = i
            if first is not None and (not visible or i == len(mask) - 1):
                last = i if visible else i - 1
                runs.append({'start_utc': iso(samples[first]), 'end_utc': iso(samples[last]), 'start_index': first, 'end_index': last})
                first = None
        stations.append({'name': name, 'lat': float(coord[0]), 'lon': float(coord[1]), 'height_m': float(coord[2]), 'moon_elevation_deg': values.tolist(), 'above_mask': mask.tolist(), 'sampled_windows': runs})
    return {'times_utc': [iso(x) for x in samples], 'step_seconds': q.step_seconds, 'elevation_mask_deg': q.elevation_mask_deg, 'stations': stations, 'earth_moon_km': np.interp(samples, dt, distance).tolist(), 'provenance': {'ephemeris': kernel, 'dsn_sha256': digest(dp), 'earth_distance_sha256': digest(ep), 'dsn_coverage': {'start_utc': iso(t[0]), 'end_utc': iso(t[-1])}, 'distance_coverage': {'start_utc': iso(dt[0]), 'end_utc': iso(dt[-1])}, 'interpolated': bool(not np.isin(samples, t).all() or not np.isin(samples, dt).all()), 'sampling': 'Linear interpolation; no extrapolation. Windows are inclusive sampled runs, not interpolated crossings.', 'frame': 'Moon centre apparent elevation at Earth DSN complexes, as described by local artifact adapter', 'limits': 'Not antenna availability, link budget, or lunar terrain visibility. Artifact metadata is not independent validation.'}}
