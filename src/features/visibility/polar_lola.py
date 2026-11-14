"""PDS LDEM_80S_80M label validation, sampling and terrain profile output."""
from __future__ import annotations

import hashlib
import json
import os
import datetime
import math
import re
from pathlib import Path
from typing import Any

import numpy as np
try:
    import rasterio
    from rasterio.windows import Window
except ImportError:
    rasterio = None
    Window = None

PRODUCT = "LDEM_80S_80M"
VERSION = "V2.1"
RADIUS_M = 1_737_400.0
FRAME = "MEAN EARTH/POLAR AXIS OF DE421"
URL_BASE = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/jp2/"
IMAGE_URL = URL_BASE + "ldem_80s_80m.jp2"
LABEL_URL = URL_BASE + "ldem_80s_80m_jp2.lbl"
EXPECTED_BYTES = 29_837_992
EXPECTED_SHA256 = "c088dd4f510e879375ee7e6f0d320ba84115f535f45fb592dd7f83a7d2e83ae3"
EXPECTED_LABEL_SHA256 = "497512747bb56490d50cf3f4945f2cb736bf61cd19b65fa61a826825e2a35d79"
EXPECTED_LABEL_CANONICAL_SHA256 = "48790e693ba0951c4bde941c4ddb6a8430f033c5c0f8569c5d0c2b1e5b403e95"
MAX_RAY_SAMPLES = 200_000
GDAL_CACHE_MB = 64


def decode_sample_radius_m(dn: int) -> float:
    if not isinstance(dn, (int, np.integer)) or not -32768 <= int(dn) <= 32767:
        raise ValueError("sample must be a signed 16-bit integer")
    return int(dn) * 0.5 + RADIUS_M


def _field(label: str, key: str) -> str:
    match = re.search(rf"^\s*{re.escape(key)}\s*=\s*(?:\"([^\"]*)\"|([^\s]+))", label, re.I | re.M)
    if not match:
        raise ValueError(f"Missing PDS label field {key}")
    return (match.group(1) if match.group(1) is not None else match.group(2)).strip()


def validate_label(label: str | dict[str, Any]) -> dict[str, Any]:
    get = (lambda k: str(label[k])) if isinstance(label, dict) else (lambda k: _field(label, k))
    expected = {"PRODUCT_ID": "LDEM_80S_80M", "PRODUCT_VERSION_ID": "V2.1",
        "DATA_SET_ID": "LRO-L-LOLA-4-GDR-V1.0", "LINES": "7600", "LINE_SAMPLES": "7600",
        "SAMPLE_BITS": "16", "SAMPLE_TYPE": "LSB_INTEGER", "UNIT": "METER",
        "MAP_PROJECTION_TYPE": "POLAR STEREOGRAPHIC", "KEYWORD_LATITUDE_TYPE": "PLANETOCENTRIC",
        "CENTER_LATITUDE": "-90", "CENTER_LONGITUDE": "0", "MINIMUM_LATITUDE": "-90",
        "MAXIMUM_LATITUDE": "-80", "POSITIVE_LONGITUDE_DIRECTION": "EAST",
        "COORDINATE_SYSTEM_NAME": FRAME, "COORDINATE_SYSTEM_TYPE": "BODY-FIXED ROTATING"}
    for key, value in expected.items():
        if get(key).strip('"') != value:
            raise ValueError(f"Unsupported PDS label {key}: expected {value}")
    if float(get("SCALING_FACTOR")) != 0.5 or float(get("OFFSET")) != RADIUS_M or float(get("MAP_SCALE")) != 80:
        raise ValueError("Unsupported scale, radius offset, or map scale")
    return {"product": PRODUCT, "version": VERSION, "width": 7600, "height": 7600,
            "scale": 0.5, "offsetM": RADIUS_M, "mapScaleM": 80, "frame": FRAME,
            "lineOffset": 3799.5, "sampleOffset": 3799.5}


def label_projection_to_pixel(longitude_deg: float, latitude_deg: float, size: int,
                              map_scale_m: float, sample_offset: float, line_offset: float) -> tuple[float, float]:
    """PDS south-polar stereographic coordinates; return pixel-center col,row.

    The map orientation is x=east, y=north. At the south pole, increasing
    longitude 90 degrees moves right (increasing column), as checked against
    the JP2 georeferencing at runtime.
    """
    if not (-90 <= latitude_deg <= -80) or not all(map(math.isfinite, (longitude_deg, latitude_deg))):
        raise ValueError("Coordinate outside LDEM_80S_80M coverage")
    rho = 2 * RADIUS_M * math.tan(math.radians(90 + latitude_deg) / 2)
    lam = math.radians(longitude_deg)
    x = rho * math.sin(lam)
    y = rho * math.cos(lam)
    col = sample_offset + x / map_scale_m
    row = line_offset - y / map_scale_m
    return col, row


def horizon_document(*, site_id: str, latitude_deg: float, longitude_deg: float, observer_height_m: float,
                     azimuth_step_deg: float, distance_step_m: float, max_distance_m: float,
                     azimuth_deg: list[float], elevation_deg: list[float], sha256: str,
                     source_url: str, downloaded_bytes: int, requested_max_distance_m: float | None = None) -> dict[str, Any]:
    warnings = ["80 m grid spacing is not a vertical-accuracy guarantee; small landing hazards may be unresolved.",
        "Near-field terrain within approximately one grid cell of the observer is not independently resolved.",
        "LOLA polar GDR is an adjusted/gridded product, not a direct independent laser shot at every pixel.",
        "Spherical radial horizon sampling; finite distance/ray spacing and DEM coverage limit the result."]
    return {"profile": {"siteId": site_id, "azimuthDeg": azimuth_deg, "elevationDeg": elevation_deg,
            "model": "terrain", "dataKind": "real", "sourceIds": [PRODUCT],
            "observerHeightM": observer_height_m, "warnings": warnings},
        "coverage": {"siteId": site_id, "latitudeDeg": latitude_deg, "longitudeDeg": longitude_deg,
            "observerHeightM": observer_height_m, "frame": "ME_DE421_LOCAL_NORTH_EAST",
            "azimuthCoverage": "full-circle", "minimumDistanceM": distance_step_m,
            "maximumDistanceM": max_distance_m, "requestedMaximumDistanceM": max_distance_m,
            "distanceStepM": distance_step_m},
        "sources": [{"id": PRODUCT, "url": source_url,
            "description": "NASA PDS Geosciences Node LRO/LOLA polar stereographic LDEM_80S_80M V2.1."}],
        "provenance": {"product": PRODUCT, "productVersion": VERSION, "dataSetId": "LRO-L-LOLA-4-GDR-V1.0",
            "heightReference": "Radius from 1737.4 km sphere; DN × 0.5 m + 1737400 m.",
            "coordinateSystem": FRAME, "resolutionMPerPixel": 80, "latitudeDeg": latitude_deg,
            "longitudeDeg": longitude_deg, "observerHeightM": observer_height_m,
            "minimumDistanceM": distance_step_m, "maximumDistanceM": max_distance_m,
            "distanceStepM": distance_step_m, "azimuthStepDeg": azimuth_step_deg,
            "sha256": sha256, "downloadedBytes": downloaded_bytes, "synthetic": False},
        "surfaceHeightM": None}


def _validate_ray_latitude(latitude_deg: float) -> None:
    if latitude_deg > -80 or latitude_deg < -90:
        raise ValueError("Horizon ray leaves LDEM_80S_80M latitude coverage")


def _sample_four(ds: Any, x: float, y: float) -> float:
    if x < 0 or y < 0 or x >= ds.width - 1 or y >= ds.height - 1:
        raise ValueError("Bilinear sample lacks four in-bounds neighboring pixels")
    x0, y0 = math.floor(x), math.floor(y)
    x1, y1 = x0 + 1, y0 + 1
    block = ds.read(1, window=Window(x0, y0, 2, 2), masked=True)
    arr = np.ma.asarray(block, dtype=np.float64).filled(np.nan)
    cs = (arr[0,0], arr[0,1], arr[1,0], arr[1,1])
    if not all(np.isfinite(v) for v in cs):
        raise ValueError("Horizon ray intersects NoData in DEM")
    fx, fy = x-x0, y-y0
    dn = (1-fy)*((1-fx)*cs[0]+fx*cs[1])+fy*((1-fx)*cs[2]+fx*cs[3])
    return float(dn)*0.5+RADIUS_M


def compute_horizon(image_path: str | Path, *, site_id: str, latitude_deg: float, longitude_deg: float,
                    observer_height_m: float, azimuth_step_deg: float = 5.0,
                    distance_step_m: float = 80.0, max_distance_m: float = 200_000.0,
                    label_text: str | None = None) -> dict[str, Any]:
    if not isinstance(site_id, str) or not site_id.strip() or not all(math.isfinite(x) for x in (latitude_deg, longitude_deg, observer_height_m, azimuth_step_deg, distance_step_m, max_distance_m)):
        raise ValueError("Finite site and horizon parameters are required")
    if latitude_deg == -90:
        raise ValueError("Azimuth is undefined at exact south pole; select non-polar observer coordinates")
    if not -90 < latitude_deg <= -80 or observer_height_m < 0 or azimuth_step_deg <= 0 or azimuth_step_deg > 180 or distance_step_m <= 0 or max_distance_m < distance_step_m:
        raise ValueError("Invalid site or horizon parameters: azimuth step must yield at least two bearings")
    n_azimuth_float = 360 / azimuth_step_deg
    if not math.isfinite(n_azimuth_float) or abs(n_azimuth_float - round(n_azimuth_float)) > 1e-9:
        raise ValueError("Azimuth step must divide 360 into integer bearings")
    n_azimuth = int(round(n_azimuth_float))
    n_distance = int(math.floor(max_distance_m / distance_step_m))
    if n_azimuth * n_distance > MAX_RAY_SAMPLES:
        raise ValueError("Horizon ray workload exceeds supported limit")
    if not isinstance(label_text, str):
        raise ValueError("The matching raw PDS product label text is required")
    validate_label(label_text)
    label_bytes = label_text.encode("ascii")
    canonical_label_bytes = label_bytes.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
    label_sha = hashlib.sha256(canonical_label_bytes).hexdigest()
    if label_sha != EXPECTED_LABEL_CANONICAL_SHA256:
        raise ValueError("PDS label canonical SHA-256 does not match verified label manifest")
    if rasterio is None:
        raise RuntimeError("Polar DEM support requires the pinned packages in scripts/requirements-polar.txt")
    image_path = Path(image_path)
    if image_path.stat().st_size != EXPECTED_BYTES:
        raise ValueError(f"Unexpected JP2 size: {image_path.stat().st_size}")
    hasher = hashlib.sha256()
    with image_path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            hasher.update(chunk)
    sha = hasher.hexdigest()
    if sha != EXPECTED_SHA256:
        raise ValueError("PDS JP2 SHA-256 does not match verified manifest")
    azimuths = np.arange(n_azimuth, dtype=float) * azimuth_step_deg
    distances = np.arange(1, n_distance + 1, dtype=float) * distance_step_m
    actual_max_distance = float(distances[-1])
    elev = np.full(len(azimuths), -90.0)
    with rasterio.Env(GDAL_CACHEMAX=GDAL_CACHE_MB * 1024 * 1024), rasterio.open(image_path) as ds:
        if ds.width != 7600 or ds.height != 7600 or ds.count != 1 or ds.dtypes[0] != "int16":
            raise ValueError("Decoded image geometry/type does not match PDS label")
        if ds.crs is None:
            raise ValueError("JPEG2000 has no embedded georeferencing; refuse guessed projection")
        # Do not trust generic CRS axis/projection conventions for polar handedness.
        # Runtime control tests compare the decoded affine against the explicit label formula.
        from pyproj import Transformer
        transformer = Transformer.from_crs("+proj=longlat +R=1737400 +no_defs", ds.crs, always_xy=True)
        inv = ~ds.transform
        def project(lon: float, lat: float) -> tuple[float, float]:
            if lat > -80 or lat < -90:
                raise ValueError("Horizon ray leaves LDEM_80S_80M latitude coverage")
            x, y = transformer.transform(lon, lat)
            return inv @ (x, y)
        # Verify CRS affine agrees with authoritative label orientation and pixel offsets.
        center_col, center_row = project(0, -90)
        east_col, east_row = project(90, -89)
        prime_col, prime_row = project(0, -89)
        # Rasterio affine inverse returns coordinates from pixel corners;
        # PDS offsets describe sample centers, hence the +0.5 comparison.
        expected_pole = tuple(v + 0.5 for v in label_projection_to_pixel(0, -90, 7600, 80, 3799.5, 3799.5))
        expected_east = tuple(v + 0.5 for v in label_projection_to_pixel(90, -89, 7600, 80, 3799.5, 3799.5))
        expected_prime = tuple(v + 0.5 for v in label_projection_to_pixel(0, -89, 7600, 80, 3799.5, 3799.5))
        if (abs(center_col - expected_pole[0]) > 1e-6 or abs(center_row - expected_pole[1]) > 1e-6 or
            abs(east_col - expected_east[0]) > 1e-6 or abs(east_row - expected_east[1]) > 1e-6 or
            abs(prime_col - expected_prime[0]) > 1e-6 or abs(prime_row - expected_prime[1]) > 1e-6):
            raise ValueError("JP2 georeferencing fails independent south-polar orientation controls")
        def sample(col: float, row: float) -> float:
            return _sample_four(ds, col - 0.5, row - 0.5)
        sc, sr = project(longitude_deg, latitude_deg)
        site_radius = sample(sc, sr)
        for ai, az in enumerate(azimuths):
            a = math.radians(float(az)); lat1=math.radians(latitude_deg); lon1=math.radians(longitude_deg); highest=-90.0
            for d in distances:
                delta=float(d)/RADIUS_M
                lat2=math.asin(max(-1,min(1,math.sin(lat1)*math.cos(delta)+math.cos(lat1)*math.sin(delta)*math.cos(a))))
                lon2=lon1+math.atan2(math.sin(a)*math.sin(delta)*math.cos(lat1),math.cos(delta)-math.sin(lat1)*math.sin(lat2))
                col,row=project(math.degrees(lon2),math.degrees(lat2))
                terrain=sample(col,row)
                highest=max(highest,math.degrees(math.atan2(terrain*math.cos(delta)-(site_radius+observer_height_m),terrain*math.sin(delta))))
            elev[ai]=highest
    doc=horizon_document(site_id=site_id,latitude_deg=latitude_deg,longitude_deg=longitude_deg,
        observer_height_m=observer_height_m,azimuth_step_deg=azimuth_step_deg,distance_step_m=distance_step_m,
        max_distance_m=actual_max_distance,azimuth_deg=azimuths.tolist(),elevation_deg=elev.tolist(),sha256=sha,
        source_url=IMAGE_URL,downloaded_bytes=image_path.stat().st_size)
    doc["coverage"]["requestedMaximumDistanceM"] = max_distance_m
    doc["surfaceHeightM"]=site_radius-RADIUS_M
    doc["provenance"]["surfaceHeightM"] = site_radius-RADIUS_M
    return doc


def write_horizon(request_path: str | Path, output_path: str | Path, image_path: str | Path, label_path: str | Path) -> None:
    request=json.loads(Path(request_path).read_text(encoding="utf-8"))
    label_bytes = Path(label_path).read_bytes()
    if hashlib.sha256(label_bytes).hexdigest() != EXPECTED_LABEL_SHA256:
        raise ValueError("Raw PDS label SHA-256 does not match verified label manifest")
    doc=compute_horizon(image_path,site_id=request["siteId"],latitude_deg=request["latitudeDeg"],
        longitude_deg=request["longitudeDeg"],observer_height_m=request["observerHeightM"],
        azimuth_step_deg=request.get("azimuthStepDeg",5),distance_step_m=request.get("distanceStepM",80),
        max_distance_m=request.get("maxDistanceM",200000),label_text=Path(label_path).read_text(encoding="ascii"))
    output=Path(output_path); output.parent.mkdir(parents=True,exist_ok=True)
    tmp=output.with_suffix(output.suffix+".part"); tmp.write_text(json.dumps(doc,indent=2)+"\n",encoding="utf-8"); tmp.replace(output)
