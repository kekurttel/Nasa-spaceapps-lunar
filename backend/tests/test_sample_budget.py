import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.routers import validate_window


class SampleBudgetTests(unittest.TestCase):
    def validate_hours(self, hours, site_count=1):
        start = datetime(2027, 1, 1, tzinfo=timezone.utc)
        end = start + timedelta(hours=hours)
        return validate_window(start.isoformat(), end.isoformat(), 1, site_count)

    def assert_budget_rejected(self, hours, site_count=1):
        with self.assertRaises(HTTPException) as error:
            self.validate_hours(hours, site_count)
        self.assertEqual(error.exception.status_code, 422)
        self.assertIn('100000 samples', error.exception.detail)

    def test_grid_endpoint_at_budget_allowed(self):
        self.validate_hours(99999)

    def test_grid_endpoint_over_budget_rejected(self):
        self.assert_budget_rejected(100000)

    def test_off_grid_endpoint_at_budget_allowed(self):
        self.validate_hours(99998.5)

    def test_off_grid_endpoint_over_budget_rejected(self):
        self.assert_budget_rejected(99999.5)

    def test_aggregate_grid_boundary(self):
        self.validate_hours(49999, site_count=2)
        self.assert_budget_rejected(50000, site_count=2)

    def test_aggregate_off_grid_boundary(self):
        self.validate_hours(49998.5, site_count=2)
        self.assert_budget_rejected(49999.5, site_count=2)


if __name__ == '__main__':
    unittest.main()
