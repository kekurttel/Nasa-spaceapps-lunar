"""Windows-only, single-process real DEM benchmark; no process-memory cap implied."""
import argparse
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--single-thread', action='store_true')
    args = parser.parse_args()
    if os.name != 'nt':
        parser.error('Windows GetProcessMemoryInfo is required')
    if args.single_thread:
        os.environ['GDAL_NUM_THREADS'] = '1'
        os.environ['OPJ_NUM_THREADS'] = '1'
    from src.features.visibility.polar_lola import compute_horizon

    class MemoryCounters(ctypes.Structure):
        _fields_ = [('cb', wintypes.DWORD), ('PageFaultCount', wintypes.DWORD)] + [
            (name, ctypes.c_size_t) for name in (
                'PeakWorkingSetSize', 'WorkingSetSize', 'QuotaPeakPagedPoolUsage',
                'QuotaPagedPoolUsage', 'QuotaPeakNonPagedPoolUsage',
                'QuotaNonPagedPoolUsage', 'PagefileUsage', 'PeakPagefileUsage')]

    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.GetCurrentProcess.restype = wintypes.HANDLE
    psapi = ctypes.WinDLL('psapi', use_last_error=True)
    psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(MemoryCounters), wintypes.DWORD]
    psapi.GetProcessMemoryInfo.restype = wintypes.BOOL
    source = ROOT / 'data/raw/polar'
    started = time.perf_counter()
    doc = compute_horizon(source / 'ldem_80s_80m.jp2', site_id='memory-probe',
        latitude_deg=-89.9, longitude_deg=0, observer_height_m=2,
        azimuth_step_deg=5, distance_step_m=80, max_distance_m=200000,
        label_text=(source / 'ldem_80s_80m_jp2.lbl').read_bytes().decode('ascii'))
    seconds = time.perf_counter() - started
    counters = MemoryCounters()
    counters.cb = ctypes.sizeof(counters)
    if not psapi.GetProcessMemoryInfo(kernel.GetCurrentProcess(), ctypes.byref(counters), counters.cb):
        raise ctypes.WinError(ctypes.get_last_error())
    print(json.dumps({'seconds': seconds, 'singleThreadExperiment': args.single_thread,
        'peakWorkingSetBytes': counters.PeakWorkingSetSize,
        'workingSetBytes': counters.WorkingSetSize,
        'peakPrivateCommitBytes': counters.PeakPagefileUsage,
        'terrainSha256': doc['provenance']['sha256'],
        'scope': 'Python terrain process only; not Node or SPICE children; not a memory cap'}, indent=2))


if __name__ == '__main__':
    main()
