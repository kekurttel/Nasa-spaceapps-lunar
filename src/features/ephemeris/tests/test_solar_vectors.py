"""Run with unittest; real integration tests require SOLAR_KERNELS_DIR."""
import hashlib
from datetime import datetime, timedelta
import json
import math
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import generate_solar_vectors as generator
import solar_coverage as coverage
import spiceypy as spice


class InputTests(unittest.TestCase):
    def test_strict_dates(self):
        for value in [None, 123, "2024-01-01", "2024-01-01T00:00Z", "2024-01-01T00:00:00+00:00", "2024-02-30T00:00:00Z", "2016-12-31T23:59:60Z", "2024-01-01T00:00:00.1234Z", "0000-01-01T00:00:00Z"]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                generator.validate_utc(value)
        for value in ["2024-02-29T12:00:00Z", "2024-02-29T12:00:00.1Z", "2024-02-29T12:00:00.123Z"]:
            self.assertEqual(generator.validate_utc(value), value)

    def test_request_rejection_before_loading(self):
        with self.assertRaisesRegex(ValueError, "unknown request"):
            generator.generate({"timesUtc": ["2000-01-01T00:00:00Z"], "aberrationCorection": "LT"}, "nonexistent")
        for request in [None, {}, {"timesUtc": []}, {"timesUtc": ["2000-01-01T00:00:00Z"] * 100001}, {"timesUtc": ["2000-01-01T00:00:00Z"] * 2}, {"timesUtc": ["2001-01-01T00:00:00Z", "2000-01-01T00:00:00Z"]}, {"timesUtc": ["2000-01-01T00:00:00Z"], "frame": "IAU_MOON"}]:
            with self.subTest(request_type=type(request)), self.assertRaises(ValueError):
                generator.generate(request, "nonexistent")

    def test_atomic_output_failure_preserves_existing(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "output.json"
            output.write_text("original", encoding="utf-8")
            with self.assertRaises(ValueError):
                generator.atomic_write_json(output, {"bad": float("nan")})
            self.assertEqual(output.read_text(), "original")
            self.assertEqual(list(Path(directory).iterdir()), [output])
            generator.atomic_write_json(output, {"good": True})
            self.assertEqual(json.loads(output.read_text()), {"good": True})

    def test_interval_intersection_preserves_gaps(self):
        self.assertEqual(coverage.intersect([[0, 10], [20, 30]], [[5, 25]]), [[5, 10], [20, 25]])
        self.assertFalse(coverage.contains([[0, 10], [20, 30]], 15))


@unittest.skipUnless(os.environ.get("SOLAR_KERNELS_DIR"), "set SOLAR_KERNELS_DIR for real DE421 tests")
class RealKernelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = Path(os.environ["SOLAR_KERNELS_DIR"])

    def test_real_vectors_direct_spice_and_pool_cleanup(self):
        before_cwd, before_count = Path.cwd(), spice.ktotal("ALL")
        times = ["2000-01-01T00:00:00Z", "2009-07-01T12:00:00.123Z", "2019-01-01T00:00:00Z"]
        result = generator.generate({"timesUtc": times}, self.directory)
        self.assertEqual(Path.cwd(), before_cwd)
        self.assertEqual(spice.ktotal("ALL"), before_count)
        self.assertEqual(result["frame"], "MOON_ME_DE421")
        self.assertEqual(result["dataKind"], "real")
        with coverage.kernel_context(self.directory):
            for i, timestamp in enumerate(times):
                position, _ = spice.spkpos("SUN", spice.str2et(timestamp), "MOON_ME_DE421", "NONE", "MOON")
                got = result["sunPositionMoonFixedKm"][i]
                for axis, expected in zip("xyz", position):
                    self.assertAlmostEqual(got[axis], expected, places=7)
                distance = math.hypot(*position)
                self.assertAlmostEqual(result["sunDistanceKm"][i], distance, places=7)
                self.assertAlmostEqual(result["sunAngularRadiusDeg"][i], math.degrees(math.asin(695700/distance)), places=12)

    def test_coverage_and_study(self):
        report = coverage.measure(self.directory)
        self.assertEqual(report["spkCenterChains"], {"10": [10, 0], "301": [301, 3, 0]})
        self.assertTrue(report["verifiedStudy"]["supported"])
        self.assertGreaterEqual(report["verifiedStudy"]["durationJulianYears"], 18.6)
        for window in report["conservativeUtcIntervals"]:
            generated = generator.generate({"timesUtc": [window["startUtc"], window["endUtc"]]}, self.directory)
            self.assertEqual(len(generated["sunDistanceKm"]), 2)
            for key, delta in [("startUtc", -1), ("endUtc", 1)]:
                edge = datetime.fromisoformat(window[key][:-1] + "+00:00") + timedelta(milliseconds=delta)
                # Conservative public bounds are strict even if native kernel coverage has extra margin.
                outside = edge.isoformat(timespec="milliseconds").replace("+00:00", "Z")
                with self.assertRaises(ValueError):
                    generator.generate({"timesUtc": [outside]}, self.directory)
        for timestamp in ["1800-01-01T00:00:00Z", "2100-01-01T00:00:00Z"]:
            with self.assertRaises(ValueError):
                generator.generate({"timesUtc": [timestamp]}, self.directory)

    def test_cleanup_on_spice_failure(self):
        before = Path.cwd(), spice.ktotal("ALL")
        with patch.object(coverage, "measure_loaded", side_effect=RuntimeError("injected")):
            with self.assertRaises(RuntimeError):
                coverage.measure(self.directory)
        self.assertEqual((Path.cwd(), spice.ktotal("ALL")), before)

    def test_tampered_manifest_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = json.loads((self.directory / "manifest.json").read_text())
            name = coverage.REQUIRED_KERNELS[0]
            (root / name).write_bytes((self.directory / name).read_bytes())
            manifest["files"][0]["sha256"] = "0" * 64
            (root / "manifest.json").write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError, "SHA-256"):
                coverage.verify_kernels(root)


if __name__ == "__main__":
    unittest.main()
