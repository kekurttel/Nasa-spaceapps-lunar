#!/usr/bin/env python3
"""Export geometric Sun/Earth vectors relative to the Moon in IAU_MOON.

Requires spiceypy and explicitly supplied SPICE kernels (including suitable
leap-second, ephemeris, and lunar orientation/PCK kernels). No downloads occur.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Sequence

SOURCE_URL = "https://naif.jpl.nasa.gov/naif/"


class ExportError(Exception):
    """An actionable input, dependency, kernel, or coverage error."""


def parse_utc(value: str, label: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value[:-1] + "+00:00" if value.endswith("Z") else value)
    except ValueError as exc:
        raise ExportError(f"{label} must be an ISO-8601 UTC timestamp (for example 2030-01-01T00:00:00Z)") from exc
    if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
        raise ExportError(f"{label} must include an explicit UTC timezone (Z or +00:00)")
    return parsed.astimezone(timezone.utc)


def iso_utc(value: datetime) -> str:
    rendered = value.strftime("%Y-%m-%dT%H:%M:%S")
    if value.microsecond:
        rendered += "." + f"{value.microsecond:06d}".rstrip("0")
    return rendered + "Z"


def digest_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def generate(kernels: Sequence[Path], start: datetime, end: datetime, step_seconds: float, output: Path) -> None:
    if end <= start:
        raise ExportError("--end-utc must be later than --start-utc")
    if not math.isfinite(step_seconds) or step_seconds <= 0:
        raise ExportError("--step-seconds must be a finite number greater than zero")
    if not kernels:
        raise ExportError("provide at least one kernel using --kernels")
    resolved: list[Path] = []
    for kernel in kernels:
        path = kernel.expanduser().resolve()
        if not path.is_file():
            raise ExportError(f"kernel file does not exist or is not a file: {kernel}")
        resolved.append(path)
    if output.resolve() in resolved:
        raise ExportError("output path must not overwrite a kernel file")
    try:
        import spiceypy as spice
    except ImportError as exc:
        raise ExportError("missing dependency: install spiceypy (for example: py -m pip install spiceypy)") from exc

    loaded: list[Path] = []
    try:
        for kernel in resolved:
            try:
                spice.furnsh(str(kernel))
            except Exception as exc:
                raise ExportError(f"could not load kernel {kernel}: {exc}") from exc
            loaded.append(kernel)
        samples = []
        current = start
        while current <= end:
            utc_text = iso_utc(current)
            try:
                et = spice.str2et(utc_text)
                sun = spice.spkpos("SUN", et, "IAU_MOON", "NONE", "MOON")[0]
                earth = spice.spkpos("EARTH", et, "IAU_MOON", "NONE", "MOON")[0]
            except Exception as exc:
                raise ExportError(f"SPICE coverage/conversion failed at {utc_text}; check loaded LSK, SPK, and lunar PCK kernels: {exc}") from exc
            samples.append({"timeUtc": utc_text, "sunKm": dict(zip(("x", "y", "z"), map(float, sun))),
                            "earthKm": dict(zip(("x", "y", "z"), map(float, earth)))})
            current += timedelta(seconds=step_seconds)
        if len(samples) < 2:
            raise ExportError("requested interval produces fewer than two samples; use a shorter step or longer interval")
        dataset = {
            "id": "spice-iau-moon-geometric-vectors",
            "frame": "IAU_MOON",
            "source": "NASA/JPL NAIF SPICE kernels (user supplied)",
            "sourceUrl": SOURCE_URL,
            "timeScale": "UTC",
            "corrections": "geometric",
            "dataKind": "real",
            "kernels": [{"file": path.name, "sha256": digest_file(path)} for path in resolved],
            "settings": {"startUtc": iso_utc(start), "endUtc": iso_utc(end), "stepSeconds": step_seconds,
                         "frame": "IAU_MOON", "observer": "MOON", "aberration": "NONE"},
            "samples": samples,
        }
        output.parent.mkdir(parents=True, exist_ok=True)
        # Write alongside destination, then atomically replace: never leave partial JSON on failure.
        temporary = output.with_name(output.name + ".tmp")
        try:
            temporary.write_text(json.dumps(dataset, indent=2, allow_nan=False) + "\n", encoding="utf-8")
            temporary.replace(output)
        finally:
            if temporary.exists():
                temporary.unlink()
    finally:
        for _ in loaded:
            spice.kclear()


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kernels", nargs="+", required=True, type=Path, metavar="PATH", help="explicit kernel paths; no automatic downloads")
    parser.add_argument("--start-utc", required=True)
    parser.add_argument("--end-utc", required=True)
    parser.add_argument("--step-seconds", required=True, type=float)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        start, end = parse_utc(args.start_utc, "--start-utc"), parse_utc(args.end_utc, "--end-utc")
        generate(args.kernels, start, end, args.step_seconds, args.output)
    except (ExportError, OSError) as exc:
        print(f"export_vectors: error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
