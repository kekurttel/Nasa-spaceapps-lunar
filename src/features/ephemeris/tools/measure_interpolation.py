#!/usr/bin/env python3
"""Measure hourly linear Moon-fixed vector interpolation against direct SPICE.

This is a scientific error measurement, not a TypeScript/runtime benchmark.
Requires spiceypy and numpy available on PYTHONPATH plus the same kernels used
for the real hourly vector fixture. No kernel downloads occur.
"""
from __future__ import annotations

import json
import math
import statistics
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "fixtures" / "real-moon-vectors.json"
OUTPUT = ROOT / "fixtures" / "interpolation-spice-report.json"
RADIUS_KM = 1737.4
SUN_RADIUS_KM = 695700.0
SITES = ((0.0, 0.0), (45.0, 30.0), (-89.5, 45.0))


def utc(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc)


def local(v, lat_deg, lon_deg):
    lat, lon = math.radians(lat_deg), math.radians(lon_deg)
    cl, sl, co, so = math.cos(lat), math.sin(lat), math.cos(lon), math.sin(lon)
    radius = RADIUS_KM + 0.002
    obs = (radius * cl * co, radius * cl * so, radius * sl)
    d = tuple(v[i] - obs[i] for i in range(3))
    north = -sl * co * d[0] - sl * so * d[1] + cl * d[2]
    east = -so * d[0] + co * d[1]
    up = cl * co * d[0] + cl * so * d[1] + sl * d[2]
    dist = math.hypot(*d)
    return ((math.degrees(math.atan2(up, math.hypot(north, east))) + 180) % 360 - 180,
            math.degrees(math.atan2(east, north)) % 360, dist)


def percentile(values, p):
    a = sorted(values)
    x = (len(a) - 1) * p
    lo = math.floor(x)
    return a[lo] + (a[min(lo + 1, len(a) - 1)] - a[lo]) * (x - lo)


def stats(values):
    return {"p50": percentile(values, .5), "p95": percentile(values, .95), "max": max(values)}


def main():
    import numpy as np
    import spiceypy as spice

    dataset = json.loads(FIXTURE.read_text(encoding="utf-8"))
    samples = dataset["samples"]
    if len(samples) != 25:
        raise ValueError(f"expected 25 hourly vectors, got {len(samples)}")
    times = [utc(s["timeUtc"]) for s in samples]
    if any(times[i + 1] - times[i] != timedelta(hours=1) for i in range(24)):
        raise ValueError("fixture timestamps must be contiguous hourly samples")
    vectors = {body: [np.array([s[key][axis] for axis in ("x", "y", "z")], dtype=float)
                       for s in samples]
               for body, key in (("SUN", "sunKm"), ("EARTH", "earthKm"))}
    if not all(np.isfinite(v).all() for body in vectors.values() for v in body):
        raise ValueError("fixture contains non-finite vector")

    import os
    # Derive the approved temp root from the active dependency path when present;
    # this avoids Windows console-codepage loss for non-ASCII user profile names.
    dep_root = next((Path(p).resolve().parent for p in sys.path
                     if (Path(p) / "spiceypy").is_dir()), None)
    candidates = list(Path("C:/Users").glob("*/AppData/Local/Temp/opencode"))
    discovered = next((p for p in candidates if (p / "kernels/lsk/naif0012.tls").is_file()), None)
    base = Path(os.environ["OPENCODE_TEMP"]) if os.environ.get("OPENCODE_TEMP") else (discovered or dep_root or Path.home() / "AppData/Local/Temp/opencode")
    # Resolve the discovered path using Python's filesystem encoding (the console
    # code page may have replaced non-ASCII characters in argv/environment).
    if discovered:
        base = discovered
    kernel_paths = [base / "kernels" / "spk" / "de440s.bsp",
                    base / "kernels" / "pck" / "pck00011.tpc",
                    base / "kernels" / "lsk" / "naif0012.tls"]
    for path in kernel_paths:
        if not path.is_file():
            raise FileNotFoundError(f"required kernel missing: {path}")

    records = []
    # CSPICE filenames are narrow strings on Windows: use ASCII relative paths.
    original_cwd = Path.cwd()
    try:
        os.chdir(base / 'kernels')
        spice.furnsh('lsk/naif0012.tls')
        spice.furnsh('spk/de440s.bsp')
        spice.furnsh('pck/pck00011.tpc')
    finally:
        os.chdir(original_cwd)
    try:
        for hour in range(24):
            for minute in range(5, 60, 5):
                t = times[hour] + timedelta(minutes=minute)
                fraction = minute / 60
                et = spice.str2et(t.strftime("%Y-%m-%dT%H:%M:%SZ"))
                ref_vectors = {body: np.asarray(spice.spkpos(body, et, "IAU_MOON", "NONE", "MOON")[0], dtype=float)
                               for body in ("SUN", "EARTH")}
                interp = {body: vectors[body][hour] * (1 - fraction) + vectors[body][hour + 1] * fraction
                          for body in ("SUN", "EARTH")}
                if not all(np.isfinite(v).all() for v in (*ref_vectors.values(), *interp.values())):
                    raise ValueError(f"non-finite vector at {t.isoformat()}")
                for lat, lon in SITES:
                    angular = {}
                    local_errors = {}
                    for body in ("SUN", "EARTH"):
                        chord = np.linalg.norm(interp[body] / np.linalg.norm(interp[body]) - ref_vectors[body] / np.linalg.norm(ref_vectors[body]))
                        angular[body] = math.degrees(2 * math.asin(min(1.0, float(chord) / 2)))
                        ia, iz, idist = local(interp[body], lat, lon)
                        ra, rz, rdist = local(ref_vectors[body], lat, lon)
                        azerr = abs((iz - rz + 180) % 360 - 180)
                        local_errors[body] = {"angleDeg": math.degrees(math.acos(max(-1.0, min(1.0, math.cos(math.radians(ia)) * math.cos(math.radians(ra)) * math.cos(math.radians(iz-rz)) + math.sin(math.radians(ia)) * math.sin(math.radians(ra)))))),
                                              "azimuthDeg": azerr, "altitudeDeg": abs(ia-ra),
                                              "interpolatedVectorKm": interp[body].tolist(),
                                              "referenceVectorKm": ref_vectors[body].tolist(),
                                              "interpolatedAltitudeDeg": ia, "referenceAltitudeDeg": ra,
                                              "interpolatedAzimuthDeg": iz, "referenceAzimuthDeg": rz}
                    sun_dist = local(interp["SUN"], lat, lon)[2]
                    sun_ref_dist = local(ref_vectors["SUN"], lat, lon)[2]
                    sun_radius_error = abs(math.degrees(math.asin(SUN_RADIUS_KM / sun_dist)) - math.degrees(math.asin(SUN_RADIUS_KM / sun_ref_dist)))
                    earth_dist = local(interp["EARTH"], lat, lon)[2]
                    earth_ref_dist = local(ref_vectors["EARTH"], lat, lon)[2]
                    earth_radius_error = abs(math.degrees(math.asin(RADIUS_KM / earth_dist)) - math.degrees(math.asin(RADIUS_KM / earth_ref_dist)))
                    records.append({"timeUtc": t.strftime("%Y-%m-%dT%H:%M:%SZ"), "site": {"latDeg": lat, "lonDeg": lon},
                                    "directionErrorDeg": angular, "local": local_errors,
                                    "sunRadiusErrorDeg": sun_radius_error, "earthRadiusErrorDeg": earth_radius_error})
    finally:
        spice.kclear()

    def worst_for(key):
        r = max(records, key=lambda x: x[key])
        return {"value": r[key], "timeUtc": r["timeUtc"], "site": r["site"], "record": r}

    all_angles = [r["directionErrorDeg"][b] for r in records for b in ("SUN", "EARTH")]
    local_angle = [r["local"][b]["angleDeg"] for r in records for b in ("SUN", "EARTH")]
    az = [r["local"][b]["azimuthDeg"] for r in records for b in ("SUN", "EARTH")]
    alt = [r["local"][b]["altitudeDeg"] for r in records for b in ("SUN", "EARTH")]
    sunrad = [r["sunRadiusErrorDeg"] for r in records]
    earthrad = [r["earthRadiusErrorDeg"] for r in records]
    midpoints = []
    for hour in range(24):
        idx = next(i for i, r in enumerate(records) if r["timeUtc"] == (times[hour] + timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%SZ") and r["site"] == {"latDeg": 0.0, "lonDeg": 0.0})
        midpoints.append({"hourUtc": times[hour].strftime("%Y-%m-%dT%H:%M:%SZ"),
                          "earthAngleErrorDeg": records[idx]["directionErrorDeg"]["EARTH"],
                          "sunAngleErrorDeg": records[idx]["directionErrorDeg"]["SUN"],
                          "largerErrorBody": max(("EARTH", "SUN"), key=lambda b: records[idx]["directionErrorDeg"][b])})
    report = {"method": {"fixture": "src/features/ephemeris/fixtures/real-moon-vectors.json", "fixtureId": dataset["id"],
                          "interpolation": "linear Cartesian vectors between hourly samples", "reference": "SPICE str2et + spkpos IAU_MOON NONE MOON",
                          "kernels": [p.name for p in kernel_paths], "samples": "24 intervals x minutes 5,10,...,55", "sites": [dict(latDeg=a, lonDeg=b) for a,b in SITES],
                          "observerRadiusKm": RADIUS_KM + .002, "refraction": "none", "performanceBenchmark": False},
              "sampleCount": len(records), "directionErrorDeg": stats(all_angles), "moonLocalDirectionErrorDeg": stats(local_angle),
              "azimuthErrorDeg": stats(az), "altitudeErrorDeg": stats(alt), "sunAngularRadiusErrorDeg": stats(sunrad),
              "earthAngularRadiusErrorDeg": stats(earthrad), "worst": {"moonFixedDirection": {"value": max(all_angles)},
              "localDirection": {"value": max(local_angle), "timeUtc": max(records, key=lambda r:max(x["angleDeg"] for x in r["local"].values()))["timeUtc"]},
              "sunRadius": worst_for("sunRadiusErrorDeg"), "earthRadius": worst_for("earthRadiusErrorDeg")},
              "hourMidpointCauseCheckEquator": midpoints, "rawSamples": records}
    # Replace the heterogeneous local worst entry with explicit worst az/alt records.
    worst_az = max(records, key=lambda r: max(r["local"][b]["azimuthDeg"] for b in ("SUN", "EARTH")))
    worst_alt = max(records, key=lambda r: max(r["local"][b]["altitudeDeg"] for b in ("SUN", "EARTH")))
    report["worst"]["azimuth"] = {"value": max(az), "record": worst_az}
    report["worst"]["altitude"] = {"value": max(alt), "record": worst_alt}
    report["acceptance"] = {"directionThresholdDeg": 0.1, "maximumDirectionErrorDeg": max(local_angle), "passed": max(local_angle) <= .1}
    OUTPUT.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "sampleCount": len(records), "directionErrorDeg": report["directionErrorDeg"],
                      "moonLocalDirectionErrorDeg": report["moonLocalDirectionErrorDeg"], "azimuthErrorDeg": report["azimuthErrorDeg"],
                      "altitudeErrorDeg": report["altitudeErrorDeg"], "sunAngularRadiusErrorDeg": report["sunAngularRadiusErrorDeg"],
                      "earthAngularRadiusErrorDeg": report["earthAngularRadiusErrorDeg"], "acceptance": report["acceptance"], "worst": report["worst"]}, indent=2))
    if not report["acceptance"]["passed"]:
        return 1
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"measure_interpolation: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise
