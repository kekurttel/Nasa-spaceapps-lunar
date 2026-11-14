"""Bounded NumPy adaptation of LunaNav web/src/engine.ts and model.ts.

MIT License
Copyright (c) 2026 yutuf

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""
import json
import os
import struct
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

import numpy as np
from dateutil.parser import isoparse
from pydantic import BaseModel, ConfigDict, Field

from .data_paths import web_data_dir

MAX_WORK = 32_000_000
LIMITS = [
    "South-pole atlas grid only; no arbitrary-coordinate terrain reconstruction.",
    "Hourly samples; shadow and communication runs are sample counts, not continuous event times.",
    "Sun percent counts hours with >=50% visible solar disk, not mean irradiance.",
    "Earth visibility uses Earth center above terrain; no relay or RF link budget.",
    "Optional DSN mask is geometric visibility only, not antenna scheduling or availability.",
    "Simplified battery model omits temperature, panel orientation, degradation and thermal survival.",
    "Local precomputed artifacts; upstream provenance claims not independently revalidated. Not flight certification.",
]


class MissionSearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    start_date: str = "2026-11-01"
    duration_days: float = Field(default=14, gt=0, le=30)
    max_dark_hours: float = Field(default=48, ge=0, le=720)
    min_sun_pct: float = Field(default=70, ge=0, le=100)
    min_earth_pct: float = Field(default=50, ge=0, le=100)
    max_slope_deg: float = Field(default=15, ge=0, le=90)
    limit: int = Field(default=20, ge=1, le=100)
    n_starts: int = Field(default=1, ge=1, le=31)
    stride_hours: int = Field(default=24, ge=1, le=168)
    need_dsn: bool = False
    include_infeasible: bool = False
    array_peak_w: float = Field(default=400, ge=0, le=1000000)
    load_w: float = Field(default=150, ge=0, le=1000000)
    battery_wh: float = Field(default=2000, gt=0, le=1000000000)
    initial_soc: float = Field(default=1, ge=0, le=1)
    charge_eff: float = Field(default=.95, gt=0, le=1)
    discharge_eff: float = Field(default=.95, gt=0, le=1)
    min_soc: float = Field(default=.2, ge=0, lt=1)


def data_root():
    return web_data_dir()


def iso(timestamp):
    return datetime.fromtimestamp(timestamp, timezone.utc).isoformat().replace("+00:00", "Z")


@lru_cache(maxsize=2)
def _load(root):
    root = Path(root)
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    raw = (root / "atlas.bin").read_bytes()
    n, naz, spacing, radius = struct.unpack_from("<IHff", raw)
    if not 0 < n <= 100000 or not 1 < naz <= 720 or len(raw) != 14 + n * (7 + naz):
        raise ValueError("Invalid atlas layout")
    x, y, height = [np.frombuffer(raw, dtype="<i2", count=n, offset=14 + k * n * 2) for k in range(3)]
    slope = np.frombuffer(raw, dtype="u1", count=n, offset=14 + 6*n).astype(float) / 4
    horizon = np.frombuffer(raw, dtype="u1", offset=14 + 7*n).reshape(n, naz)
    count = manifest["n"]
    ephem = np.fromfile(root / "ephem.bin", dtype="<f4")
    if ephem.size != 7 * count or manifest["step_h"] != 1:
        raise ValueError("Invalid hourly ephemeris layout")
    ephem = ephem.reshape(7, count).astype(float)
    if not np.all(np.isfinite(ephem)) or np.any(ephem[6] <= 0):
        raise ValueError("Invalid ephemeris values")
    dsn_path = root / manifest["dsn"]
    dsn = np.fromfile(dsn_path, dtype="u1") if dsn_path.is_file() else None
    if dsn is not None and (dsn.size != count or not np.all(dsn <= 1)):
        raise ValueError("Invalid DSN mask")
    lat = -90 + np.degrees(2 * np.arctan(np.hypot(x / 10., y / 10.) / (2 * 1737.4)))
    lon = np.degrees(np.arctan2(x.astype(float), y.astype(float)))
    la, lo = np.radians(lat), np.radians(lon)
    east = np.stack((-np.sin(lo), np.cos(lo), np.zeros(n)), axis=1)
    north = np.stack((-np.sin(la)*np.cos(lo), -np.sin(la)*np.sin(lo), np.cos(la)), axis=1)
    up = np.stack((np.cos(la)*np.cos(lo), np.cos(la)*np.sin(lo), np.sin(la)), axis=1)
    return dict(n=n, naz=naz, spacing=spacing, radius=radius, height=height, slope=slope,
                horizon=horizon, lat=lat, lon=lon, east=east, north=north, up=up,
                ephem=ephem, dsn=dsn, manifest=manifest)


def load_data():
    return _load(str(data_root().resolve()))


def capabilities():
    d = load_data()
    m = d["manifest"]
    return {"available": True, "engine": "LUNANAV_ATLAS_HOURLY", "atlas_points": d["n"],
            "spacing_m": d["spacing"], "horizon_azimuth_bins": d["naz"],
            "horizon_quantization_deg": .1, "slope_quantization_deg": .25,
            "start_utc": iso(m["start_unix"]), "end_exclusive_utc": iso(m["start_unix"] + m["n"]*3600),
            "step_hours": 1, "dsn_geometric_available": d["dsn"] is not None,
            "max_work_units": MAX_WORK, "max_duration_days": 30, "max_results": 100,
            "limits": LIMITS, "license": "MIT; Copyright (c) 2026 yutuf",
            "reference": "lmNasa-main/web/src/engine.ts; model.ts"}


def point_sky(d, indices, first, hours, need_dsn=False):
    """Reference pointSky, vectorized over points; bounded batch allocated by caller."""
    indices = np.asarray(indices)
    up, east, north = (d[k][indices] for k in ("up", "east", "north"))
    horizon = d["horizon"][indices]
    rows = np.arange(len(indices))
    def hz(az):
        p = (az % 360) / (360 / d["naz"])
        i = np.floor(p).astype(int) % d["naz"]
        f = p - np.floor(p)
        a = horizon[rows, i].astype(float) / 10 - 8
        b = horizon[rows, (i+1) % d["naz"]].astype(float) / 10 - 8
        return a + (b-a)*f
    sun, earth = np.empty((len(indices), hours)), np.empty((len(indices), hours), dtype=bool)
    for k in range(hours):
        h = first + k
        s = d["ephem"][:3, h]
        alt = np.degrees(np.arcsin(np.clip(np.sum(up*s, axis=1), -1, 1)))
        az = np.degrees(np.arctan2(np.sum(east*s, axis=1), np.sum(north*s, axis=1)))
        disk = np.clip((alt-hz(az))/d["ephem"][6, h], -1, 1)
        sun[:, k] = (np.arccos(-disk) + disk*np.sqrt(1-disk*disk))/np.pi
        delta = d["ephem"][3:6, h] - 1737.4*up
        alt = np.degrees(np.arcsin(np.clip(np.sum(delta*up, axis=1)/np.linalg.norm(delta, axis=1), -1, 1)))
        az = np.degrees(np.arctan2(np.sum(delta*east, axis=1), np.sum(delta*north, axis=1)))
        earth[:, k] = (alt > hz(az)) & (not need_dsn or bool(d["dsn"][h]))
    return sun, earth


def evaluate_windows(sun, earth, q):
    """Reference evaluateWindow, fixed reference weights (0.4, 0.3, 0.3)."""
    count, hours = sun.shape
    sf, ef = (sun >= .5).mean(axis=1), earth.mean(axis=1)
    dark, dark_run, gap, gap_run = (np.zeros(count, dtype=int) for _ in range(4))
    energy = np.full(count, q.initial_soc*q.battery_wh)
    minimum = np.full(count, np.inf)
    for h in range(hours):
        dark_run = np.where(sun[:, h] < .5, dark_run+1, 0)
        gap_run = np.where(~earth[:, h], gap_run+1, 0)
        dark, gap = np.maximum(dark, dark_run), np.maximum(gap, gap_run)
        net = q.array_peak_w*sun[:, h]-q.load_w
        energy = np.clip(energy + np.where(net > 0, net*q.charge_eff, net/q.discharge_eff), 0, q.battery_wh)
        minimum = np.minimum(minimum, energy/q.battery_wh)
    survived = minimum >= q.min_soc
    go = (sf >= q.min_sun_pct/100) & (ef >= q.min_earth_pct/100) & (dark <= q.max_dark_hours) & survived
    margin = np.clip((minimum-q.min_soc)/(1-q.min_soc), 0, 1)
    score = np.round(100*(.4*sf+.3*ef+.3*margin)*np.where(go, 1, .25), 1)
    return dict(sun=sf, earth=ef, dark=dark, gap=gap, min_soc=minimum, survived=survived, go=go, score=score)


def search(q):
    d = load_data()
    try:
        dt = isoparse(q.start_date)
    except (ValueError, TypeError) as exc:
        raise ValueError("start_date must be ISO date or datetime") from exc
    dt = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
    offset = (dt.timestamp()-d["manifest"]["start_unix"])/3600
    duration = q.duration_days*24
    if abs(offset-round(offset)) > 1e-8 or abs(duration-round(duration)) > 1e-8:
        raise ValueError("start_date and duration_days must align to whole UTC hours")
    first, duration = round(offset), round(duration)
    span = (q.n_starts-1)*q.stride_hours + duration
    if duration < 1 or first < 0 or first+span > d["manifest"]["n"]:
        raise ValueError("Requested mission windows exceed hourly ephemeris coverage")
    if q.need_dsn and d["dsn"] is None:
        raise ValueError("DSN geometric mask unavailable")
    indices = np.flatnonzero(d["slope"] <= q.max_slope_deg)
    work = len(indices)*(span + q.n_starts*duration)
    if work > MAX_WORK or span > 1440:
        raise ValueError(f"Request exceeds CPU budget ({MAX_WORK} work units, 1440-hour span); reduce duration, n_starts or slope threshold")
    results, feasible_windows, feasible_points = [], 0, 0
    for a in range(0, len(indices), 512):
        ids = indices[a:a+512]
        sun, earth = point_sky(d, ids, first, span, q.need_dsn)
        best, best_start = None, np.zeros(len(ids), dtype=int)
        go_count = np.zeros(len(ids), dtype=int)
        for s in range(q.n_starts):
            start = s*q.stride_hours
            w = evaluate_windows(sun[:, start:start+duration], earth[:, start:start+duration], q)
            go_count += w["go"]
            if best is None:
                best = {k: v.copy() for k, v in w.items()}
            else:
                better = w["score"] > best["score"]
                best_start[better] = s
                for k in best:
                    best[k][better] = w[k][better]
        feasible_windows += int(go_count.sum())
        feasible_points += int(np.count_nonzero(go_count))
        for j, index in enumerate(ids):
            if not q.include_infeasible and not best["go"][j]:
                continue
            reasons = []
            if best["sun"][j] < q.min_sun_pct/100: reasons.append("sun")
            if best["earth"][j] < q.min_earth_pct/100: reasons.append("earth")
            if best["dark"][j] > q.max_dark_hours: reasons.append("shadow")
            if not best["survived"][j]: reasons.append("battery")
            results.append({"index": int(index), "lat": float(d["lat"][index]), "lon": float(d["lon"][index]),
                            "elevation_m": int(d["height"][index]), "slope_deg": float(d["slope"][index]),
                            "score": float(best["score"][j]), "go": bool(best["go"][j]), "reasons": reasons,
                            "go_count": int(go_count[j]), "best_start_index": int(best_start[j]),
                            "start_utc": iso(dt.timestamp()+int(best_start[j])*q.stride_hours*3600),
                            "sun_pct": float(best["sun"][j]*100), "earth_pct": float(best["earth"][j]*100),
                            "longest_dark_hours": int(best["dark"][j]), "longest_comm_gap_hours": int(best["gap"][j]),
                            "min_soc": float(best["min_soc"][j]), "battery_survived": bool(best["survived"][j])})
        results.sort(key=lambda r: (-r["score"], r["index"]))
        del results[q.limit:]
    return {"results": results, "atlas_points": d["n"], "evaluated_points": len(indices),
            "evaluated_windows": len(indices)*q.n_starts, "feasible_points": feasible_points,
            "feasible_windows": feasible_windows, "work_units": work, "duration_hours": duration,
            "request": q.model_dump(), "engine": "LUNANAV_ATLAS_HOURLY", "step_hours": 1,
            "ranking": "Reference score descending, atlas index ascending; earliest start wins score ties",
            "score_weights": {"sun": .4, "earth": .3, "battery_margin": .3},
            "limits": LIMITS, "license": "MIT; Copyright (c) 2026 yutuf"}
