import math
import unittest

import numpy as np

from src.features.visibility.illumination_engine import compute_tile
from src.features.visibility.illumination_terrain import Terrain


class SyntheticTerrain(Terrain):
    def __init__(self, heights, nodata=None):
        self.heights = np.asarray(heights, dtype=float)
        self.nodata = nodata
        self.radius_m = 1_737_400.0

    def sample_height(self, row, col):
        if row < 0 or col < 0 or row >= self.heights.shape[0] - 1 or col >= self.heights.shape[1] - 1:
            return math.nan
        r, c = int(round(row)), int(round(col))
        if self.nodata == (r, c):
            return math.nan
        return float(self.heights[r, c])


def sun(position, radius=0.01):
    p = np.asarray(position, dtype=float)
    return {"utc": "2026-11-14T00:00:00Z", "frame": "MOON_ME_DE421", "positionM": p,
            "distanceM": float(np.linalg.norm(p)), "solarAngularRadiusRad": radius,
            "source": {"ephemeris": "DE421", "aberrationCorrection": "NONE", "kernelHashes": {}}}


class IlluminationEngineTests(unittest.TestCase):
    def test_flat_terrain_and_window_return_contract_arrays(self):
        result = compute_tile(SyntheticTerrain(np.zeros((8, 8))), sun([0, 0, 2e8]), (2, 2, 2, 3))
        self.assertEqual(result["elevationM"].shape, (2, 3))
        self.assertEqual(result["coverageStatus"].dtype, np.uint8)
        self.assertTrue(np.all(result["solarDiskVisibleFraction"] == 1))

    def test_center_self_shadow_does_not_suppress_illuminated_disk_limb(self):
        # Center direction tangent to this facet; upper half of the disk has positive cosine.
        terrain = SyntheticTerrain(np.zeros((10, 10)))
        result = compute_tile(terrain, sun([2e8, 0, 0], radius=0.02), (4, 4, 1, 1), disk_samples=19)
        self.assertEqual(result["selfShadowed"][0, 0], 1)
        self.assertGreater(result["relativeDirectIrradiance"][0, 0], 0)
        self.assertGreater(result["solarDiskVisibleFraction"][0, 0], 0.99)

    def test_out_of_footprint_ray_is_unknown_not_clear(self):
        result = compute_tile(SyntheticTerrain(np.zeros((3, 3))), sun([0, 0, 2e8]), (1, 1, 1, 1))
        self.assertEqual(result["shadowClass"][0, 0], 0)
        self.assertTrue(np.isnan(result["solarDiskVisibleFraction"][0, 0]))

    def test_rejects_inconsistent_sun_distance(self):
        invalid = sun([0, 0, 2e8])
        invalid["distanceM"] = 1.0
        with self.assertRaises(ValueError):
            compute_tile(SyntheticTerrain(np.zeros((6, 6))), invalid, (2, 2, 1, 1))


if __name__ == "__main__":
    unittest.main()
