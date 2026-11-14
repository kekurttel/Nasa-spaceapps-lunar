"""HTTP end-to-end contracts for both default supported observation sites."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from app.main import app


def test_default_scenarios_over_http():
    with TestClient(app) as client:
        presets = client.get('/api/presets').json()
        for site_id in ('shackleton_ridge', 'malapert_massif'):
            site = next(item for item in presets if item['id'] == site_id)
            response = client.post('/api/ephemeris', json={
                'sites': [{key: site[key] for key in ('name', 'lat', 'lon')}],
                'start_date': '2027-01-01T00:00:00Z',
                'end_date': '2027-01-08T00:00:00Z',
                'step_hours': 1,
            })
            assert response.status_code == 200, response.text
            result = response.json()['sites'][0]
            assert result['provenance']['site_id'] == site_id
            assert len(result['data']) == 169
            assert result['summary']['total_hours'] == 168
            assert 0 <= result['summary']['sun_percentage'] <= 100
            profile = client.get('/api/terrain/' + site_id)
            assert profile.status_code == 200
            assert len(profile.json()['elevations_deg']) == 360
        unsupported = client.post('/api/ephemeris', json={
            'sites': [{'lat': -89.4, 'lon': -137}],
            'start_date': '2027-01-01T00:00:00Z',
            'end_date': '2027-01-08T00:00:00Z',
            'step_hours': 1,
        })
        assert unsupported.status_code == 422
