#!/usr/bin/env python3
"""Generate one explicitly bounded lunar illumination ROI."""
import argparse
import importlib.util
import json
import math
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("illumination_sky", ROOT / "src/features/visibility/illumination_sky.py")
sky = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sky)


def parse_window(value):
    try:
        row, col, height, width = map(int, value.split(","))
    except Exception as exc:
        raise argparse.ArgumentTypeError("window must be row,col,height,width") from exc
    if min(row, col) < 0 or min(height, width) <= 0:
        raise argparse.ArgumentTypeError("window offsets must be nonnegative and dimensions positive")
    return sky.Window(row_off=row, col_off=col, height=height, width=width)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--epoch", required=True)
    parser.add_argument("--window", type=parse_window, help="source pixels: row,col,height,width; defaults to small ROI")
    parser.add_argument("--full-footprint", action="store_true", help="use complete 7600x7600 footprint; requires coarse output-step")
    parser.add_argument("--output-step", type=int, default=1)
    parser.add_argument("--tile-size", type=int, default=64)
    parser.add_argument("--disk-samples", type=int, default=19)
    parser.add_argument("--max-disk-samples", type=int, default=61)
    parser.add_argument("--output", default="output/illumination/tile.npz")
    parser.add_argument("--terrain-image")
    parser.add_argument("--terrain-label")
    parser.add_argument("--terrain-manifest")
    parser.add_argument("--kernels", default=str(ROOT / "data/kernels"))
    args = parser.parse_args(argv)
    try:
        if args.tile_size <= 0 or args.output_step <= 0:
            raise ValueError("tile-size and output-step must be positive")
        if args.full_footprint and args.window:
            raise ValueError("choose --full-footprint or --window, not both")
        window = args.window or (sky.Window(row_off=0, col_off=0, height=7600, width=7600) if args.full_footprint else sky.Window(row_off=3700, col_off=3700, height=64, width=64))
        if window.row_off + window.height > 7600 or window.col_off + window.width > 7600:
            raise ValueError("window exceeds verified 7600x7600 product")
        sky.output_shape(window, args.output_step)
        terrain = sky.load_verified_terrain(args.terrain_image, args.terrain_label, args.terrain_manifest)
        sun = sky.build_sun(args.epoch, args.kernels)
        started = time.perf_counter()
        result = sky.run_window(terrain, sun, window, output_step=args.output_step,
                                disk_samples=args.disk_samples, max_disk_samples=args.max_disk_samples)
        elapsed = time.perf_counter() - started
        arrays = {key: value for key, value in result.items() if isinstance(value, np.ndarray)}
        if len(arrays) != 8:
            raise ValueError("Engine result must contain exactly the eight contract arrays")
        resolution = 80 * args.output_step
        manifest = {"utc": sun["utc"], "sun": sun, "projection": "PDS south-polar stereographic LDEM_80S_80M",
            "sourceProduct": "LDEM_80S_80M", "sourceVersion": "V2.1", "sourceImageSha256": "c088dd4f510e879375ee7e6f0d320ba84115f535f45fb592dd7f83a7d2e83ae3",
            "sourceLabelSha256": "497512747bb56490d50cf3f4945f2cb736bf61cd19b65fa61a826825e2a35d79",
            "roi": {"rowOff": window.row_off, "colOff": window.col_off, "height": window.height, "width": window.width},
            "actualResolutionMPerPixel": resolution, "outputStep": args.output_step, "tileSize": args.tile_size,
            "tileCount": len(result.get("tiles", [])) if isinstance(result.get("tiles"), list) else 1,
            "diskSamplesRequested": args.disk_samples, "maxDiskSamples": args.max_disk_samples,
            "algorithmVersion": sky.ALGORITHM_VERSION, "benchmarkScope": "measured single requested ROI only",
            "wallSeconds": elapsed, "full80mBenchmark": False,
            "warnings": ["Nominal 80 m spacing is not vertical accuracy.", "Full 80 m footprint runtime is unbenchmarked."]}
        sky.write_product(args.output, arrays, manifest)
        return 0
    except Exception as exc:
        print(f"run-illumination: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
