#!/usr/bin/env python3
"""Cross-check real DE421 implementations; not independent astronomical truth.

Requires spiceypy, verified kernels, git reference, and the actual local generator.
No downloads, production edits, synthetic fallback, or copied Agent3 math helpers.
"""
import argparse
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import tempfile

import spiceypy as spice

PIN = "e241cee6d9f149767379a4891cb0344cf2a7d28d"
SOURCE = "src/features/visibility/registered-sky.py"
SITES = [(-80, 0), (-85, 45), (-89.5, 135), (-89.9, -90)]
TIMES = [f"{date}T{hour:02d}:00:00Z" for date in
         ("2000-01-01", "2009-04-01", "2018-08-01", "2026-01-01")
         for hour in (0, 6, 12, 18)]
# Fixed BEFORE evaluating outputs; engineering agreement, not model accuracy.
TOLERANCES = {"azDeg": 1e-8, "altDeg": 1e-8, "radiusDeg": 1e-8,
              "topocentricDistanceKm": 1e-5, "centerDistanceKm": 1e-5,
              "vectorComponentKm": 1e-5, "centerRadiusDeg": 1e-8}
SUN_RADIUS_KM = 695700.0


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args])


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def local_reference(position, lat_deg, lon_deg):
    """Independent explicit scalar NEU and atan2/hypot altitude."""
    lat, lon = math.radians(lat_deg), math.radians(lon_deg)
    sl, cl, so, co = math.sin(lat), math.cos(lat), math.sin(lon), math.cos(lon)
    r = (1737400.0 + 0.0 + 2.0) / 1000.0
    x, y, z = (position[0] - r * cl * co,
               position[1] - r * cl * so, position[2] - r * sl)
    north = -sl * co * x - sl * so * y + cl * z
    east = -so * x + co * y
    up = cl * co * x + cl * so * y + sl * z
    distance = math.hypot(x, y, z)
    return {"azDeg": math.degrees(math.atan2(east, north)) % 360,
            "altDeg": math.degrees(math.atan2(up, math.hypot(north, east))),
            "topocentricDistanceKm": distance,
            "radiusDeg": math.degrees(math.asin(SUN_RADIUS_KM / distance)),
            "horizontalFraction": math.hypot(north, east) / distance}


def run(args):
    if spice.ktotal("ALL"):
        raise ValueError("comparison requires isolated process with no preloaded SPICE kernels")
    root = Path(__file__).resolve().parents[4]
    kernels = Path(args.kernels_dir).resolve()
    queried = git(root, "rev-parse", "origin/feat/horizon-visibility").decode().strip()
    source = git(root, "show", f"{PIN}:{SOURCE}")
    manifest = json.loads(git(root, "show", f"{PIN}:data/kernels/manifest.json"))
    for entry in manifest["files"]:
        data = (kernels / entry["fileName"]).read_bytes()
        if len(data) != entry["bytes"] or hashlib.sha256(data).hexdigest() != entry["sha256"]:
            raise ValueError(f"pinned manifest mismatch: {entry['fileName']}")
    if json.loads((kernels / "manifest.json").read_text()) != manifest:
        raise ValueError("kernel manifest differs from pinned Agent3 manifest")
    generator_path = Path(args.generator).resolve() if args.generator else Path(__file__).with_name("generate_solar_vectors.py")
    sys.path.insert(0, str(generator_path.parent))
    generator = load_module("new_solar_generator_validation", generator_path)
    generated = generator.generate({"timesUtc": TIMES}, kernels_dir=kernels)
    with tempfile.TemporaryDirectory(prefix="solar-reference-", dir=args.temp_dir) as tmp:
        path = Path(tmp) / "registered_sky_reference.py"
        path.write_bytes(source)
        registered = load_module("registered_sky_reference", path)
        old_cwd = Path.cwd()
        direct_loaded = []
        try:
            # Unchanged Agent3 code, ASCII relative furnsh/unload filenames.
            os.chdir(kernels)
            actual = []
            for index, (lat, lon) in enumerate(SITES):
                actual.append(registered.generate({
                    "frame": "ME_DE421_LOCAL_NORTH_EAST", "scenarioId": "solar-validation",
                    "siteId": f"south-{index}", "latitudeDeg": lat, "longitudeDeg": lon,
                    "surfaceHeightM": 0, "observerHeightM": 2,
                    "terrainSha256": "0" * 64, "timesUtc": TIMES}, kernels_dir="."))
            # Separate direct position query, not Agent3's spkezr output.
            for entry in manifest["files"]:
                spice.furnsh(entry["fileName"])
                direct_loaded.append(entry["fileName"])
            rows, maxima = [], {key: 0.0 for key in TOLERANCES}
            for i, utc in enumerate(TIMES):
                position, _ = spice.spkpos("SUN", spice.str2et(utc), "MOON_ME_DE421", "NONE", "MOON")
                xyz = list(map(float, position))
                center_distance = math.hypot(*xyz)
                center_radius = math.degrees(math.asin(SUN_RADIUS_KM / center_distance))
                new_xyz = generated["sunPositionMoonFixedKm"][i]
                for site_index, (lat, lon) in enumerate(SITES):
                    reference = local_reference(xyz, lat, lon)
                    sky = actual[site_index]
                    observed = {"azDeg": sky["sunAzDeg"][i], "altDeg": sky["sunAltDeg"][i],
                                "radiusDeg": sky["sunRadiusDeg"][i]}
                    observed["topocentricDistanceKm"] = SUN_RADIUS_KM / math.sin(math.radians(observed["radiusDeg"]))
                    residual = {key: abs(observed[key] - reference[key]) for key in observed}
                    residual["azDeg"] = abs((observed["azDeg"] - reference["azDeg"] + 180) % 360 - 180)
                    residual["vectorComponentKm"] = max(abs(new_xyz[k] - xyz[j]) for j, k in enumerate(("x", "y", "z")))
                    residual["centerDistanceKm"] = abs(generated["sunDistanceKm"][i] - center_distance)
                    residual["centerRadiusDeg"] = abs(generated["sunAngularRadiusDeg"][i] - center_radius)
                    for key, value in residual.items():
                        maxima[key] = max(maxima[key], value)
                    rows.append({"utc": utc, "latitudeDeg": lat, "longitudeDeg": lon,
                                 "directSpiceMoonToSunKm": xyz, "centerDistanceKm": center_distance,
                                 "centerRadiusDeg": center_radius, "independentLocal": reference,
                                 "registeredActual": observed,
                                 "newGenerator": {"vectorKm": new_xyz, "centerDistanceKm": generated["sunDistanceKm"][i],
                                                  "centerRadiusDeg": generated["sunAngularRadiusDeg"][i]},
                                 "topocentricMinusCenterRadiusDeg": reference["radiusDeg"] - center_radius,
                                 "absoluteResiduals": residual})
        finally:
            try:
                for name in reversed(direct_loaded):
                    spice.unload(name)
            finally:
                os.chdir(old_cwd)
    output = {"description": "Real DE421 same-model independent implementation cross-validation; not independent astronomical truth",
              "sourcePin": PIN, "queriedOriginHorizonSha": queried, "registeredSourcePath": SOURCE,
              "registeredSourceSha256": hashlib.sha256(source).hexdigest(),
              "generatorPath": generator_path.relative_to(root).as_posix(),
              "generatorSourceSha256": hashlib.sha256(generator_path.read_bytes()).hexdigest(),
              "spiceypyVersion": spice.__version__, "kernelManifest": manifest,
              "tolerancesChosenBeforeEvaluation": TOLERANCES, "maximumAbsoluteResiduals": maxima,
              "passed": all(maxima[k] <= TOLERANCES[k] for k in maxima),
              "minimumHorizontalFraction": min(row["independentLocal"]["horizontalFraction"] for row in rows),
              "sampleCount": len(rows), "rawComparisons": rows,
              "actualRegisteredOutputs": actual, "actualNewGeneratorOutput": generated}
    destination = Path(args.output) if args.output else Path(__file__).parents[1] / "fixtures" / "de421-solar-validation.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(output, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({k: output[k] for k in ("passed", "sampleCount", "maximumAbsoluteResiduals", "minimumHorizontalFraction")}, indent=2))
    return 0 if output["passed"] else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kernels-dir", required=True)
    parser.add_argument("--generator", help="defaults to sibling generate_solar_vectors.py")
    parser.add_argument("--output", help="defaults to sibling ../fixtures/de421-solar-validation.json")
    parser.add_argument("--temp-dir", default=None, help="approved temporary directory")
    return run(parser.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
