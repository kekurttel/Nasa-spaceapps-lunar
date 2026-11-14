"""Offline unit tests using fake SPICE interface; no accuracy claim is made."""
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
        self.unloaded = []

    def furnsh(self, path):
        self.loaded.append(path)

    def unload(self, path):
        self.unloaded.append(path)

    def str2et(self, timestamp):
        self.calls.append(("str2et", timestamp))
        return len(self.calls) * 10.0

    def spkpos(self, target, et, frame, correction, observer):
        self.calls.append((target, frame, correction, observer))
        return ((et, et + 1, et + 2), 0.0)


class ExportVectorsTests(unittest.TestCase):
    def test_utc_must_be_explicit_and_valid(self):
        self.assertEqual(export_vectors.parse_utc("2030-01-01T00:00:00Z", "start").tzinfo, timezone.utc)
        for value in ("2030-01-01T00:00:00", "2030-02-30T00:00:00Z"):
            with self.assertRaises(export_vectors.ExportError):
                export_vectors.parse_utc(value, "start")

    def test_exports_schema_unloads_own_kernels_and_uses_atomic_file(self):
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
            self.assertEqual(data["kernels"][0]["file"], "mock.bsp")
            self.assertEqual(fake.loaded, [kernel.name])
            self.assertEqual(fake.unloaded, [kernel.name])
            self.assertFalse(list(root.glob("*.tmp")))

    def test_failure_unloads_and_does_not_create_success_file(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            kernel, output = root / "mock.bsp", root / "out.json"
            kernel.touch()
            fake = FakeSpice()
            fake.spkpos = lambda *args: (_ for _ in ()).throw(RuntimeError("no coverage"))
            with patch.dict("sys.modules", {"spiceypy": fake}), self.assertRaises(export_vectors.ExportError):
                export_vectors.generate([kernel], datetime(2030, 1, 1, tzinfo=timezone.utc),
                    datetime(2030, 1, 1, 0, 0, 1, tzinfo=timezone.utc), 1, output)
            self.assertFalse(output.exists())
            self.assertEqual(fake.unloaded, [kernel.name])

    def test_rejects_submillisecond_or_fractional_millisecond_step(self):
        start = datetime(2030, 1, 1, tzinfo=timezone.utc)
        for step in (0, -1, math.nan, math.inf, 0.0001, 0.0005, 0.0015, 1.0001):
            with self.subTest(step=step), self.assertRaises(export_vectors.ExportError):
                export_vectors.generate([], start, start.replace(second=1), step, Path("unused"))

    def test_rejects_unaligned_times_excessive_samples_and_invalid_vectors(self):
        start = datetime(2030, 1, 1, tzinfo=timezone.utc)
        with self.assertRaisesRegex(export_vectors.ExportError, "whole milliseconds"):
            export_vectors.generate([], start.replace(microsecond=1), start.replace(second=1), 1, Path("unused"))
        with self.assertRaisesRegex(export_vectors.ExportError, "maximum"):
            export_vectors.generate([], start, start + export_vectors.timedelta(seconds=101), 0.001, Path("unused"))
        for invalid in ((1, 2), (1, math.inf, 3), (1, "bad", 3)):
            with self.subTest(invalid=invalid), self.assertRaises(export_vectors.ExportError):
                export_vectors._validate_vector(invalid, "SUN")


if __name__ == "__main__":
    unittest.main()
