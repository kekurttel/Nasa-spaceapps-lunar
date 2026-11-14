#!/usr/bin/env python3
"""Export geometric Sun/Earth vectors relative to the Moon in IAU_MOON.

Requires spiceypy and explicitly supplied SPICE kernels (including suitable
leap-second, ephemeris, and lunar orientation/PCK kernels). No downloads occur.
SPICE kernel loading is process-global; run this CLI sequentially.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Sequence

SOURCE_URL = "https://naif.jpl.nasa.gov/naif/"
MAX_SAMPLES = 100_000


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


def _validate_vector(vector: object, target: str) -> dict[str, float]:
    try:
        values = list(vector)  # type: ignore[arg-type]
    except (TypeError, ValueError) as exc:
        raise ExportError(f"SPICE returned invalid {target} vector; expected three finite coordinates") from exc
    if len(values) != 3:
        raise ExportError(f"SPICE returned invalid {target} vector; expected three finite coordinates")
    try:
        coordinates = [float(value) for value in values]
    except (TypeError, ValueError, OverflowError) as exc:
        raise ExportError(f"SPICE returned invalid {target} vector; expected three finite coordinates") from exc
    if not all(math.isfinite(value) for value in coordinates):
        raise ExportError(f"SPICE returned invalid {target} vector; expected three finite coordinates")
    return dict(zip(("x", "y", "z"), coordinates))


def generate(kernels: Sequence[Path], start: datetime, end: datetime, step_seconds: float, output: Path) -> None:
    if start.tzinfo is None or start.utcoffset() != timedelta(0) or start.microsecond % 1000:
        raise ExportError("--start-utc must be UTC and aligned to whole milliseconds")
    if end.tzinfo is None or end.utcoffset() != timedelta(0) or end.microsecond % 1000:
        raise ExportError("--end-utc must be UTC and aligned to whole milliseconds")
    if end <= start:
        raise ExportError("--end-utc must be later than --start-utc")
    if not math.isfinite(step_seconds) or step_seconds <= 0:
        raise ExportError("--step-seconds must be a finite number greater than zero")
    step_ms = step_seconds * 1000
    if not math.isfinite(step_ms) or not step_ms.is_integer() or step_ms < 1:
        raise ExportError("--step-seconds must be a whole number of milliseconds")
    duration_ms = (end - start) // timedelta(milliseconds=1)
    sample_count = duration_ms // int(step_ms) + 1
    if sample_count > MAX_SAMPLES:
        raise ExportError(f"requested interval exceeds maximum of {MAX_SAMPLES} samples")
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
            # SpiceyPy accepts Unicode paths inconsistently on Windows. Load ASCII
            # basename from kernel directory and restore process working directory.
            previous_cwd = Path.cwd()
            try:
                os.chdir(kernel.parent)
                spice.furnsh(kernel.name)
            except Exception as exc:
                raise ExportError(f"could not load kernel {kernel}: {exc}") from exc
            finally:
                os.chdir(previous_cwd)
            loaded.append(kernel)
        samples = []
        for index in range(sample_count):
            current = start + timedelta(milliseconds=index * int(step_ms))
            utc_text = iso_utc(current)
            try:
                et = spice.str2et(utc_text)
                sun = _validate_vector(spice.spkpos("SUN", et, "IAU_MOON", "NONE", "MOON")[0], "SUN")
                earth = _validate_vector(spice.spkpos("EARTH", et, "IAU_MOON", "NONE", "MOON")[0], "EARTH")
            except ExportError:
                raise
            except Exception as exc:
                raise ExportError(f"SPICE coverage/conversion failed at {utc_text}; check loaded LSK, SPK, and lunar PCK kernels: {exc}") from exc
            samples.append({"timeUtc": utc_text, "sunKm": sun, "earthKm": earth})
            current += timedelta(milliseconds=int(step_ms))
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
        temporary_name = None
        try:
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n",
                                             dir=output.parent, prefix=f".{output.name}.", suffix=".tmp",
                                             delete=False) as temporary:
                temporary_name = Path(temporary.name)
                temporary.write(json.dumps(dataset, indent=2, allow_nan=False) + "\n")
            temporary_name.replace(output)
        finally:
            if temporary_name is not None and temporary_name.exists():
                temporary_name.unlink()
    finally:
        for kernel in reversed(loaded):
            try:
                spice.unload(kernel.name)
            except Exception:
                pass


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
