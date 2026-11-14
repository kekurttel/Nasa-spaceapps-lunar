#!/usr/bin/env python3
"""Measure bounded illumination runs; never extrapolate full-resolution runtime."""
import argparse
import importlib.util
import json
import os
import platform
import resource
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNNER = ROOT / "scripts/run-illumination.py"


def peak_rss_bytes():
    if platform.system() == "Windows":
        try:
            import ctypes
            from ctypes import wintypes
            class PROCESS_MEMORY_COUNTERS(ctypes.Structure):
                _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD),
                    ("PeakWorkingSetSize", ctypes.c_size_t), ("WorkingSetSize", ctypes.c_size_t),
                    ("QuotaPeakPagedPoolUsage", ctypes.c_size_t), ("QuotaPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t), ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                    ("PagefileUsage", ctypes.c_size_t), ("PeakPagefileUsage", ctypes.c_size_t)]
            counters = PROCESS_MEMORY_COUNTERS(); counters.cb = ctypes.sizeof(counters)
            if ctypes.windll.psapi.GetProcessMemoryInfo(ctypes.windll.kernel32.GetCurrentProcess(), ctypes.byref(counters), counters.cb):
                return int(counters.PeakWorkingSetSize)
        except Exception:
            pass
        return None
    try:
        value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return int(value if platform.system() == "Darwin" else value * 1024)
    except Exception:
        return None


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--epoch", required=True)
    parser.add_argument("--output-dir", default="output/illumination-benchmarks")
    parser.add_argument("--disk-samples", type=int, default=19)
    parser.add_argument("--max-disk-samples", type=int, default=61)
    parser.add_argument("--coarse-step", type=int, default=120)
    args = parser.parse_args(argv)
    output = Path(args.output_dir); output.mkdir(parents=True, exist_ok=True)
    cases = [("64x64", "0,0,64,64", 1), ("512x512", "0,0,512,512", 1), ("full-coarse", "0,0,7600,7600", args.coarse_step)]
    report = {"epoch": args.epoch, "measurements": [], "full80mBenchmark": False,
              "note": "No full-resolution runtime extrapolation; RSS is process peak where available."}
    for name, window, step in cases:
        started = time.perf_counter()
        command = [sys.executable, str(RUNNER), "--epoch", args.epoch, "--window", window,
                   "--output-step", str(step), "--disk-samples", str(args.disk_samples),
                   "--max-disk-samples", str(args.max_disk_samples), "--output", str(output / f"{name}.npz")]
        completed = subprocess.run(command, capture_output=True, text=True)
        measurement = {"case": name, "window": window, "outputStep": step,
                       "wallSeconds": time.perf_counter() - started, "returnCode": completed.returncode,
                       "stdout": completed.stdout, "stderr": completed.stderr, "peakRssBytes": peak_rss_bytes()}
        report["measurements"].append(measurement)
        if completed.returncode:
            break
    (output / "benchmark.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    return int(any(item["returnCode"] for item in report["measurements"]))


if __name__ == "__main__":
    raise SystemExit(main())
