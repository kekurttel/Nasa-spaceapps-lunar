"""Isolated mocked-transport tests for official PDS fetch safeguards.

All response bodies here are synthetic fixtures; tests never contact NASA/PDS.
"""
import hashlib
import importlib.util
import io
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("fetch_polar_lola", ROOT / "scripts" / "fetch-polar-lola.py")
fetcher = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = fetcher
SPEC.loader.exec_module(fetcher)

TRUSTED_URL = "https://pds-geosciences.wustl.edu/fixture.bin"


class FakeResponse:
    status = 200

    def __init__(self, body, *, final_url=TRUSTED_URL, declared=None):
        self.body = io.BytesIO(body)
        self.final_url = final_url
        self.headers = {"Content-Type": "application/octet-stream"}
        if declared is not None:
            self.headers["Content-Length"] = str(declared)

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def geturl(self):
        return self.final_url

    def read(self, size=-1):
        return self.body.read(size)


class FetchPolarLolaTests(unittest.TestCase):
    def setUp(self):
        approved_temp = Path(os.environ.get("LOCALAPPDATA", tempfile.gettempdir())) / "Temp" / "opencode"
        approved_temp.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(prefix="fetch-polar-test-", dir=approved_temp)
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.target = self.directory / "fixture.bin"

    def fetch_with(self, response, **kwargs):
        with patch.object(fetcher, "urlopen", return_value=response):
            return fetcher.fetch(TRUSTED_URL, self.target, **kwargs)

    def test_verified_cached_product_reuses_manifest_without_network_or_timestamp_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            label_path, image_path, manifest_path = base / "ldem_80s_80m_jp2.lbl", base / "ldem_80s_80m.jp2", base / "manifest.json"
            label = b"synthetic valid label"
            image = b"synthetic raster"
            label_path.write_bytes(label)
            image_path.write_bytes(image)
            label_hash, image_hash = hashlib.sha256(label).hexdigest(), hashlib.sha256(image).hexdigest()
            prior = {"product": "LDEM_80S_80M", "version": "V2.1", "dataset_id": "LRO-L-LOLA-4-GDR-V1.0", "label": {"url": fetcher.LABEL_URL, "final_url": fetcher.LABEL_URL, "sha256": label_hash, "downloaded_bytes": len(label), "retrieved_at_utc": "2020-01-01T00:00:00+00:00"},
                     "raster": {"url": fetcher.IMAGE_URL, "final_url": fetcher.IMAGE_URL, "sha256": image_hash, "downloaded_bytes": len(image), "retrieved_at_utc": "2020-01-02T00:00:00+00:00"}}
            manifest_path.write_text(__import__("json").dumps(prior), encoding="utf-8")
            with (patch.object(fetcher, "DEST", base), patch.object(fetcher, "MANIFEST", manifest_path),
                  patch.object(fetcher, "EXPECTED_BYTES", len(image)),
                  patch.object(fetcher, "EXPECTED_LABEL_SHA256", label_hash),
                  patch.object(fetcher, "EXPECTED_LABEL_BYTES", len(label)),
                  patch.object(fetcher, "EXPECTED_SHA256", image_hash),
                  patch.object(fetcher, "validate_label") as validate,
                  patch.object(fetcher, "urlopen", side_effect=AssertionError("unexpected request"))):
                fetcher.main()
            self.assertEqual(__import__("json").loads(manifest_path.read_text()), prior)
            validate.assert_called_once()

    def test_rejects_oversized_content_length_before_creating_target(self):
        with self.assertRaisesRegex(RuntimeError, "larger than"):
            self.fetch_with(FakeResponse(b"" , declared=11), limit=10)
        self.assertFalse(self.target.exists())
        self.assertEqual(list(self.directory.iterdir()), [])

    def test_overcap_stream_preserves_existing_target_and_removes_partial(self):
        self.target.write_bytes(b"previous verified bytes")
        with self.assertRaisesRegex(RuntimeError, "exceeded"):
            self.fetch_with(FakeResponse(b"01234567890"), limit=10)
        self.assertEqual(self.target.read_bytes(), b"previous verified bytes")
        self.assertEqual([p.name for p in self.directory.iterdir()], [self.target.name])

    def test_hash_mismatch_preserves_existing_target_and_removes_partial(self):
        self.target.write_bytes(b"previous verified bytes")
        with self.assertRaisesRegex(RuntimeError, "SHA-256 mismatch"):
            self.fetch_with(FakeResponse(b"synthetic fixture"), limit=100,
                            expected_sha256=hashlib.sha256(b"different").hexdigest())
        self.assertEqual(self.target.read_bytes(), b"previous verified bytes")
        self.assertEqual([p.name for p in self.directory.iterdir()], [self.target.name])

    def test_rejects_truncated_declared_length_and_preserves_target(self):
        self.target.write_bytes(b"previous verified bytes")
        with self.assertRaisesRegex(RuntimeError, "Truncated transfer"):
            self.fetch_with(FakeResponse(b"short", declared=20), limit=100)
        self.assertEqual(self.target.read_bytes(), b"previous verified bytes")
        self.assertEqual([p.name for p in self.directory.iterdir()], [self.target.name])

    def test_valid_fixture_hash_and_size_atomically_replace_target_and_return_metadata(self):
        body = b"synthetic test fixture; not NASA data"
        self.target.write_bytes(b"old bytes")
        result = self.fetch_with(FakeResponse(body, declared=len(body)), limit=1000,
                                 expected_sha256=hashlib.sha256(body).hexdigest(), expected_bytes=len(body))
        self.assertEqual(self.target.read_bytes(), body)
        self.assertEqual([p.name for p in self.directory.iterdir()], [self.target.name])
        self.assertEqual(result["downloaded_bytes"], len(body))
        self.assertEqual(result["sha256"], hashlib.sha256(body).hexdigest())
        self.assertEqual(result["http_status"], 200)
        self.assertEqual(result["final_url"], TRUSTED_URL)
        self.assertTrue(result["retrieved_at_utc"].endswith("+00:00"))

    def test_rejects_hostile_final_url_without_creating_target(self):
        with self.assertRaisesRegex(RuntimeError, "Untrusted PDS response"):
            self.fetch_with(FakeResponse(b"fixture", final_url="https://evil.example/fixture"), limit=100)
        self.assertFalse(self.target.exists())
        self.assertEqual(list(self.directory.iterdir()), [])


if __name__ == "__main__":
    unittest.main()
