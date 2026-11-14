"""Verified access to the pinned polar LOLA terrain."""
from pathlib import Path

import numpy as np

from . import polar_lola


class Terrain:
    """Terrain reader retaining georeferencing and lazy tile extrema cache."""
    def __init__(self, dataset, image_path, label_path, manifest_path):
        self.dataset = dataset
        self.image_path = Path(image_path)
        self.label_path = Path(label_path)
        self.manifest_path = Path(manifest_path) if manifest_path else None
        self.radius_m = polar_lola.RADIUS_M
        self.shape = (dataset.height, dataset.width)
        self._pyramid = {}

    def sample_height(self, row, col):
        from rasterio.windows import Window
        if row < 0 or col < 0 or row >= self.dataset.height - 1 or col >= self.dataset.width - 1:
            return float("nan")
        r, c = int(np.floor(row)), int(np.floor(col))
        block = np.ma.asarray(self.dataset.read(1, window=Window(c, r, 2, 2), masked=True), dtype=float).filled(np.nan)
        if not np.isfinite(block).all():
            return float("nan")
        fy, fx = row-r, col-c
        dn = (1-fy)*((1-fx)*block[0, 0]+fx*block[0, 1])+fy*((1-fx)*block[1, 0]+fx*block[1, 1])
        return float(dn)*0.5

    def tile_bounds(self, row0, col0, row1, col1):
        key = (row0, col0, row1, col1)
        if key not in self._pyramid:
            from rasterio.windows import Window
            block = np.ma.asarray(self.dataset.read(1, window=Window(col0, row0, col1-col0, row1-row0), masked=True), dtype=float).filled(np.nan)
            valid = block[np.isfinite(block)]
            self._pyramid[key] = (float(valid.min())*.5, float(valid.max())*.5) if valid.size else (float("nan"), float("nan"))
        return self._pyramid[key]

    def close(self):
        self.dataset.close()


def load_verified_terrain(image_path=None, label_path=None, manifest_path=None):
    import hashlib
    import json
    import rasterio
    from pathlib import Path
    root = Path(__file__).resolve().parents[3]
    image = Path(image_path or root / "data/raw/polar/ldem_80s_80m.jp2")
    label = Path(label_path or root / "data/raw/polar/ldem_80s_80m_jp2.lbl")
    manifest = Path(manifest_path or root / "data/polar-lola-manifest.json")
    if not label.is_file():
        raise ValueError("verified matching PDS label is required")
    polar_lola.validate_label(label.read_text(encoding="ascii"))
    if image.stat().st_size != polar_lola.EXPECTED_BYTES:
        raise ValueError("unexpected pinned LOLA image size")
    digest = hashlib.sha256(image.read_bytes()).hexdigest()
    if digest != polar_lola.EXPECTED_SHA256:
        raise ValueError("LOLA image SHA-256 mismatch")
    if manifest.is_file():
        data = json.loads(manifest.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError("invalid terrain manifest")
    ds = rasterio.open(image)
    if ds.width != 7600 or ds.height != 7600 or ds.count != 1 or ds.dtypes[0] != "int16" or ds.crs is None:
        ds.close()
        raise ValueError("LOLA raster geometry/type/georeferencing mismatch")
    return Terrain(ds, image, label, manifest)
