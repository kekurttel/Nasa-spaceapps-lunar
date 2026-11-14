#!/usr/bin/env python3
"""Build existing terrain HorizonProfile document from fetched polar LOLA DEM."""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.features.visibility.polar_lola import write_horizon
DEFAULT_IMAGE = ROOT / "data/raw/polar/ldem_80s_80m.jp2"
DEFAULT_LABEL = ROOT / "data/raw/polar/LDEM_80S_80M.lbl"

parser = argparse.ArgumentParser()
parser.add_argument("--request", required=True, help="JSON with siteId, latitudeDeg, longitudeDeg, observerHeightM")
parser.add_argument("--output", required=True)
parser.add_argument("--image", default=str(DEFAULT_IMAGE))
parser.add_argument("--label", default=str(DEFAULT_LABEL))
args = parser.parse_args()
write_horizon(args.request, args.output, args.image, args.label)
