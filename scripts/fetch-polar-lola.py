#!/usr/bin/env python3
"""Fetch only official PDS LDEM_80S_80M products; enforce 30 MB transfer cap."""
from __future__ import annotations

import hashlib
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.features.visibility.polar_lola import EXPECTED_BYTES, EXPECTED_LABEL_SHA256, EXPECTED_SHA256, IMAGE_URL, LABEL_URL, validate_label

DEST = ROOT / "data" / "raw" / "polar"
MANIFEST = ROOT / "data" / "polar-lola-manifest.json"
MAX_TRANSFER = 30_000_000
EXPECTED_LABEL_BYTES = 6354
TIMEOUT_SECONDS = 45


def fetch(url: str, target: Path, limit: int, expected_sha256: str | None = None, expected_bytes: int | None = None) -> dict:
    request = Request(url, headers={"User-Agent": "LunarLandingSiteNavigator/1.0"})
    with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        final_url = response.geturl()
        status = response.status
        content_type = response.headers.get("Content-Type")
        declared = response.headers.get("Content-Length")
        if status != 200 or not final_url.startswith("https://pds-geosciences.wustl.edu/"):
            raise RuntimeError(f"Untrusted PDS response: HTTP {status}, {final_url}")
        if declared and int(declared) > limit:
            raise RuntimeError(f"Refusing transfer larger than {limit} bytes")
        digest = hashlib.sha256()
        size = 0
        fd, temp_name = tempfile.mkstemp(prefix=target.name + ".", suffix=".part", dir=target.parent)
        try:
            with os.fdopen(fd, "wb") as out:
                while block := response.read(1024 * 1024):
                    size += len(block)
                    if size > limit:
                        raise RuntimeError(f"Transfer exceeded {limit}-byte limit")
                    digest.update(block)
                    out.write(block)
                out.flush()
                os.fsync(out.fileno())
            if declared and size != int(declared):
                raise RuntimeError(f"Truncated transfer: Content-Length {declared}, received {size}")
            if expected_bytes is not None and size != expected_bytes:
                raise RuntimeError(f"Unexpected product size: expected {expected_bytes}, received {size}")
            if expected_sha256 is not None and digest.hexdigest() != expected_sha256:
                raise RuntimeError("Product SHA-256 mismatch; retaining prior verified file")
            os.replace(temp_name, target)
        except BaseException:
            try:
                os.unlink(temp_name)
            except FileNotFoundError:
                pass
            raise
    return {"url": url, "final_url": final_url, "retrieved_at_utc": datetime.now(timezone.utc).isoformat(),
            "http_status": status, "content_type": content_type, "content_length_header": declared,
            "downloaded_bytes": size, "sha256": digest.hexdigest()}


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    label_path, image_path = DEST / "ldem_80s_80m_jp2.lbl", DEST / "ldem_80s_80m.jp2"
    if MANIFEST.exists() and label_path.is_file() and image_path.is_file():
        try:
            manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
            label_bytes, image_bytes = label_path.read_bytes(), image_path.read_bytes()
            label_text = label_bytes.decode("ascii")
            validate_label(label_text)
            if (manifest.get("product") == "LDEM_80S_80M"
                    and manifest.get("version") == "V2.1"
                    and manifest.get("dataset_id") == "LRO-L-LOLA-4-GDR-V1.0"
                    and manifest.get("label", {}).get("url") == LABEL_URL
                    and manifest.get("label", {}).get("final_url") == LABEL_URL
                    and manifest.get("raster", {}).get("final_url") == IMAGE_URL
                    and manifest.get("raster", {}).get("url") == IMAGE_URL
                    and len(label_bytes) == EXPECTED_LABEL_BYTES
                    and hashlib.sha256(label_bytes).hexdigest() == EXPECTED_LABEL_SHA256
                    and len(image_bytes) == EXPECTED_BYTES
                    and hashlib.sha256(image_bytes).hexdigest() == EXPECTED_SHA256
                    and manifest["label"].get("sha256") == EXPECTED_LABEL_SHA256
                    and manifest["label"].get("downloaded_bytes") == EXPECTED_LABEL_BYTES
                    and manifest["raster"].get("sha256") == EXPECTED_SHA256
                    and manifest["raster"].get("downloaded_bytes") == EXPECTED_BYTES
                    and all(isinstance(manifest[k].get("retrieved_at_utc"), str) and manifest[k]["retrieved_at_utc"].endswith("+00:00") for k in ("label", "raster"))):
                print(json.dumps(manifest, indent=2))
                return
        except (OSError, UnicodeDecodeError, json.JSONDecodeError, KeyError, TypeError):
            pass
    label_record = fetch(LABEL_URL, label_path, 100_000, expected_sha256=EXPECTED_LABEL_SHA256, expected_bytes=6354)
    label_text = label_path.read_bytes().decode("ascii")
    validate_label(label_text)
    image_record = fetch(IMAGE_URL, image_path, min(MAX_TRANSFER, EXPECTED_BYTES), expected_sha256=EXPECTED_SHA256, expected_bytes=EXPECTED_BYTES)
    manifest = {"source_name": "LRO/LOLA PDS Geosciences LDEM_80S_80M", "product": "LDEM_80S_80M",
        "version": "V2.1", "dataset_id": "LRO-L-LOLA-4-GDR-V1.0", "label": label_record,
        "raster": image_record, "storage": {"compression": "JPEG2000", "compressed_bytes": image_record["downloaded_bytes"],
        "decoded_shape": [7600, 7600], "decoded_dtype": "signed int16", "decoded_bytes": 7600*7600*2},
        "processing": "Raw files preserved; no resampling; label validated against expected geometry and scaling.",
        "vertical_reference": "Radius from 1737.4 km sphere; DN × 0.5 m + 1737400 m.",
        "coordinate_frame": "MEAN EARTH/POLAR AXIS OF DE421; body-fixed rotating; planetocentric; longitude east-positive"}
    temp = MANIFEST.with_suffix(".json.part")
    temp.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    os.replace(temp, MANIFEST)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
