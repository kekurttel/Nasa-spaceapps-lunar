import unittest

import numpy as np

from src.features.visibility.illumination_geometry import ecef_position, surface_normal, disk_directions


class IlluminationGeometryTests(unittest.TestCase):
    def test_ecef_position_on_reference_sphere(self):
        np.testing.assert_allclose(ecef_position(0, 0, 0, 1_737_400), [1_737_400, 0, 0])

    def test_flat_sphere_normal_points_outward(self):
        normal = surface_normal(np.zeros((5, 5)), 2, 2, 80, 1_737_400)
        self.assertGreater(normal[2], 0.999)
        self.assertAlmostEqual(np.linalg.norm(normal), 1.0)

    def test_disk_samples_are_deterministic_and_unit_vectors(self):
        first = disk_directions([1, 0, 0], 0.01, 19)
        second = disk_directions([1, 0, 0], 0.01, 19)
        np.testing.assert_array_equal(first, second)
        np.testing.assert_allclose(np.linalg.norm(first, axis=1), 1.0)


if __name__ == "__main__":
    unittest.main()
