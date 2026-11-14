"""Verified DE421 geometric Sun states and tiled illumination orchestration."""
from __future__ import annotations

import datetime
import hashlib
import importlib.util
import json
import math
from pathlib import Path
from typing import Any

import numpy as np

FRAME = "MOON_ME_DE421"
SUN_RADIUS_KM = 695_700.0
ALGORITHM_VERSION = "illumination-v1"
SHADOW_CLASS = {"UNKNOWN": 0, "LIT": 1, "SELF_SHADOWED": 2, "CAST_SHADOWED": 3, "PARTIAL_DISK": 4, "MIXED": 5}

try:
    from rasterio.windows import Window
except ImportError:
    class Window:
        def __init__(self, col_off, row_off, width, height):
            self.col_off, self.row_off, self.width, self.height = col_off, row_off, width, height


def _registered_module():
    path = Path(__file__).with_name("registered-sky.py")
    spec = importlib.util.spec_from_file_location("registered_sky_verified", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load verified sky helper: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def validate_utc(value: str) -> str:
    if not isinstance(value, str):
        raise ValueError("UTC must be RFC3339 UTC ending in Z")
    helper = _registered_module()
    return helper.validate_utc(value)


def build_sun(utc: str, kernels_dir: str | Path, *, spice_module=None, hash_loader=None) -> dict[str, Any]:
    utc = validate_utc(utc)
    helper = _registered_module()
    spice = spice_module or helper.spice
    kernels_dir = Path(kernels_dir)
    hashes = (hash_loader or helper.kernel_manifest_hashes)(kernels_dir)
    loaded = []
    try:
        for filename in helper.REQUIRED_KERNELS:
            kernel = str(kernels_dir / filename)
            spice.furnsh(kernel)
            loaded.append(kernel)
        et = spice.str2et(utc)
        state, _ = spice.spkezr("SUN", et, FRAME, "NONE", "MOON")
        xyz_m = [float(component) * 1000.0 for component in state[:3]]
        distance_m = math.sqrt(sum(component * component for component in xyz_m))
        if not math.isfinite(distance_m) or distance_m <= 0:
            raise ValueError("Invalid DE421 Sun distance")
        return {"utc": utc, "frame": FRAME, "positionM": xyz_m, "distanceM": distance_m,
                "solarAngularRadiusRad": math.asin(min(1.0, SUN_RADIUS_KM * 1000.0 / distance_m)),
                "source": {"ephemeris": "DE421", "aberrationCorrection": "NONE", "kernelHashes": hashes}}
    finally:
        for kernel in reversed(loaded):
            spice.unload(kernel)


def output_shape(window: Window, output_step: int) -> tuple[int, int]:
    if isinstance(output_step, bool) or not isinstance(output_step, int) or output_step < 1:
        raise ValueError("output_step must be a positive integer")
    height, width = int(window.height), int(window.width)
    return math.ceil(height / output_step), math.ceil(width / output_step)


def run_window(terrain, sun, window, *, output_step=1, disk_samples=19, max_disk_samples=61):
    shape = output_shape(window, output_step)
    if not isinstance(sun, dict) or sun.get("frame") != FRAME or sun.get("source", {}).get("ephemeris") != "DE421" or sun.get("source", {}).get("aberrationCorrection") != "NONE":
        raise ValueError("Sun geometry must be a verified DE421 NONE state in MOON_ME_DE421")
    vector = sun.get("positionM")
    if not isinstance(vector, list) or len(vector) != 3 or not all(isinstance(x, (int, float)) and math.isfinite(x) for x in vector):
        raise ValueError("Sun positionM must contain three finite coordinates")
    module = _load_engine("illumination_terrain", "load_verified_terrain")
    engine = _load_engine("illumination_engine", "compute_tile")
    engine_window = (int(window.row_off), int(window.col_off), int(window.height), int(window.width))
    result = engine(terrain, sun, engine_window, output_step=output_step, disk_samples=disk_samples, max_disk_samples=max_disk_samples)
    arrays = {key: np.asarray(value) for key, value in result.items() if isinstance(value, np.ndarray)}
    for key, array in arrays.items():
        if array.shape != shape:
            raise ValueError(f"Engine returned {key} shape {array.shape}; expected {shape}")
    return result


def _feature_module(module_name):
    spec = importlib.util.spec_from_file_location(
        f"visibility_{module_name}", Path(__file__).with_name(f"{module_name}.py"))
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Required engine module unavailable: {module_name}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _load_engine(module_name, function_name):
    try:
        return getattr(_feature_module(module_name), function_name)
    except (ImportError, AttributeError) as exc:
        raise RuntimeError(f"Required engine API unavailable: {module_name}.{function_name}") from exc


def load_verified_terrain(image_path=None, label_path=None, manifest_path=None):
    return _load_engine("illumination_terrain", "load_verified_terrain")(image_path, label_path, manifest_path)


def write_product(path, result, manifest):
    required = {"elevationM": np.float32, "incidenceAngleDeg": np.float32,
                "solarDiskVisibleFraction": np.float32, "relativeDirectIrradiance": np.float32,
                "shadowClass": np.uint8, "selfShadowed": np.uint8, "castShadowed": np.uint8,
                "coverageStatus": np.uint8}
    missing = set(required) - set(result)
    if missing:
        raise ValueError(f"Missing required output arrays: {sorted(missing)}")
    arrays = {}
    shape = None
    for name, dtype in required.items():
        array = np.asarray(result[name])
        if array.dtype.kind not in "iuf" or array.dtype.kind == "f" and not np.all(np.isfinite(array) | np.isnan(array)):
            raise ValueError(f"Invalid numeric array: {name}")
        if shape is None:
            shape = array.shape
        if array.shape != shape:
            raise ValueError("Output arrays must have identical shapes")
        arrays[name] = array.astype(dtype, copy=False)
    doc = {"contractVersion": 1, "algorithmVersion": ALGORITHM_VERSION, **manifest}
    doc["tileShape"] = list(shape)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(path, **arrays)
    manifest_path = path.with_suffix(".json")
    manifest_path.write_text(json.dumps(doc, indent=2, sort_keys=True, allow_nan=False) + "\n", encoding="utf-8")
    return manifest_path
