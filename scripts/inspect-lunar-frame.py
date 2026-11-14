"""Verify NAIF DE421 lunar frame registration and geometric target vectors.

Requires spiceypy and the four files listed in data/kernels/manifest.json.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
import spiceypy as spice

ROOT = Path(__file__).resolve().parents[1]
KERNEL_DIR = ROOT / "data" / "kernels"
MANIFEST = KERNEL_DIR / "manifest.json"


def verify_manifest() -> list[Path]:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    paths = []
    for item in manifest["files"]:
        path = KERNEL_DIR / item["fileName"]
        content = path.read_bytes()
        digest = hashlib.sha256(content).hexdigest()
        if len(content) != item["bytes"] or digest != item["sha256"]:
            raise ValueError(f"Kernel manifest mismatch: {path.name}")
        paths.append(path)
    if manifest.get("ephemeris") != "DE421":
        raise ValueError("SPK is not identified as DE421")
    return paths


def main() -> None:
    paths = verify_manifest()
    for path in paths:
        spice.furnsh(str(path))
    try:
        et = spice.str2et("2026 NOV 14 00:00:00 UTC")
        frame_id = spice.namfrm("MOON_ME_DE421")
        if frame_id != 31007:
            raise AssertionError(f"Unexpected MOON_ME_DE421 frame ID: {frame_id}")
        rotation = spice.pxform("MOON_ME_DE421", "J2000", et)
        orthogonality_error = float(np.max(np.abs(rotation @ rotation.T - np.eye(3))))
        determinant = float(np.linalg.det(rotation))
        if orthogonality_error > 1e-12 or abs(determinant - 1.0) > 1e-12:
            raise AssertionError("Frame transform is not a proper rotation")

        print(f"epoch_utc={spice.et2utc(et, 'ISOC', 3)}")
        print(f"frame=MOON_ME_DE421 frame_id={frame_id}")
        print(f"rotation_determinant={determinant:.16g}")
        print(f"rotation_orthogonality_max_error={orthogonality_error:.3g}")
        for target in ("SUN", "EARTH"):
            position, light_time = spice.spkpos(
                target, et, "MOON_ME_DE421", "NONE", "MOON"
            )
            if not np.isfinite(position).all():
                raise AssertionError(f"Non-finite {target} position")
            print(
                f"{target}_geometric_m={np.array2string(position * 1000, precision=3)}"
                f" light_time_s={light_time:.6f}"
            )
        print("aberration=NONE; vectors are geometric, not apparent/Horizons values")
        print("spk_provenance=DE421")
    finally:
        spice.kclear()


if __name__ == "__main__":
    main()
