#!/usr/bin/env python3
"""Generate real, geometric Moon-center-to-Sun DE421 vectors (no interpolation)."""
import argparse
from datetime import datetime
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile

import spiceypy as spice
from solar_coverage import FRAME, contains, kernel_context, measure_loaded

SUN_RADIUS_KM = 695700.0
MAX_TIMES = 100000


def validate_utc(value):
    """Strict UTC seconds, optional 1–3 decimals; calendar errors/leap seconds rejected."""
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,3})?Z", value):
        raise ValueError(f"expected explicit UTC seconds ending Z (0–3 decimals): {value!r}")
    try:
        datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError as exc:
        raise ValueError(f"invalid calendar time (leap seconds not accepted): {value!r}") from exc
    return value


def validate_request(request):
    if not isinstance(request, dict):
        raise ValueError("request must be an object")
    fixed = {"frame": FRAME, "ephemerisKernel": "DE421", "aberrationCorrection": "NONE", "origin": "MOON", "direction": "MOON_TO_SUN", "units": "km", "dataKind": "real", "schemaVersion": "1.0.0"}
    if set(request) - (set(fixed) | {"timesUtc", "kernelsDir"}):
        raise ValueError("unknown request fields; check contract spelling")
    for key, expected in fixed.items():
        if key in request and request[key] != expected:
            raise ValueError(f"{key} must be {expected}")
    times = request.get("timesUtc")
    if not isinstance(times, list) or not 1 <= len(times) <= MAX_TIMES:
        raise ValueError(f"timesUtc must contain 1–{MAX_TIMES} explicit timestamps per chunk")
    times = [validate_utc(t) for t in times]
    dates = [datetime.fromisoformat(t[:-1] + "+00:00") for t in times]
    if any(b <= a for a, b in zip(dates, dates[1:])):
        raise ValueError("timesUtc must be strictly increasing without duplicates")
    return times


def generate(request, kernels_dir=None):
    """Return schema 1.0.0 solar series; raises rather than extrapolating/partial output.

    Caller must serialize SPICE/cwd use (see solar_coverage.kernel_context).
    """
    times = validate_request(request)
    directory = kernels_dir if kernels_dir is not None else request.get("kernelsDir")
    if directory is None:
        directory = Path(__file__).resolve().parents[4] / "data" / "kernels"
    with kernel_context(directory) as sources:
        report = measure_loaded(sources)
        ets = [float(spice.str2et(t)) for t in times]
        windows = report["conservativeUtcIntervals"]
        # A series must fit one interval: no gaps may be hidden in coverage metadata.
        containing = [w for w in windows if all(spice.str2et(w["startUtc"]) <= et <= spice.str2et(w["endUtc"]) for et in (ets[0], ets[-1]))]
        if not containing or any(not contains(report["effectiveCoverageEt"], et) for et in ets):
            raise ValueError("requested times outside conservative common SPK/PCK coverage")
        if any(b <= a for a, b in zip(ets, ets[1:])):
            raise ValueError("timesUtc must resolve to strictly increasing SPICE epochs")
        vectors, distances, radii = [], [], []
        for et in ets:
            state, _ = spice.spkezr("SUN", et, FRAME, "NONE", "MOON")
            xyz = [float(v) for v in state[:3]]
            distance = math.hypot(*xyz)
            if not all(math.isfinite(v) for v in xyz) or not math.isfinite(distance) or not 130e6 <= distance <= 170e6:
                raise ValueError("invalid SPICE Sun vector/distance")
            vectors.append(dict(zip(("x", "y", "z"), xyz)))
            distances.append(distance)
            radii.append(math.degrees(math.asin(SUN_RADIUS_KM / distance)))
        interval = containing[0]
        return {"schemaVersion": "1.0.0", "timesUtc": times, "sunPositionMoonFixedKm": vectors, "sunDistanceKm": distances, "sunAngularRadiusDeg": radii, "frame": FRAME, "ephemerisKernel": "DE421", "aberrationCorrection": "NONE", "dataKind": "real", "origin": "MOON", "direction": "MOON_TO_SUN", "units": "km", "source": {"name": "NASA/JPL NAIF DE421 SPICE kernels", "url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/", "kernelHashes": {s["fileName"]: s["sha256"] for s in sources}}, "coverage": {"startUtc": interval["startUtc"], "endUtc": interval["endUtc"]}, "warnings": ["Geometric Moon-center vectors; not observer/topocentric directions or apparent positions.", "UTC conversion uses naif0012.tls; future leap seconds are not predicted and pre-1972 UTC uses LSK extrapolation, not validated historical clocks."], "numericalLimitations": ["IEEE-754 double precision SPICE evaluation; no interpolation, extrapolation, or fallback data.", "Solar angular radius uses a fixed 695700 km photospheric radius and Moon-center distance."]}


def atomic_write_json(path, payload):
    """Unique same-directory staging file; failed generation never damages old output."""
    path = Path(path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, prefix=f".{path.name}.", suffix=".tmp", delete=False) as stream:
            temporary = Path(stream.name)
            json.dump(payload, stream, indent=2, allow_nan=False)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--kernels-dir")
    args = parser.parse_args(argv)
    try:
        request = json.loads(Path(args.request).read_text(encoding="utf-8"))
        atomic_write_json(args.output, generate(request, args.kernels_dir))
    except Exception as exc:
        print(f"generate-solar-vectors: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
