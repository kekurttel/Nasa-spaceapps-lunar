"""Real binary bundle tests; no synthetic ephemeris substituted."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from datetime import datetime, timezone

import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.mission_router import router
from app.mission_search import (
    MAX_WORK, MissionSearchRequest, capabilities, data_root, evaluate_windows,
    load_data, point_sky, search,
)


@pytest.fixture(scope="module")
def client():
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_real_bundle_capabilities(client):
    response = client.get("/api/mission/capabilities")
    assert response.status_code == 200
    c = response.json()
    assert c["atlas_points"] == 21856
    assert c["step_hours"] == 1
    assert c["dsn_geometric_available"]
    assert "2026-11-01" in c["start_utc"]


@pytest.mark.parametrize("case_number", range(18))
def test_matches_upstream_engine_expected(case_number):
    d = load_data()
    cases = json.loads((data_root() / "engine_expected.json").read_text())
    e = cases[case_number]
    q = MissionSearchRequest(**{
        "min_sun_pct": 70, "min_earth_pct": 50, "duration_days": 14,
        "n_starts": e["nStarts"], "need_dsn": e["needDsn"],
    })
    sun, earth = point_sky(d, [e["index"]], e["firstHour"], (e["nStarts"]-1)*24+336, e["needDsn"])
    windows = [evaluate_windows(sun[:, s*24:s*24+336], earth[:, s*24:s*24+336], q)
               for s in range(e["nStarts"])]
    best_index = max(range(len(windows)), key=lambda s: windows[s]["score"][0])
    best = windows[best_index]
    assert d["lat"][e["index"]] == pytest.approx(e["lat"], abs=1e-9)
    assert d["lon"][e["index"]] == pytest.approx(e["lon"], abs=1e-9)
    assert sum(int(w["go"][0]) for w in windows) == e["goCount"]
    assert best_index == e["bestStart"]
    assert bool(best["go"][0]) == e["bestGo"]
    assert best["score"][0] == pytest.approx(e["bestScore"], abs=.1)
    assert best["sun"][0] == pytest.approx(e["sunFrac"], abs=1e-9)
    assert best["earth"][0] == pytest.approx(e["commFrac"], abs=1e-9)
    assert best["dark"][0] == e["longestDarkH"]


def test_search_all_real_points(client):
    q = dict(start_date="2027-09-08", duration_days=1, max_slope_deg=90,
             min_sun_pct=0, min_earth_pct=0, max_dark_hours=24,
             load_w=0, min_soc=0, limit=5)
    response = client.post("/api/mission/search", json=q)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["evaluated_points"] == 21856
    assert result["feasible_points"] == 21856
    assert len(result["results"]) == 5
    assert result["work_units"] <= MAX_WORK
    assert all(r["go"] for r in result["results"])
    scores = [r["score"] for r in result["results"]]
    assert scores == sorted(scores, reverse=True)
    # Verify a returned result against an independent one-point evaluation.
    r = result["results"][0]
    d = load_data()
    first = round((datetime(2027, 9, 8, tzinfo=timezone.utc).timestamp()-d["manifest"]["start_unix"])/3600)
    sun, earth = point_sky(d, [r["index"]], first, 24)
    assert r["sun_pct"] == pytest.approx(np.mean(sun >= .5)*100)
    assert r["earth_pct"] == pytest.approx(np.mean(earth)*100)


def test_slope_filter_and_infeasible():
    result = search(MissionSearchRequest(duration_days=1, max_slope_deg=0,
                                        include_infeasible=True, limit=3))
    assert result["evaluated_points"] < 21856
    assert all(r["slope_deg"] == 0 for r in result["results"])


@pytest.mark.parametrize("patch", [
    {"start_date": "2020-01-01"}, {"start_date": "bad"},
    {"start_date": "2026-11-01T00:30:00Z"}, {"duration_days": .01},
    {"duration_days": 30, "n_starts": 31, "max_slope_deg": 90},
    {"min_sun_pct": 101}, {"duration_days": 0}, {"limit": 101},
    {"min_soc": 1}, {"unknown": 1},
])
def test_rejects_invalid_or_unbounded(client, patch):
    response = client.post("/api/mission/search", json=patch)
    assert response.status_code == 422


def test_busy_rejected(client):
    from app.mission_router import _search_slot
    _search_slot.acquire()
    try:
        assert client.post("/api/mission/search", json={}).status_code == 429
    finally:
        _search_slot.release()
