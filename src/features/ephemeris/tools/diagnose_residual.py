"""Controlled SPICE correction comparison against the Horizons surface references.

Usage: PYTHONPATH=<temp pydeps> py src/features/ephemeris/tools/diagnose_residual.py
Kernel paths follow fixtures/kernel-report.md's opencode temp kernel convention.
"""
import json
import math
import os
from pathlib import Path

import spiceypy as spice

ROOT = Path(__file__).resolve().parents[4]
FIXTURES = ROOT / "src/features/ephemeris/fixtures"
TEMP = Path(os.environ.get("OPENCODE_TEMP", Path.home() / "AppData/Local/Temp/opencode"))
KERNELS = TEMP / "kernels"
original_cwd = Path.cwd()
try:
    os.chdir(KERNELS)
    for relative in ("lsk/naif0012.tls", "pck/pck00011.tpc", "spk/de440s.bsp"):
        spice.furnsh(relative)
finally:
    os.chdir(original_cwd)

RAD = math.pi / 180
OBSERVER_RADIUS_KM = 1737.4 + 0.002

def unit(v):
    n = math.sqrt(sum(x*x for x in v))
    return tuple(x/n for x in v)

def local_sky(v, lat_deg, lon_deg):
    # IAU_MOON body-fixed vector to north/east/up ENU basis.
    lat, lon = lat_deg * RAD, lon_deg * RAD
    east = (-math.sin(lon), math.cos(lon), 0.0)
    north = (-math.sin(lat)*math.cos(lon), -math.sin(lat)*math.sin(lon), math.cos(lat))
    up = (math.cos(lat)*math.cos(lon), math.cos(lat)*math.sin(lon), math.sin(lat))
    e, n, u = (sum(a*b for a,b in zip(v,basis)) for basis in (east,north,up))
    return math.degrees(math.atan2(e,n)) % 360, math.degrees(math.atan2(u, math.hypot(e,n)))

def direction(az, alt):
    a, h = az*RAD, alt*RAD
    return (math.cos(h)*math.sin(a), math.cos(h)*math.cos(a), math.sin(h))

def sep(a, b):
    return math.degrees(math.atan2(math.sqrt(sum(x*x for x in (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]))), sum(x*y for x,y in zip(a,b))))

def circular_delta(a,b):
    return abs((a-b+180) % 360 - 180)

def summarize(rows):
    vals = sorted(r["directionResidualDeg"] for r in rows)
    az = [r["azimuthCircularResidualDeg"] for r in rows]
    return {"count":len(rows), "directionMaxDeg":max(vals), "directionMedianDeg":(vals[(len(vals)-1)//2]+vals[len(vals)//2])/2,
            "azimuthCircularMaxDeg":max(az)}

ref = json.loads((FIXTURES / "horizons-reference.json").read_text(encoding="utf-8"))
results = {}
for correction in ("NONE", "LT+S", "CN+S"):
    grouped = {"sun": [], "earth": []}
    for record in ref["records"]:
        body = record["body"]
        target = "SUN" if body == "sun" else "EARTH"
        lat, lon = record["site"]["latDeg"], record["site"]["lonDeg"]
        for row in record["table"].splitlines():
            fields = row.split(",")
            utc = fields[0].strip()
            et = spice.str2et(utc)
            pos, _ = spice.spkpos(target, et, "IAU_MOON", correction, "MOON")
            # Same spherical observer vector is subtracted from every correction result.
            la, lo = lat*RAD, lon*RAD
            observer = (OBSERVER_RADIUS_KM*math.cos(la)*math.cos(lo), OBSERVER_RADIUS_KM*math.cos(la)*math.sin(lo), OBSERVER_RADIUS_KM*math.sin(la))
            az, alt = local_sky(tuple(p-o for p,o in zip(pos,observer)), lat, lon)
            raz, ralt = float(fields[3]), float(fields[4])
            grouped[body].append({"site":record["site"], "utc":utc, "azimuthCircularResidualDeg":circular_delta(az,raz),
                "directionResidualDeg":sep(direction(az,alt), direction(raz,ralt)), "localAzimuthDeg":az,"localAltitudeDeg":alt,
                "referenceAzimuthDeg":raz,"referenceAltitudeDeg":ralt})
    results[correction] = {body:{**summarize(rows), "measurements":rows} for body,rows in grouped.items()}

# Include explicit reference-header context, not an inferred exact frame label.
headers = []
for r in ref["records"]:
    if not headers:
        raw = r.get("raw", "")
        headers = [line.strip() for line in raw.splitlines() if any(k in line for k in ("Target body name:", "Center body name:", "Center-site name:", "Center-site coordinates:", "Output units:", "Reference frame:"))]
report = {
    "method": {"kernelConvention":"%TEMP%/opencode/kernels (same kernels cited by fixtures/kernel-report.md)",
      "kernels":["naif0012.tls","pck00011.tpc","de440s.bsp"], "utcToEt":"spice.str2et for every row",
      "spkpos":"SUN/EARTH relative to MOON, IAU_MOON, each of NONE, LT+S, CN+S",
      "observer":"identical spherical body-fixed observer subtraction for every correction; radius 1737.4 + 0.002 km",
      "localConversion":"north/east/up projection then atan2 azimuth and altitude",
      "reference":"78 Horizons airless apparent measurements; raw response headers retained below"},
    "horizonsHeaders":headers,
    "results":results,
    "limitations":["This is a controlled correction-only comparison, not an exact reproduction of Horizons apparent surface-observer processing.",
      "The observer vector is spherical and correction is applied at the Moon center before the same observer subtraction; it is not a fully retarded/aberrated observer-site apparent direction.",
      "The Horizons raw header identifies DE441 and the site/target; it does not establish an explicit lunar-fixed frame name in the inspected header. IAU_MOON residual may therefore include frame, kernel, site-model and other pipeline differences; no single cause is asserted."],
    "interpretation":"Compare CN+S summaries with NONE to quantify whether corrections reduce baseline Sun bias; residual after corrections is not uniquely attributable to frame without a matched-frame experiment."
}
(FIXTURES / "residual-diagnosis.json").write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8")
print(json.dumps({k:{b:{x:y for x,y in v[b].items() if x!="measurements"} for b in v} for k,v in results.items()}, indent=2))
spice.kclear()
