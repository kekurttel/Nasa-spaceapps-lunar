import json
import os
import struct
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.science_router import dsn, layers, regions, router
from app.reference_data import DEFAULT_DATA_DIR


class ScienceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.env = patch.dict(os.environ, {"LUNANAV_DATA_DIR": str(self.root),
                                           "LUNANAV_WEB_DATA_DIR": str(self.root)})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.times = np.array([1793491200, 1793494800])
        self.write_npz()
        for name, values in [("psr.bin", [255, 128, 64, 255]),
                             ("thermal.bin", [100, 90, 255])]:
            # 2x2 grid, queried pole is row=1 col=1.
            (self.root / name).write_bytes(struct.pack("<Iff", 2, 240, 240) +
                                           b"".join(bytes([value]) * 4 for value in values))
        (self.root / "manifest.json").write_text(json.dumps({
            "regions": [{"name": "Example fixture", "rings": [[[0, 0], [1, 0], [1, 1], [0, 0]]]}],
            "sources": ["JPL DE440 generic claim must not leak"]}), encoding="utf-8")

    def write_npz(self, distance_kernel="de421.bsp"):
        np.savez(self.root / "dsn.npz", times=self.times, stations=np.array(["Goldstone"]),
                 moon_elevation_deg=np.array([[10., 30.]]), station_coords=np.array([[35., -116., 1001.]]),
                 ephemeris="de421.bsp")
        np.savez(self.root / "earth_distance.npz", times=self.times,
                 earth_moon_km=np.array([380000., 400000.]), ephemeris=distance_kernel)

    def assert_error(self, code, function, *args):
        with self.assertRaises(HTTPException) as caught:
            function(*args)
        self.assertEqual(caught.exception.status_code, code)
        return caught.exception.detail

    def test_router_paths(self):
        self.assertEqual({r.path for r in router.routes},
                         {"/api/science/dsn", "/api/science/dsn/windows", "/api/science/layers", "/api/science/regions"})

    def test_native_and_interpolation(self):
        native = dsn("2026-11-01T00:00:00Z")
        self.assertEqual(native["stations"][0]["moon_elevation_deg"], 10.)
        self.assertFalse(native["provenance"]["interpolated"])
        result = dsn("2026-11-01T02:30:00+02:00")
        self.assertEqual(result["stations"][0]["moon_elevation_deg"], 20.)
        self.assertEqual(result["earth_moon_km"], 390000.)
        self.assertTrue(result["provenance"]["interpolated"])
        self.assertEqual(result["provenance"]["ephemeris"], "de421.bsp")
        self.assertEqual(len(result["provenance"]["dsn_sha256"]), 64)
        self.assertNotIn("DE440", json.dumps(result))
        self.assertEqual(dsn("2026-11-01T01:00:00Z")["earth_moon_km"], 400000.)

    def test_dates_and_strict_coverage(self):
        self.assert_error(422, dsn, "not a date")
        self.assert_error(422, dsn, "2026-10-31T23:59:59Z")
        self.assert_error(422, dsn, "2026-11-01T01:00:01Z")
        np.savez(self.root / "earth_distance.npz", times=self.times + 1800,
                 earth_moon_km=np.array([380000., 400000.]), ephemeris="de421.bsp")
        self.assert_error(422, dsn, "2026-11-01T00:00:00Z")

    def test_no_missing_or_corrupt_fallback(self):
        (self.root / "dsn.npz").unlink()
        self.assert_error(503, dsn, "2026-11-01")
        self.write_npz(distance_kernel="de440.bsp")
        self.assert_error(503, dsn, "2026-11-01")
        self.write_npz()
        np.savez(self.root / "dsn.npz", times=[1, 1])
        self.assert_error(503, dsn, "2026-11-01")
        (self.root / "thermal.bin").write_bytes(b"bad")
        self.assert_error(503, layers, -90., 0.)
        (self.root / "psr.bin").unlink()
        self.assert_error(503, layers, -90., 0.)
        (self.root / "manifest.json").write_text("{}")
        self.assert_error(503, regions)
        (self.root / "manifest.json").unlink()
        self.assert_error(503, regions)

    def test_layer_scaling_and_sentinel(self):
        result = layers(-90., 0.)
        self.assertEqual(result["science"], {"psr": 1., "sun": 128 / 255,
                                             "earth": 64 / 255, "ice": .85})
        self.assertEqual(result["thermal"], {"avgK": 100, "maxK": 180, "iceM": None})
        self.assertEqual(result["provenance"]["grid"]["row"], 1)
        path = self.root / "thermal.bin"
        raw = bytearray(path.read_bytes())
        raw[-1] = 123
        path.write_bytes(raw)
        self.assertEqual(layers(-90., 0.)["thermal"]["iceM"], 1.23)
        self.assertIn("NaN as zero", result["provenance"]["limits"])

    def test_cell_orientation_matches_terrain_ts(self):
        path = self.root / "psr.bin"
        path.write_bytes(struct.pack("<Iff", 2, 240, 240) + bytes([1, 2, 3, 4]) * 4)
        # 120 m radius at 0E: upper right cell; 180E: lower right.
        lat = np.degrees(2 * np.arctan(120 / (2 * 1737400)) - np.pi / 2)
        self.assertEqual(layers(lat, 0.)["science"]["psr"], 2 / 255)
        self.assertEqual(layers(lat, 180.)["science"]["psr"], 4 / 255)

    def test_layer_coverage_and_grid_mismatch(self):
        for lat, lon in [(0, 0), (-80, 0), (float("nan"), 0), (-90, float("inf")), (-91, 0)]:
            self.assert_error(422, layers, lat, lon)
        (self.root / "thermal.bin").write_bytes(struct.pack("<Iff", 2, 120, 120) + bytes(12))
        self.assert_error(503, layers, -90., 0.)

    def test_regions_keep_native_coordinates_no_global_claim(self):
        result = regions()
        self.assertEqual(result["regions"][0]["rings"][0][1], [1, 0])
        self.assertIn("not [lon,lat]", result["provenance"]["coordinates"])
        self.assertNotIn("DE440", json.dumps(result))

    def test_actual_local_bundle(self):
        # Integration check: use supplied artifacts, never synthetic fallback.
        with patch.dict(os.environ, {"LUNANAV_DATA_DIR": str(DEFAULT_DATA_DIR),
                                    "LUNANAV_WEB_DATA_DIR": str(DEFAULT_DATA_DIR.parent / "web/public/data")}):
            with np.load(DEFAULT_DATA_DIR / "dsn.npz", allow_pickle=False) as a:
                from app.reference_data import iso
                result = dsn(iso(a["times"][0]))
                self.assertEqual(result["provenance"]["ephemeris"], a["ephemeris"].item())
                self.assertEqual(result["provenance"]["ephemeris"], "de421.bsp")
                self.assertEqual(result["stations"][0]["moon_elevation_deg"], float(a["moon_elevation_deg"][0, 0]))
            self.assertTrue(0 <= layers(-90., 0.)["science"]["ice"] <= .85)
            self.assertEqual(len(regions()["regions"]), 9)


if __name__ == "__main__":
    unittest.main()
