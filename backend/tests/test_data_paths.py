"""All backend consumers share the same deployment root policy."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import data_paths, mission_search, reference_data, science_router


def test_bundled_defaults(monkeypatch):
    monkeypatch.delenv("LUNANAV_DATA_DIR", raising=False)
    monkeypatch.delenv("LUNANAV_WEB_DATA_DIR", raising=False)
    bundle = Path(__file__).resolve().parents[2] / "data/lunanav"
    assert reference_data.data_dir() == bundle / "data"
    assert mission_search.data_root() == science_router.web_data_dir() == bundle / "web/public/data"
    assert (reference_data.data_dir() / "horizons.json").is_file()
    assert (mission_search.data_root() / "engine_expected.json").is_file()


def test_npz_override_shared_sibling(monkeypatch, tmp_path):
    monkeypatch.setenv("LUNANAV_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.delenv("LUNANAV_WEB_DATA_DIR", raising=False)
    assert reference_data.data_dir() == tmp_path / "data"
    assert mission_search.data_root() == science_router.web_data_dir() == tmp_path / "web/public/data"


def test_explicit_web_override_wins(monkeypatch, tmp_path):
    monkeypatch.setenv("LUNANAV_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("LUNANAV_WEB_DATA_DIR", str(tmp_path / "custom-web"))
    assert data_paths.data_dir() == tmp_path / "data"
    assert mission_search.data_root() == science_router.web_data_dir() == tmp_path / "custom-web"
