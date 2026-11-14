"""Offline unit tests using a fake SPICE interface; no accuracy claim is made."""
import importlib.util
import json
import math
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

MODULE_PATH = Path(__file__).parents[1] / "tools" / "export_vectors.py"
SPEC = importlib.util.spec_from_file_location("export_vectors", MODULE_PATH)
export_vectors = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(export_vectors)


class FakeSpice:
    def __init__(self):
        self.loaded = []
        self.calls = []
        self.clears = 0

    def furnsh(self, path):
        self.loaded.append(path)

    def str2et(self, timestamp):
        self.calls.append(("str2et", timestamp))
        return len(self.calls) * 10.0

    def spkpos(self, target, et, frame, correction, observer):
        self.calls.append((target, frame, correction, observer))
        return ((et, et + 1, et + 2), 0.0)

    def kclear(self):
        self.clears += 1


class ExportVectorsTests(unittest.TestCase):
    def test_utc_must_be_explicit_and_valid(self):
        self.assertEqual(export_vectors.parse_utc("2030-01-01T00:00:00Z", "start").tzinfo, timezone.utc)
        for value in ("2030-01-01T00:00:00", "2030-02-30T00:00:00Z"):
            with self.assertRaises(export_vectors.ExportError):
                export_vectors.parse_utc(value, "start")

    def test_exports_schema_and_expected_spice_calls(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            kernel = root / "mock.bsp"
            kernel.write_bytes(b"fake kernel")
            output = root / "vectors.json"
            fake = FakeSpice()
            with patch.dict("sys.modules", {"spiceypy": fake}):
                export_vectors.generate([kernel], datetime(2030, 1, 1, tzinfo=timezone.utc),
                    datetime(2030, 1, 1, 0, 0, 2, tzinfo=timezone.utc), 1, output)
            data = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual((data["frame"], data["timeScale"], data["corrections"], data["dataKind"]),
                             ("IAU_MOON", "UTC", "geometric", "real"))
            self.assertEqual(len(data["samples"]), 3)
            self.assertEqual(data["samples"][1]["timeUtc"], "2030-01-01T00:00:01Z")
            self.assertEqual(data["samples"][0]["sunKm"], {"x": 10.0, "y": 11.0, "z": 12.0})
            self.assertEqual(data["samples"][0]["earthKm"], {"x": 10.0, "y": 11.0, "z": 12.0})
            self.assertEqual([call for call in fake.calls if call[0] in ("SUN", "EARTH")][0],
                             ("SUN", "IAU_MOON", "NONE", "MOON"))
            self.assertEqual(data["kernels"][0]["file"], "mock.bsp")
            self.assertEqual(len(data["kernels"][0]["sha256"]), 64)
            self.assertEqual(fake.clears, 1)

    def test_failure_does_not_create_success_file(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            kernel = root / "mock.bsp"
            kernel.touch()
            output = root / "out.json"
            fake = FakeSpice()
            def failed(*args):
                raise RuntimeError("no coverage")
            fake.spkpos = failed
            with patch.dict("sys.modules", {"spiceypy": fake}), self.assertRaises(export_vectors.ExportError):
                export_vectors.generate([kernel], datetime(2030, 1, 1, tzinfo=timezone.utc),
                    datetime(2030, 1, 1, 0, 0, 1, tzinfo=timezone.utc), 1, output)
            self.assertFalse(output.exists())

    def test_invalid_step_rejected(self):
        with self.assertRaises(export_vectors.ExportError):
            export_vectors.generate([], datetime.now(timezone.utc), datetime.now(timezone.utc), math.nan, Path("unused"))


if __name__ == "__main__":
    unittest.main()
