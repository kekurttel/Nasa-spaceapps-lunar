import importlib.util
import json

import numpy as np
import pytest

spec = importlib.util.spec_from_file_location("illumination_sky", "src/features/visibility/illumination_sky.py")
sky = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sky)


def arrays():
    result = {name: np.ones((2, 3), dtype=np.float64) for name in (
        "elevationM", "incidenceAngleDeg", "solarDiskVisibleFraction", "relativeDirectIrradiance")}
    result.update({name: np.ones((2, 3), dtype=np.uint8) for name in (
        "shadowClass", "selfShadowed", "castShadowed", "coverageStatus")})
    result["elevationM"][0, 0] = np.nan
    return result


def test_npz_writer_preserves_contract_types_nan_and_provenance(tmp_path):
    path = tmp_path / "tile.npz"
    manifest_path = sky.write_product(path, arrays(), {"utc": "2024-01-02T03:04:05Z", "sourceHashes": {"image": "a" * 64}})
    with np.load(path, allow_pickle=False) as saved:
        assert saved["elevationM"].dtype == np.float32
        assert np.isnan(saved["elevationM"][0, 0])
        assert saved["shadowClass"].dtype == np.uint8
        assert set(saved.files) == set(arrays())
    manifest = json.loads(manifest_path.read_text())
    assert manifest["contractVersion"] == 1
    assert manifest["sourceHashes"]["image"] == "a" * 64


def test_npz_writer_rejects_missing_arrays(tmp_path):
    with pytest.raises(ValueError, match="Missing required"):
        sky.write_product(tmp_path / "tile.npz", {}, {})
