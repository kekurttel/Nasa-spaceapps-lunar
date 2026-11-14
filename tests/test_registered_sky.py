import hashlib
import importlib.util
import json
import math
from pathlib import Path
import unittest

import spiceypy as spice

MODULE = Path(__file__).parents[1] / "src" / "features" / "visibility" / "registered-sky.py"
spec = importlib.util.spec_from_file_location("registered_sky", MODULE)
registered_sky = importlib.util.module_from_spec(spec)
spec.loader.exec_module(registered_sky)
ROOT = Path(__file__).parents[1]
KERNELS = ROOT / "data" / "kernels"
TERRAIN_HASH = "a" * 64


def independent_expected(et, latitude_deg, longitude_deg, surface_height_m, observer_height_m):
    radius_km = (1_737_400 + surface_height_m + observer_height_m) / 1000
    lat, lon = math.radians(latitude_deg), math.radians(longitude_deg)
    radial = (math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat))
    moon_j2000, _ = spice.spkpos("MOON", et, "J2000", "NONE", "SOLAR SYSTEM BARYCENTER")
    rotation = spice.pxform("J2000", registered_sky.BODY_FRAME, et)
    observer = tuple(radius_km * x for x in radial)
    axes = ((-math.sin(lat) * math.cos(lon), -math.sin(lat) * math.sin(lon), math.cos(lat)),
            (-math.sin(lon), math.cos(lon), 0.0), radial)
    expected = {}
    for body, key in (("SUN", "sun"), ("EARTH", "earth")):
        body_j2000, _ = spice.spkpos(body, et, "J2000", "NONE", "SOLAR SYSTEM BARYCENTER")
        relative = tuple(body_j2000[i] - moon_j2000[i] for i in range(3))
        fixed = tuple(sum(rotation[i][j] * relative[j] for j in range(3)) - observer[i] for i in range(3))
        north, east, up = (sum(fixed[i] * axis[i] for i in range(3)) for axis in axes)
        distance = math.sqrt(north * north + east * east + up * up)
        expected[key] = (math.degrees(math.atan2(east, north)) % 360,
                         math.degrees(math.atan2(up, math.hypot(north, east))))
        if key == "sun":
            expected["sunRadius"] = math.degrees(math.asin(695_700 / distance))
    return expected


class GeometryTests(unittest.TestCase):
    def test_local_basis_at_equator_prime_meridian(self):
        north, east, up = registered_sky.local_basis(0, 0)
        self.assertEqual(north, (0.0, 0.0, 1.0))
        self.assertEqual(east, (0.0, 1.0, 0.0))
        self.assertEqual(up, (1.0, 0.0, 0.0))

    def test_cardinal_topocentric_direction(self):
        observer = (0.0, 0.0, 0.0)
        basis = registered_sky.local_basis(0, 0)
        north = registered_sky.project_direction((0, 0, 1), observer, basis)
        east = registered_sky.project_direction((0, 1, 0), observer, basis)
        up = registered_sky.project_direction((1, 0, 0), observer, basis)
        self.assertAlmostEqual(north[0], 0)
        self.assertAlmostEqual(north[1], 0)
        self.assertAlmostEqual(east[0], 90)
        self.assertAlmostEqual(east[1], 0)
        self.assertAlmostEqual(up[1], 90)

    def test_radius_and_utc_validation(self):
        self.assertAlmostEqual(registered_sky.observer_radius_km(10, 2), 1737.412)
        for invalid in ("2026-01-01 00:00:00", "not-a-time", "2026-02-30T00:00:00Z"):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                registered_sky.validate_utc(invalid)

    def test_kernel_manifest_is_authentic_de421_and_all_files_match(self):
        manifest = json.loads((KERNELS / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest.get("ephemeris"), "DE421")
        self.assertEqual({item["fileName"] for item in manifest["files"]}, set(registered_sky.REQUIRED_KERNELS))
        for item in manifest["files"]:
            raw = (KERNELS / item["fileName"]).read_bytes()
            self.assertEqual(len(raw), item["bytes"], item["fileName"])
            self.assertEqual(hashlib.sha256(raw).hexdigest(), item["sha256"], item["fileName"])
        self.assertEqual(set(registered_sky.kernel_manifest_hashes(KERNELS)), set(registered_sky.REQUIRED_KERNELS))

    def test_real_generate_matches_independent_j2000_rotation_for_two_times(self):
        times = ["2000-01-01T12:00:00Z", "2026-11-14T00:00:00Z"]
        request = {"scenarioId": "test", "siteId": "equator", "latitudeDeg": 0,
                   "longitudeDeg": 0, "observerHeightM": 2, "surfaceHeightM": 1200,
                   "terrainSha256": TERRAIN_HASH, "frame": registered_sky.FRAME, "timesUtc": times}
        spice.kclear()
        for kernel in registered_sky.REQUIRED_KERNELS:
            spice.furnsh(str(KERNELS / kernel))
        expected_by_time = [independent_expected(spice.str2et(time), 0, 0, 1200, 2) for time in times]
        spice.kclear()
        sky = registered_sky.generate(request, KERNELS)
        self.assertEqual(sky["timesUtc"], times)
        for index, expected in enumerate(expected_by_time):
            for series, key, component in (("sunAzDeg", "sun", 0), ("sunAltDeg", "sun", 1),
                                           ("earthAzDeg", "earth", 0), ("earthAltDeg", "earth", 1)):
                self.assertAlmostEqual(sky[series][index], expected[key][component], places=8)
            self.assertAlmostEqual(sky["sunRadiusDeg"][index], expected["sunRadius"], places=8)
        self.assertEqual(sky["quality"]["frame"], registered_sky.FRAME)
        self.assertEqual(sky["registration"]["aberrationCorrection"], "NONE")

    def test_generate_real_southern_polar_site(self):
        time = "2026-11-14T00:00:00Z"
        request = {"scenarioId": "test", "siteId": "south-pole", "latitudeDeg": -89.9,
                   "longitudeDeg": 180, "observerHeightM": 2, "surfaceHeightM": -1200,
                   "terrainSha256": TERRAIN_HASH, "frame": registered_sky.FRAME, "timesUtc": [time]}
        spice.kclear()
        spice.furnsh(str(KERNELS / "naif0012.tls"))
        spice.furnsh(str(KERNELS / "de421.bsp"))
        spice.furnsh(str(KERNELS / "moon_080317.tf"))
        spice.furnsh(str(KERNELS / "moon_pa_de421_1900-2050.bpc"))
        expected = independent_expected(spice.str2et(time), -89.9, 180, -1200, 2)
        spice.kclear()
        sky = registered_sky.generate(request, KERNELS)
        self.assertAlmostEqual(sky["sunAzDeg"][0], expected["sun"][0], places=8)
        self.assertAlmostEqual(sky["sunAltDeg"][0], expected["sun"][1], places=8)
        self.assertAlmostEqual(sky["earthAzDeg"][0], expected["earth"][0], places=8)
        self.assertAlmostEqual(sky["earthAltDeg"][0], expected["earth"][1], places=8)

    def test_height_change_changes_earth_parallax_as_expected(self):
        time = "2026-11-14T00:00:00Z"
        base = {"scenarioId": "test", "siteId": "polar", "latitudeDeg": 89,
                "longitudeDeg": 33, "observerHeightM": 2, "surfaceHeightM": 0,
                "terrainSha256": TERRAIN_HASH, "frame": registered_sky.FRAME, "timesUtc": [time]}
        spice.kclear()
        for kernel in registered_sky.REQUIRED_KERNELS:
            spice.furnsh(str(KERNELS / kernel))
        et = spice.str2et(time)
        low_expected = independent_expected(et, 89, 33, 0, 2)["earth"][1]
        high_expected = independent_expected(et, 89, 33, 0, 1002)["earth"][1]
        spice.kclear()
        low = registered_sky.generate(base, KERNELS)
        high = registered_sky.generate({**base, "observerHeightM": 1002}, KERNELS)
        self.assertAlmostEqual(low["earthAltDeg"][0], low_expected, places=8)
        self.assertAlmostEqual(high["earthAltDeg"][0], high_expected, places=8)
        self.assertNotAlmostEqual(low["earthAltDeg"][0], high["earthAltDeg"][0], places=8)

    def test_generate_rejects_invalid_nonmonotonic_and_oversized_times(self):
        base = {"scenarioId": "test", "siteId": "site", "latitudeDeg": 0,
                "longitudeDeg": 0, "observerHeightM": 2, "surfaceHeightM": 0,
                "terrainSha256": TERRAIN_HASH, "frame": registered_sky.FRAME}
        with self.assertRaisesRegex(ValueError, "invalid UTC time"):
            registered_sky.generate({**base, "timesUtc": ["2026-02-30T00:00:00Z"]}, KERNELS)
        with self.assertRaisesRegex(ValueError, "strictly increasing"):
            registered_sky.generate({**base, "timesUtc": ["2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"]}, KERNELS)
        with self.assertRaisesRegex(ValueError, "at most 10000"):
            registered_sky.generate({**base, "timesUtc": ["2026-01-01T00:00:00Z"] * 10001}, KERNELS)
