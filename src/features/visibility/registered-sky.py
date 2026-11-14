#!/usr/bin/env python3
"""Generate a geometrically registered lunar SkySeries using SPICE DE421."""

import argparse
from datetime import datetime
import hashlib
import json
import math
from pathlib import Path
import re
import sys

import spiceypy as spice

MOON_RADIUS_M = 1_737_400.0
SUN_RADIUS_KM = 695_700.0
FRAME = "ME_DE421_LOCAL_NORTH_EAST"
BODY_FRAME = "MOON_ME_DE421"
REQUIRED_KERNELS = ("moon_080317.tf", "moon_pa_de421_1900-2050.bpc", "naif0012.tls", "de421.bsp")


def observer_radius_km(surface_height_m, observer_height_m):
    return (MOON_RADIUS_M + surface_height_m + observer_height_m) / 1000.0


def local_basis(latitude_deg, longitude_deg):
    lat, lon = math.radians(latitude_deg), math.radians(longitude_deg)
    north = (-math.sin(lat) * math.cos(lon), -math.sin(lat) * math.sin(lon), math.cos(lat))
    east = (-math.sin(lon), math.cos(lon), 0.0)
    up = (math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat))
    return north, east, up


def project_direction(target, observer, basis):
    vector = tuple(target[i] - observer[i] for i in range(3))
    distance = math.sqrt(sum(x * x for x in vector))
    if not math.isfinite(distance) or distance <= 0:
        raise ValueError("target direction has zero or invalid length")
    n, e, u = (sum(vector[i] * axis[i] for i in range(3)) for axis in basis)
    return math.degrees(math.atan2(e, n)) % 360.0, math.degrees(math.asin(max(-1.0, min(1.0, u / distance)))), distance


def validate_utc(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z", value):
        raise ValueError(f"UTC time must be RFC3339 UTC ending in Z: {value!r}")
    try:
        datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError as exc:
        raise ValueError(f"invalid UTC time: {value!r}") from exc
    return value


def parse_utc(value):
    return spice.str2et(validate_utc(value))


def _finite_number(request, name, minimum=None, maximum=None):
    value = request.get(name)
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{name} must be a finite number")
    if minimum is not None and value < minimum or maximum is not None and value > maximum:
        raise ValueError(f"{name} is outside the allowed range")
    return float(value)


def _required_text(request, name):
    value = request.get(name)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{name} must be a non-empty string")
    return value


def kernel_manifest_hashes(kernel_dir):
    manifest_path = kernel_dir / "manifest.json"
    if not manifest_path.is_file():
        raise ValueError(f"kernel manifest missing: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entries = manifest.get("files") if isinstance(manifest, dict) else None
    if not isinstance(entries, list):
        raise ValueError("kernel manifest files must be an array")
    if manifest.get("ephemeris") != "DE421":
        raise ValueError("kernel manifest ephemeris must be DE421")
    expected = {item.get("fileName"): item for item in entries if isinstance(item, dict)}
    hashes = {}
    for name in REQUIRED_KERNELS:
        item = expected.get(name)
        digest = item.get("sha256") if isinstance(item, dict) else None
        if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-fA-F]{64}", digest):
            raise ValueError(f"kernel manifest lacks SHA-256 for {name}")
        path = kernel_dir / name
        if not path.is_file():
            raise ValueError(f"required kernel missing: {path}")
        raw = path.read_bytes()
        if isinstance(item.get("bytes"), bool) or not isinstance(item.get("bytes"), int) or item["bytes"] != len(raw):
            raise ValueError(f"kernel size mismatch for {name}")
        actual = hashlib.sha256(raw).hexdigest()
        if actual.lower() != digest.lower():
            raise ValueError(f"kernel SHA-256 mismatch for {name}")
        hashes[name] = actual
    return hashes


def generate(request, kernels_dir=None):
    if not isinstance(request, dict):
        raise ValueError("request must be a JSON object")
    if request.get("frame") != FRAME:
        raise ValueError(f"frame must be {FRAME}")
    scenario_id = _required_text(request, "scenarioId")
    site_id = _required_text(request, "siteId")
    lat = _finite_number(request, "latitudeDeg", -90, 90)
    lon = _finite_number(request, "longitudeDeg", -180, 180)
    observer_height = _finite_number(request, "observerHeightM", 0)
    surface_height = _finite_number(request, "surfaceHeightM")
    terrain_hash = _required_text(request, "terrainSha256")
    if not re.fullmatch(r"[0-9a-fA-F]{64}", terrain_hash):
        raise ValueError("terrainSha256 must be a 64-character SHA-256")
    times = request.get("timesUtc")
    if not isinstance(times, list) or not times:
        raise ValueError("timesUtc must be a non-empty array")
    for item in times:
        validate_utc(item)
    if len(times) > 10_000:
        raise ValueError("timesUtc must contain at most 10000 entries")
    root = Path(__file__).resolve().parents[3]
    kernel_dir = Path(kernels_dir) if kernels_dir else Path(request.get("kernelsDir", root / "data" / "kernels"))
    hashes = kernel_manifest_hashes(kernel_dir)
    loaded = []
    try:
        for name in REQUIRED_KERNELS:
            spice.furnsh(str(kernel_dir / name))
            loaded.append(str(kernel_dir / name))
        ets = [parse_utc(item) for item in times]
        if any(b <= a for a, b in zip(ets, ets[1:])):
            raise ValueError("timesUtc must be strictly increasing")
        radius = observer_radius_km(surface_height, observer_height)
        if radius <= 0:
            raise ValueError("observer radius must be positive")
        basis = local_basis(lat, lon)
        observer = tuple(radius * component for component in basis[2])
        result = {key: [] for key in ("sunAzDeg", "sunAltDeg", "sunRadiusDeg", "earthAzDeg", "earthAltDeg")}
        for et in ets:
            sun_state, _ = spice.spkezr("SUN", et, BODY_FRAME, "NONE", "MOON")
            earth_state, _ = spice.spkezr("EARTH", et, BODY_FRAME, "NONE", "MOON")
            sun_az, sun_alt, sun_distance = project_direction(sun_state[:3], observer, basis)
            earth_az, earth_alt, _ = project_direction(earth_state[:3], observer, basis)
            result["sunAzDeg"].append(sun_az)
            result["sunAltDeg"].append(sun_alt)
            result["sunRadiusDeg"].append(math.degrees(math.asin(min(1.0, SUN_RADIUS_KM / sun_distance))))
            result["earthAzDeg"].append(earth_az)
            result["earthAltDeg"].append(earth_alt)
        return {
            "scenarioId": scenario_id, "timesUtc": times, **result,
            "quality": {"dataKind": "real", "model": "SPICE DE421 geometric positions; aberration correction NONE", "frame": FRAME, "warnings": []},
            "registration": {"siteId": site_id, "latitudeDeg": lat, "longitudeDeg": lon,
                "observerHeightM": observer_height, "surfaceHeightM": surface_height,
                "observerRadiusM": radius * 1000.0, "terrainSha256": terrain_hash.lower(),
                "bodyFixedFrame": BODY_FRAME, "localFrame": FRAME,
                "aberrationCorrection": "NONE", "kernelHashes": hashes},
        }
    finally:
        for kernel in reversed(loaded):
            spice.unload(kernel)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request", required=True, help="input JSON request")
    parser.add_argument("--output", required=True, help="output SkySeries JSON")
    args = parser.parse_args(argv)
    try:
        request = json.loads(Path(args.request).read_text(encoding="utf-8"))
        output = generate(request)
        Path(args.output).write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    except Exception as exc:
        print(f"registered-sky: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
