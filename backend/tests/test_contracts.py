import asyncio
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.contracts import Scenario, UNVERIFIED_FRAME
from app.contracts_router import capabilities, local_analysis, router
from app.reference_data import catalog


class ContractTests(unittest.TestCase):
    def setUp(self):
        self.site = next(s for s in catalog() if s["id"] == "shackleton_ridge")
        self.payload = {
            "id": "test", "site": {
                "id": self.site["id"], "name": self.site["name"],
                "latDeg": self.site["lat"], "lonDeg": self.site["lon"],
                "surfaceElevationM": None, "observerHeightM": 2,
                "kind": "reference", "sourceIds": ["caller-label"],
            },
            "startUtc": "2026-11-01T00:00:00Z", "endUtc": "2026-11-01T02:00:00Z",
            "stepSeconds": 900,
        }

    def analyze(self):
        return asyncio.run(local_analysis(Scenario(**self.payload)))

    def test_parallel_arrays_and_native_summary(self):
        response = self.analyze()
        arrays = response.series.model_dump()
        self.assertEqual({len(a) for a in arrays.values()}, {9})
        self.assertEqual(arrays["sunRadiusDeg"], [None] * 9)
        self.assertTrue(all(0 <= f <= 1 for f in arrays["sunVisibleFraction"]))
        self.assertEqual(response.summary["total_hours"], 2)
        self.assertFalse(response.skySeriesCompatible)
        self.assertEqual(response.provenance["frame"], UNVERIFIED_FRAME)
        self.assertFalse(response.provenance["frameVerified"])
        self.assertTrue(response.provenance["interpolated"])
        self.assertEqual(len(response.provenance["series_sha256"]), 64)
        self.assertFalse(response.provenance["sourceIdsVerified"])

    def test_rejects_frames_heights_elevations_and_unknown_fields(self):
        for frame in ["IAU_MOON", "MOON_ME_DE421"]:
            with self.subTest(frame=frame), self.assertRaises(ValidationError):
                Scenario(**dict(self.payload, frame=frame))
        for field, value in [("observerHeightM", 0), ("observerHeightM", 2.001),
                             ("surfaceElevationM", 0), ("surfaceElevationM", -100)]:
            site = dict(self.payload["site"], **{field: value})
            with self.subTest(field=field, value=value), self.assertRaises(ValidationError):
                Scenario(**dict(self.payload, site=site))
        with self.assertRaises(ValidationError):
            Scenario(**dict(self.payload, requestedFrame="IAU_MOON"))

    def test_strict_time_and_step(self):
        for value in ["2026-11-01", "2026-11-01T00:00:00", "2026-11-01T00:00:00+00:00",
                      "2026-11-31T00:00:00Z"]:
            with self.subTest(value=value), self.assertRaises(ValidationError):
                Scenario(**dict(self.payload, startUtc=value))
        for field, value in [("endUtc", self.payload["startUtc"]), ("endUtc", "2026-10-31T00:00:00Z"),
                             ("stepSeconds", 0), ("stepSeconds", 899), ("stepSeconds", float("nan"))]:
            with self.subTest(field=field, value=value), self.assertRaises(ValidationError):
                Scenario(**dict(self.payload, **{field: value}))

    def test_exact_profile_identity(self):
        for changes in [{"id": "unknown"}, {"latDeg": self.site["lat"] + 1e-8},
                        {"lonDeg": self.site["lon"] + 1e-8}]:
            self.payload["site"] = dict(self.payload["site"], **changes)
            with self.assertRaises(HTTPException) as error:
                self.analyze()
            self.assertEqual(error.exception.status_code, 422)
            self.setUp()

    def test_no_extrapolation_or_missing_data_fallback(self):
        self.payload["startUtc"] = "2020-01-01T00:00:00Z"
        self.payload["endUtc"] = "2020-01-01T02:00:00Z"
        with self.assertRaises(HTTPException) as error:
            self.analyze()
        self.assertEqual(error.exception.status_code, 422)
        with patch("app.contracts_router.catalog", return_value=[]):
            with self.assertRaises(HTTPException) as error:
                self.analyze()
            self.assertEqual(error.exception.status_code, 503)

    def test_native_height_checked(self):
        altered = dict(self.site, profile=dict(self.site["profile"], observer_height_m=3))
        with patch("app.contracts_router.catalog", return_value=[altered]):
            with self.assertRaises(HTTPException) as error:
                self.analyze()
            self.assertEqual(error.exception.status_code, 422)

    def test_http_routes(self):
        app = FastAPI()
        app.include_router(router)
        with TestClient(app) as client:
            self.assertEqual(client.get("/api/contracts/capabilities").status_code, 200)
            response = client.post("/api/contracts/local-analysis", json=self.payload)
            self.assertEqual(response.status_code, 200, response.text)
            self.assertFalse(response.json()["skySeriesCompatible"])
            for frame in ["IAU_MOON", "MOON_ME_DE421"]:
                response = client.post("/api/contracts/local-analysis", json=dict(self.payload, frame=frame))
                self.assertEqual(response.status_code, 422)

    def test_capabilities_honest(self):
        result = asyncio.run(capabilities())
        self.assertFalse(result["frameTransformations"])
        self.assertFalse(result["externalEnginesExecuted"])
        self.assertFalse(result["skySeriesCompatible"])


if __name__ == "__main__":
    unittest.main()
