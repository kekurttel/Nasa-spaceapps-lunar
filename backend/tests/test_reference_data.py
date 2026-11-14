import asyncio
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.reference_data import catalog, reference_ephemeris, load_series, utc_datetime, status
from app.models import EphemerisRequest
from app.routers import compute_ephemeris, terrain, validate_window
from fastapi import HTTPException


class ReferenceTests(unittest.TestCase):
    def setUp(self):
        self.site = next(s for s in catalog() if s['id'] == 'shackleton_ridge')
        self.start = utc_datetime('2026-11-01T00:00:00Z')
        self.end = utc_datetime('2026-11-01T02:00:00Z')

    def test_native_values_preserved(self):
        points, meta = reference_ephemeris(self.site['lat'], self.site['lon'], self.start, self.end, 1)
        native = load_series(self.site['id'])
        self.assertEqual(points[0]['sun_elevation'], float(native['sun_alt'][0]))
        self.assertEqual(points[0]['sun_visible_fraction'], float(native['sun_fraction'][0]))
        self.assertEqual(points[0]['earth_visible'], bool(native['earth_visible'][0]))
        self.assertFalse(meta['interpolated'])
        self.assertEqual(len(meta['series_sha256']), 64)

    def test_quarter_hour_marked_interpolated(self):
        points, meta = reference_ephemeris(self.site['lat'], self.site['lon'], self.start, self.end, .25)
        self.assertEqual(len(points), 9)
        self.assertTrue(meta['interpolated'])
        self.assertTrue(all(0 <= p['sun_visible_fraction'] <= 1 for p in points))

    def test_no_snapping_or_extrapolation(self):
        self.assertIsNone(reference_ephemeris(self.site['lat'] + .001, self.site['lon'], self.start, self.end, 1))
        self.assertIsNone(reference_ephemeris(self.site['lat'], self.site['lon'], utc_datetime('2026-01-01'), self.end, 1))

    def test_api_contract_and_duration(self):
        request = EphemerisRequest(sites=[self.site], start_date='2026-11-01', end_date='2026-11-02', step_hours=.25)
        response = asyncio.run(compute_ephemeris(request))
        self.assertEqual(response.step_hours, .25)
        self.assertEqual(response.sites[0].summary.total_hours, 24)
        self.assertEqual(len(response.sites[0].data), 97)
        self.assertIn('INTERPOLATED', response.source)
        self.assertEqual(response.sites[0].provenance['site_id'], 'shackleton_ridge')

    def test_terrain_and_invalid_id(self):
        profile = asyncio.run(terrain('shackleton_ridge'))
        self.assertEqual(len(profile['azimuths_deg']), len(profile['elevations_deg']))
        with self.assertRaises(HTTPException):
            asyncio.run(terrain('../sites'))

    def test_validation(self):
        for first, last in [('bad', '2026-11-02'), ('2026-11-02', '2026-11-01')]:
            with self.assertRaises(HTTPException):
                validate_window(first, last, .25)
        self.assertEqual(utc_datetime('2026-11-01T02:00:00+02:00'), self.start)

    def test_strict_rejection(self):
        request = EphemerisRequest(sites=[{'lat': 0, 'lon': 0}], start_date='2026-11-01', end_date='2026-11-02')
        with self.assertRaises(HTTPException) as error:
            asyncio.run(compute_ephemeris(request))
        self.assertEqual(error.exception.status_code, 422)
        with tempfile.TemporaryDirectory() as path, patch.dict(os.environ, {'LUNANAV_DATA_DIR': path}):
            with self.assertRaises(HTTPException) as error:
                asyncio.run(compute_ephemeris(request))
            self.assertEqual(error.exception.status_code, 503)

    def test_default_path(self):
        from app.reference_data import DEFAULT_DATA_DIR
        self.assertEqual(DEFAULT_DATA_DIR, Path(__file__).resolve().parents[2] / 'data' / 'lunanav' / 'data')
        self.assertTrue(DEFAULT_DATA_DIR.is_dir())

    def test_missing_bundle(self):
        with tempfile.TemporaryDirectory() as path, patch.dict(os.environ, {'LUNANAV_DATA_DIR': path}):
            self.assertFalse(status()['available'])
            self.assertEqual(catalog(), [])


if __name__ == '__main__':
    unittest.main()
