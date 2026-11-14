"""Recompute Moon-centered ICRF vector residuals from archived Horizons text."""
from __future__ import annotations

import csv
import hashlib
import json
import math
import re
from pathlib import Path

import spiceypy as spice

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
KERNELS = ROOT / "data" / "kernels"


def get_vector(path: Path) -> tuple[float, tuple[float, float, float]]:
    text = path.read_text(encoding="ascii")
    match = re.search(r"\$\$SOE\s*\r?\n([^\r\n]+)", text)
    if not match:
        raise ValueError(f"missing $$SOE data row: {path}")
    fields = next(csv.reader([match.group(1)], skipinitialspace=True))
    if len(fields) < 5:
        raise ValueError(f"expected date/JD and XYZ fields: {path}")
    jd = float(fields[0])
    xyz = tuple(float(value) for value in fields[2:5])
    return jd, xyz


def main() -> None:
    manifest = json.loads((HERE / "manifest.json").read_text(encoding="utf-8"))
    for name, info in manifest.items():
        raw = (HERE / name).read_bytes()
        assert len(raw) == info["bytes"], f"byte count mismatch: {name}"
        assert hashlib.sha256(raw).hexdigest() == info["sha256"], f"SHA-256 mismatch: {name}"

    spice.furnsh(str(KERNELS / "naif0012.tls"))
    spice.furnsh(str(KERNELS / "moon_080317.tf"))
    spice.furnsh(str(KERNELS / "moon_pa_de421_1900-2050.bpc"))
    spice.furnsh(str(KERNELS / "de421.bsp"))
    try:
        for body, label in (("10", "Sun"), ("399", "Earth")):
            jd, horizons = get_vector(HERE / ("sun.txt" if body == "10" else "earth.txt"))
            et = (jd - 2451545.0) * 86400.0
            state, _ = spice.spkezr(body, et, "J2000", "NONE", "301")
            spice_xyz = tuple(float(value) for value in state[:3])
            delta = tuple(h - s for h, s in zip(horizons, spice_xyz))
            norm = math.sqrt(sum(value * value for value in delta))
            print(f"{label}: JDTDB={jd:.12f}; ET={et:.9f} s")
            print("  Horizons DE441 km:", *(f"{value:.12f}" for value in horizons))
            print("  SPICE DE421 km:   ", *(f"{value:.12f}" for value in spice_xyz))
            print("  delta H-S km:     ", *(f"{value:.12f}" for value in delta))
            print(f"  residual norm km: {norm:.12f}")
    finally:
        spice.kclear()


if __name__ == "__main__":
    main()
