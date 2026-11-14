import importlib.util
from pathlib import Path

import pytest

MODULE = Path(__file__).parents[1] / "src/features/visibility/illumination_sky.py"
spec = importlib.util.spec_from_file_location("illumination_sky", MODULE)
sky = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sky)


def test_utc_requires_strict_valid_zulu_timestamp():
    assert sky.validate_utc("2024-01-02T03:04:05Z") == "2024-01-02T03:04:05Z"
    for value in ("2024-01-02", "2024-02-30T03:04:05Z", "2024-01-02T03:04:05+00:00"):
        with pytest.raises(ValueError):
            sky.validate_utc(value)


def test_sun_uses_verified_spice_geometric_state_and_provenance():
    class Spice:
        def __init__(self): self.loaded = []
        def furnsh(self, path): self.loaded.append(path)
        def unload(self, path): self.loaded.remove(path)
        def str2et(self, utc): return 42.0
        def spkezr(self, target, et, frame, correction, observer):
            assert (target, et, frame, correction, observer) == ("SUN", 42.0, "MOON_ME_DE421", "NONE", "MOON")
            return ([1.0e8, 2.0e8, 3.0e8, 0, 0, 0], 0.0)
    fake = Spice()
    result = sky.build_sun("2024-01-02T03:04:05Z", Path("kernels"), spice_module=fake,
                           hash_loader=lambda _: {"de421.bsp": "a" * 64})
    assert result["positionM"] == [1e11, 2e11, 3e11]
    assert result["source"]["kernelHashes"]["de421.bsp"] == "a" * 64
    assert result["frame"] == "MOON_ME_DE421"
    assert not fake.loaded


def test_window_output_dimensions_preserve_requested_step():
    window = sky.Window(row_off=4, col_off=8, height=7, width=9)
    assert sky.output_shape(window, 3) == (3, 3)
    with pytest.raises(ValueError):
        sky.output_shape(window, 0)
