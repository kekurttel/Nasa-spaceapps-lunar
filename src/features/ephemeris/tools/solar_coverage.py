"""Measured DE421 geometric Moon-to-Sun coverage; no guessed date ranges."""
from contextlib import contextmanager
from datetime import datetime, timedelta
import hashlib
import json
import math
import os
from pathlib import Path
import threading

import spiceypy as spice

FRAME = "MOON_ME_DE421"
REQUIRED_KERNELS = ("moon_080317.tf", "moon_pa_de421_1900-2050.bpc", "naif0012.tls", "de421.bsp")
# Immutable registered-sky family at Agent3 e241cee6d9f149767379a4891cb0344cf2a7d28d.
# Replacing a kernel requires an explicit contract/provenance review, not a new label.
REGISTERED_HASHES = {
    "moon_080317.tf": "78732477b96f9863e7b0d65bcee3c22b8707ca5ed0db56d1173319cb2e8c7993",
    "moon_pa_de421_1900-2050.bpc": "656f90616403d75a75f0cd6c8830fc5b44f8cb4facb5ccb8915e752b397520cf",
    "naif0012.tls": "678e32bdb5a744117a467cd9601cd6b373f0e9bc9bbde1371d5eee39600a039b",
    "de421.bsp": "08b20db2ae22488650641c5a9033e5bfda4b1c4b440cfeaf20f621cfa18ecdb3",
}
_LOCK = threading.RLock()  # SPICE kernel pool and process cwd are global; sequential use only.


def verify_kernels(directory):
    directory = Path(directory).resolve()
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("ephemeris") != "DE421":
        raise ValueError("manifest ephemeris must be DE421")
    entries = manifest.get("files")
    if not isinstance(entries, list):
        raise ValueError("manifest files must be an array")
    sources = []
    for name in REQUIRED_KERNELS:
        matches = [e for e in entries if isinstance(e, dict) and e.get("fileName") == name]
        if len(matches) != 1:
            raise ValueError(f"manifest must contain exactly one {name}")
        entry = matches[0]
        raw = (directory / name).read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        if raw.startswith(b"version https://git-lfs.github.com/spec/v1"):
            raise ValueError(f"LFS pointer is not a kernel: {name}")
        if type(entry.get("bytes")) is not int or entry["bytes"] != len(raw):
            raise ValueError(f"kernel size mismatch: {name}")
        if not isinstance(entry.get("sha256"), str) or digest != entry["sha256"].lower():
            raise ValueError(f"kernel SHA-256 mismatch: {name}")
        if digest != REGISTERED_HASHES[name]:
            raise ValueError(f"kernel is not the pinned registered DE421 family: {name}")
        if not isinstance(entry.get("url"), str) or not entry["url"].startswith("https://naif.jpl.nasa.gov/"):
            raise ValueError(f"missing official source URL: {name}")
        sources.append(dict(fileName=name, bytes=len(raw), sha256=digest, url=entry["url"]))
    return directory, sources


@contextmanager
def kernel_context(directory):
    """Verify before loading. Relative furnishing avoids Windows Unicode CSPICE paths.

    Do not call SPICE or change cwd concurrently outside this module. Foreign loaded
    kernels are refused rather than silently taking precedence or being unloaded.
    """
    with _LOCK:
        directory, sources = verify_kernels(directory)
        old_cwd = Path.cwd()
        existing = {Path(spice.kdata(i, "ALL")[0]).resolve() for i in range(spice.ktotal("ALL"))}
        allowed = {directory / name for name in REQUIRED_KERNELS}
        if existing - allowed:
            raise ValueError("foreign kernels already loaded; use an isolated SPICE process")
        loaded = []
        try:
            os.chdir(directory)
            for name in REQUIRED_KERNELS:
                if directory / name not in existing:
                    spice.furnsh(name)
                    loaded.append(name)
            yield sources
        finally:
            try:
                for name in reversed(loaded):
                    spice.unload(name)
            finally:
                os.chdir(old_cwd)


def intervals(cell):
    return [[float(a), float(b)] for a, b in (spice.wnfetd(cell, i) for i in range(spice.wncard(cell))) ]


def intersect(left, right):
    return [[max(a, c), min(b, d)] for a, b in left for c, d in right if max(a, c) <= min(b, d)]


def contains(windows, et):
    return any(a <= et <= b for a, b in windows)


def _centers():
    """Read actual SPK descriptors, not a hard-coded assumption about DE421 chains."""
    centers = {}
    handle = spice.dafopr("de421.bsp")
    try:
        spice.dafbfs(handle)
        while spice.daffna():
            _, integers = spice.dafus(spice.dafgs(), 2, 6)
            target, center = map(int, integers[:2])
            centers.setdefault(target, set()).add(center)
    finally:
        spice.dafcls(handle)
    return centers


def _probe(et):
    position, _ = spice.spkpos("SUN", et, FRAME, "NONE", "MOON")
    if not all(math.isfinite(float(v)) for v in position):
        raise ValueError("nonfinite SPICE position")


def measure_loaded(sources):
    """Requires kernel_context. Native windows are closed ET/TDB seconds past J2000."""
    objects = sorted(map(int, spice.spkobj("de421.bsp")))
    centers = _centers()
    chains = {}
    effective = None
    dependencies = {}
    for body in (10, 301):
        chain = [body]
        while chain[-1] != 0:
            target = chain[-1]
            if target in chain[:-1] or len(centers.get(target, ())) != 1:
                raise ValueError("ambiguous or cyclic SPK center chain")
            coverage = intervals(spice.spkcov("de421.bsp", target))
            dependencies[str(target)] = coverage
            effective = coverage if effective is None else intersect(effective, coverage)
            chain.append(next(iter(centers[target])))
        chains[str(body)] = chain
    # Resolve the actual dynamic PA frame behind the fixed ME frame from the FK.
    _, frame_class, class_id = spice.frinfo(spice.namfrm("MOON_PA_DE421"))
    if frame_class != 2:
        raise ValueError("expected binary PCK class-2 MOON_PA_DE421 frame")
    pck_cell = spice.utils.support_types.SPICEINT_CELL(100)
    spice.pckfrm("moon_pa_de421_1900-2050.bpc", pck_cell)
    pck_ids = sorted(map(int, pck_cell))
    if class_id not in pck_ids:
        raise ValueError("PA orientation absent from binary PCK")
    orientation = intervals(spice.pckcov("moon_pa_de421_1900-2050.bpc", class_id))
    effective = intersect(effective or [], orientation)
    if not effective:
        raise ValueError("no common solar/orientation coverage")
    utc_windows = []
    for a, b in effective:
        # Round inward to whole UTC seconds; never round a native ET boundary out.
        start = datetime.fromisoformat(spice.et2utc(a, "ISOC", 3))
        end = datetime.fromisoformat(spice.et2utc(b, "ISOC", 3))
        start = start.replace(microsecond=0) + timedelta(seconds=1)
        end = end.replace(microsecond=0) - timedelta(seconds=1)
        lo, hi = start.isoformat() + "Z", end.isoformat() + "Z"
        probes = [a, b, (a+b)/2, spice.str2et(lo), spice.str2et(hi)]
        for et in probes:
            _probe(et)
        utc_windows.append({"startUtc": lo, "endUtc": hi, "durationJulianYears": (spice.str2et(hi)-spice.str2et(lo))/(365.25*86400), "validatedProbeEt": probes})
    longest = max(utc_windows, key=lambda w: w["durationJulianYears"])
    study_start, study_end = "2000-01-01T00:00:00Z", "2019-01-01T00:00:00Z"
    study_ets = [float(spice.str2et(t)) for t in (study_start, study_end)]
    study_supported = any(a <= study_ets[0] < study_ets[1] <= b for a, b in effective)
    if study_supported:
        for et in study_ets:
            _probe(et)
    study = {"startUtc": study_start, "endUtc": study_end, "calendarYears": 19,
             "durationJulianYears": (study_ets[1] - study_ets[0]) / (365.25 * 86400),
             "supported": study_supported, "validatedEndpointEt": study_ets,
             "note": "Complete native coverage, with endpoint evaluation. Sampling cadence and terrain must separately resolve shadow events; 19 years alone does not guarantee all shadows are captured."}
    return {"schemaVersion": "1.0.0", "frame": FRAME, "ephemerisKernel": "DE421", "aberrationCorrection": "NONE", "origin": "MOON", "direction": "MOON_TO_SUN", "dataKind": "real", "sources": sources, "measurement": {"tool": "SPICE spkobj/dafus/spkcov/pckfrm/pckcov; intersection and spkpos endpoint probes", "spiceToolkitVersion": spice.tkvrsn("TOOLKIT"), "spiceypyVersion": spice.__version__, "etUnits": "TDB seconds past J2000; closed intervals"}, "spkObjects": objects, "spkCenterChains": chains, "spkDependencyCoverageEt": dependencies, "pckFrameIds": pck_ids, "orientationFrameClassId": class_id, "orientationCoverageEt": orientation, "effectiveCoverageEt": effective, "conservativeUtcIntervals": utc_windows, "utcLimitations": ["Conservative UTC endpoints are LSK-derived labels rounded inward, not predictions of future civil UTC.", "naif0012.tls does not predict future leap seconds; future labels may shift when the LSK is updated.", "Before 1972, SPICE LSK extrapolates its earliest DELTA_AT; historical UTC/UT clock accuracy is not established by kernel coverage."], "verifiedStudy": study, "studyRecommendation": {"minimumYears": 18.6, "supported": longest["durationJulianYears"] >= 18.6, "availableJulianYears": longest["durationJulianYears"], "note": "Choose at least 18.6 Julian years strictly within one conservative UTC interval; coverage is not a claim of model accuracy or future leap-second prediction."}}


def measure(directory):
    with kernel_context(directory) as sources:
        return measure_loaded(sources)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kernels-dir", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    Path(args.output).write_text(json.dumps(measure(args.kernels_dir), indent=2, allow_nan=False) + "\n", encoding="utf-8")
