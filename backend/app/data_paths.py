"""Shared LunaNav artifact roots; resolve overrides on each call."""
import os
from pathlib import Path

DEFAULT_DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "lunanav" / "data"


def data_dir():
    return Path(os.environ.get("LUNANAV_DATA_DIR", str(DEFAULT_DATA_DIR))).resolve()


def web_data_dir():
    """Explicit web override wins; otherwise use the NPZ root's sibling web tree."""
    return Path(os.environ.get(
        "LUNANAV_WEB_DATA_DIR", str(data_dir().parent / "web" / "public" / "data")
    )).resolve()
