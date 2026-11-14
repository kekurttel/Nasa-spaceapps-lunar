import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from unittest.mock import patch

import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.reference_data import DEFAULT_DATA_DIR, iso
from app.science_router import router

app = FastAPI()
app.include_router(router)
client = TestClient(app)


def test_actual_bundle():
    with patch.dict(os.environ, {'LUNANAV_DATA_DIR': str(DEFAULT_DATA_DIR)}):
        with np.load(DEFAULT_DATA_DIR / 'dsn.npz') as a:
            t = a['times']
            q = {'start_utc': iso(t[0]), 'end_utc': iso(t[1]), 'step_seconds': int(t[1]-t[0]), 'elevation_mask_deg': 0}
            r = client.post('/api/science/dsn/windows', json=q)
            assert r.status_code == 200, r.text
            result = r.json()
            assert result['stations'][0]['moon_elevation_deg'][0] == float(a['moon_elevation_deg'][0, 0])
            assert result['provenance']['ephemeris'] == a['ephemeris'].item()
            assert not result['provenance']['interpolated']
            q['step_seconds'] = int((t[1]-t[0])/2)
            assert client.post('/api/science/dsn/windows', json=q).json()['provenance']['interpolated']
            q['start_utc'] = iso(t[0] - 1)
            assert client.post('/api/science/dsn/windows', json=q).status_code == 422


def test_bounds_and_missing(tmp_path):
    q = {'start_utc': '2026-01-01T00:00:00Z', 'end_utc': '2026-01-01T01:00:00Z', 'step_seconds': 60, 'elevation_mask_deg': 0}
    with patch.dict(os.environ, {'LUNANAV_DATA_DIR': str(tmp_path)}):
        assert client.post('/api/science/dsn/windows', json=q).status_code == 503
        for change in ({'step_seconds': 1}, {'elevation_mask_deg': 91}, {'start_utc': '2026-01-01T00:00:00'}, {'end_utc': '2027-01-01T00:00:00Z'}):
            assert client.post('/api/science/dsn/windows', json={**q, **change}).status_code == 422


BASE = 1767225600  # 2026-01-01T00:00:00Z


@pytest.fixture
def artifacts(tmp_path, monkeypatch):
    monkeypatch.setenv('LUNANAV_DATA_DIR', str(tmp_path))

    def write(dsn_end=120000, distance_end=120000):
        # The first seven minutes contain two separated visible runs, including
        # values exactly on the mask and runs touching both request boundaries.
        times = BASE + np.array([0, 60, 120, 180, 240, 300, 360, dsn_end])
        np.savez(tmp_path / 'dsn.npz', times=times, ephemeris='fixture-kernel',
                 stations=np.array(['Goldstone', 'Madrid']),
                 station_coords=np.array([[35., -116., 1000.], [40., -4., 700.]]),
                 moon_elevation_deg=np.array([[0., 5., -5., -1., 0., 10., 2., 2.],
                                              [-2., -2., -2., -2., -2., -2., -2., -2.]]))
        np.savez(tmp_path / 'earth_distance.npz',
                 times=BASE + np.array([0, distance_end]), ephemeris='fixture-kernel',
                 earth_moon_km=np.array([380000., 390000.]))

    write()
    return write


def request(start=0, end=360, step=60):
    return {'start_utc': iso(BASE + start), 'end_utc': iso(BASE + end),
            'step_seconds': step, 'elevation_mask_deg': 0}


def test_sampled_runs_and_exact_mask(artifacts):
    response = client.post('/api/science/dsn/windows', json=request())
    assert response.status_code == 200, response.text
    result = response.json()
    assert result['times_utc'] == [iso(BASE + i * 60) for i in range(7)]
    station, other = result['stations']
    assert station['moon_elevation_deg'] == [0, 5, -5, -1, 0, 10, 2]
    assert station['above_mask'] == [True, True, False, False, True, True, True]
    assert station['sampled_windows'] == [
        {'start_utc': iso(BASE), 'end_utc': iso(BASE + 60), 'start_index': 0, 'end_index': 1},
        {'start_utc': iso(BASE + 240), 'end_utc': iso(BASE + 360), 'start_index': 4, 'end_index': 6},
    ]
    assert other['above_mask'] == [False] * 7
    assert other['sampled_windows'] == []
    # A single equality sample is an inclusive one-sample window.
    response = client.post('/api/science/dsn/windows', json=request(240, 240))
    assert response.status_code == 200, response.text
    assert response.json()['stations'][0]['sampled_windows'] == [
        {'start_utc': iso(BASE + 240), 'end_utc': iso(BASE + 240), 'start_index': 0, 'end_index': 0}]


@pytest.mark.parametrize('end,expected', [(360, 360), (359, 300)])
def test_aligned_and_unaligned_endpoints(artifacts, end, expected):
    response = client.post('/api/science/dsn/windows', json=request(end=end))
    assert response.status_code == 200, response.text
    times = response.json()['times_utc']
    assert times == [iso(BASE + i) for i in range(0, end + 1, 60)]
    assert times[-1] == iso(BASE + expected)


def test_sample_cap(artifacts):
    response = client.post('/api/science/dsn/windows', json=request(end=1999 * 60))
    assert response.status_code == 200, response.text
    assert len(response.json()['times_utc']) == 2000
    response = client.post('/api/science/dsn/windows', json=request(end=2000 * 60))
    assert response.status_code == 422
    assert '2000' in response.json()['detail']


@pytest.mark.parametrize('artifact', ['dsn.npz', 'earth_distance.npz'])
def test_requested_end_outside_each_artifact_even_if_last_sample_covered(artifacts, artifact):
    # End is unaligned: the last sample is at 360, inside both artifacts.
    artifacts(dsn_end=390 if artifact == 'dsn.npz' else 120000,
              distance_end=390 if artifact == 'earth_distance.npz' else 120000)
    response = client.post('/api/science/dsn/windows', json=request(end=419))
    assert response.status_code == 422
    detail = response.json()['detail']
    assert detail['error'] == 'outside_coverage'
    assert detail['artifact'] == artifact
    assert detail['end_utc'] == iso(BASE + 390)


@pytest.mark.parametrize('change', [
    {'start_utc': 'not-a-date'}, {'start_utc': '2026-01-01T01:00:00+01:00'},
    {'end_utc': '2025-12-31T23:59:59Z'}, {'step_seconds': 59},
    {'step_seconds': 86401}, {'elevation_mask_deg': -91},
    {'elevation_mask_deg': 91},
])
def test_invalid_request_fields(artifacts, change):
    assert client.post('/api/science/dsn/windows', json={**request(), **change}).status_code == 422


@pytest.mark.parametrize('mask', ['NaN', 'Infinity', '-Infinity'])
def test_nonfinite_mask(artifacts, mask):
    assert client.post('/api/science/dsn/windows', json={**request(), 'elevation_mask_deg': mask}).status_code == 422


def test_interpolation_values(artifacts):
    response = client.post('/api/science/dsn/windows', json=request(start=30, end=150))
    assert response.status_code == 200, response.text
    result = response.json()
    assert result['stations'][0]['moon_elevation_deg'] == [2.5, 0, -3]
    assert result['earth_moon_km'] == pytest.approx([380002.5, 380007.5, 380012.5])
    assert result['provenance']['interpolated'] is True


@pytest.mark.parametrize('side', ['start', 'end'])
def test_no_extrapolation(artifacts, side):
    q = request(start=-1) if side == 'start' else request(start=119999, end=120001)
    response = client.post('/api/science/dsn/windows', json=q)
    assert response.status_code == 422
    # Both artifacts share coverage; DSN is checked first.
    assert response.json()['detail']['error'] == 'outside_coverage'


@pytest.mark.parametrize('artifact', ['dsn.npz', 'earth_distance.npz'])
@pytest.mark.parametrize('corruption', ['missing', 'invalid_archive', 'missing_key', 'bad_shape'])
def test_invalid_artifact(artifacts, tmp_path, artifact, corruption):
    path = tmp_path / artifact
    if corruption == 'missing':
        path.unlink()
    elif corruption == 'invalid_archive':
        path.write_bytes(b'not an npz')
    else:
        with np.load(path) as archive:
            payload = {key: archive[key] for key in archive.files}
        key = 'station_coords' if artifact == 'dsn.npz' else 'earth_moon_km'
        if corruption == 'missing_key':
            del payload[key]
        else:
            payload[key] = np.array([1.])
        np.savez(path, **payload)
    response = client.post('/api/science/dsn/windows', json=request())
    assert response.status_code == 503, response.text
