#!/usr/bin/env python3
"""Diagnostic hourly-vector interpolation coverage check against direct SPICE."""
from __future__ import annotations

import json
import math
import os
import statistics
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "fixtures" / "date-coverage-report.json"
RADIUS_KM = 1737.4
SUN_RADIUS_KM = 695700.0
SITES = ((0.0, 0.0), (45.0, 30.0), (-89.5, 45.0), (0.0, 180.0))
DATES = [datetime(2026, month, 1, tzinfo=timezone.utc) for month in range(1, 13)] + [
    datetime(year, 1, 1, tzinfo=timezone.utc) for year in (2027, 2028)]


def utc_text(value):
    return value.strftime("%Y-%m-%dT%H:%M:%SZ")


def local(vector, lat_deg, lon_deg):
    lat, lon = math.radians(lat_deg), math.radians(lon_deg)
    sl, cl, so, co = math.sin(lat), math.cos(lat), math.sin(lon), math.cos(lon)
    obs = ((RADIUS_KM + .002) * cl * co, (RADIUS_KM + .002) * cl * so,
           (RADIUS_KM + .002) * sl)
    x, y, z = (vector[i] - obs[i] for i in range(3))
    north, east, up = -sl * co * x - sl * so * y + cl * z, -so * x + co * y, cl * co * x + cl * so * y + sl * z
    return math.degrees(math.atan2(up, math.hypot(north, east))), math.degrees(math.atan2(east, north)) % 360, math.hypot(x, y, z)


def percentile(values, fraction):
    ordered = sorted(values)
    pos = (len(ordered) - 1) * fraction
    low = math.floor(pos)
    return ordered[low] + (ordered[min(low + 1, len(ordered) - 1)] - ordered[low]) * (pos - low)


def stats(values):
    return {"p50": percentile(values, .5), "p95": percentile(values, .95), "max": max(values)}


def main():
    import numpy as np
    import spiceypy as spice

    dep_root = next((Path(p).resolve().parent for p in sys.path if (Path(p) / "spiceypy").is_dir()), None)
    candidates = list(Path("C:/Users").glob("*/AppData/Local/Temp/opencode"))
    discovered = next((p for p in candidates if (p / "kernels/lsk/naif0012.tls").is_file()), None)
    base = discovered or dep_root or Path.home() / "AppData/Local/Temp/opencode"
    kernels = ("lsk/naif0012.tls", "spk/de440s.bsp", "pck/pck00011.tpc")
    for kernel in kernels:
        if not (base / "kernels" / kernel).is_file():
            raise FileNotFoundError(f"required kernel missing: {base / 'kernels' / kernel}")

    os.chdir(base / "kernels")
    try:
        for kernel in kernels:
            spice.furnsh(kernel)
        dates_report = []
        for date in DATES:
            vectors = {body: [] for body in ("SUN", "EARTH")}
            for hour in range(25):
                stamp = date + timedelta(hours=hour)
                et = spice.str2et(utc_text(stamp))
                for body in vectors:
                    vector = np.asarray(spice.spkpos(body, et, "IAU_MOON", "NONE", "MOON")[0], dtype=float)
                    if vector.shape != (3,) or not np.isfinite(vector).all() or not np.linalg.norm(vector) > 0:
                        raise ValueError(f"invalid {body} source vector at {utc_text(stamp)}")
                    vectors[body].append(vector)
            records = []
            for hour in range(24):
                for minute in (15, 30, 45):
                    stamp = date + timedelta(hours=hour, minutes=minute)
                    et = spice.str2et(utc_text(stamp))
                    ref = {body: np.asarray(spice.spkpos(body, et, "IAU_MOON", "NONE", "MOON")[0], dtype=float) for body in vectors}
                    interp = {body: vectors[body][hour] * (1 - minute / 60) + vectors[body][hour + 1] * minute / 60 for body in vectors}
                    if not all(np.isfinite(v).all() and np.linalg.norm(v) > 0 for v in (*ref.values(), *interp.values())):
                        raise ValueError(f"invalid comparison vector at {utc_text(stamp)}")
                    for lat, lon in SITES:
                        errors = {}
                        local_err = {}
                        radii = {}
                        for body in vectors:
                            u, v = interp[body] / np.linalg.norm(interp[body]), ref[body] / np.linalg.norm(ref[body])
                            chord = float(np.linalg.norm(u - v))
                            errors[body] = math.degrees(2 * math.asin(min(1., chord / 2)))
                            ia, iz, di = local(interp[body], lat, lon)
                            ra, rz, dr = local(ref[body], lat, lon)
                            dot = math.sin(math.radians(ia)) * math.sin(math.radians(ra)) + math.cos(math.radians(ia)) * math.cos(math.radians(ra)) * math.cos(math.radians(iz-rz))
                            local_err[body] = math.degrees(math.acos(max(-1., min(1., dot))))
                            radius = SUN_RADIUS_KM if body == "SUN" else RADIUS_KM
                            radii[body] = abs(math.degrees(math.asin(min(1., radius / di))) - math.degrees(math.asin(min(1., radius / dr))))
                        records.append({"timeUtc": utc_text(stamp), "site": {"latDeg": lat, "lonDeg": lon}, "directionErrorDeg": errors, "localDirectionErrorDeg": local_err, "angularRadiusErrorDeg": radii})
            series = {name: [r[key][body] for r in records for body in ("SUN", "EARTH")] for name, key in (("vectorDirection", "directionErrorDeg"), ("localTopocentricDirection", "localDirectionErrorDeg"), ("angularRadius", "angularRadiusErrorDeg"))}
            worst = max(records, key=lambda r: max(r["localDirectionErrorDeg"].values()))
            max_error = max(series["localTopocentricDirection"])
            dates_report.append({"dateUtc": utc_text(date), "sourceSampleCount": 25, "comparisonCount": len(records), "sampleCadence": "hourly source; 15-minute subdivisions exact-reference comparison", "errorsDeg": {key: stats(values) for key, values in series.items()}, "worstLocalDirection": {"timeUtc": worst["timeUtc"], "body": max(worst["localDirectionErrorDeg"], key=worst["localDirectionErrorDeg"].get), "site": worst["site"], "errorDeg": max_error}, "acceptance": {"thresholdDeg": .1, "measuredMaxLocalDirectionErrorDeg": max_error, "passed": max_error <= .1}})
        report = {"kind": "diagnostic-only", "independentSourceClaim": False, "method": {"reference": "SPICE spkpos geometric vectors; IAU_MOON, observer MOON", "kernels": list(kernels), "dates": [utc_text(d)[:10] for d in DATES], "sites": [{"latDeg": a, "lonDeg": b} for a, b in SITES], "samplesPerDate": 25, "comparisonTimesPerDate": 72, "observerRadiusKm": RADIUS_KM + .002, "refraction": "none"}, "dateCount": len(dates_report), "dates": dates_report}
        OUTPUT.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
        print(json.dumps({"output": str(OUTPUT), "dateCount": len(dates_report), "allPassed": all(d["acceptance"]["passed"] for d in dates_report), "dates": [{"dateUtc": d["dateUtc"], "maxErrorDeg": d["acceptance"]["measuredMaxLocalDirectionErrorDeg"], "passed": d["acceptance"]["passed"]} for d in dates_report]}, indent=2))
        return 0 if all(d["acceptance"]["passed"] for d in dates_report) else 1
    finally:
        spice.kclear()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"measure_date_coverage: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise
