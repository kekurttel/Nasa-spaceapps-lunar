# Bundled LunaNav runtime data

Clean clones use `data/lunanav/`; no `lmNasa-main/`, ZIP, network download,
upstream Python execution, raw raster, or SPICE kernel is required at runtime.
Algorithms remain unchanged. This is a byte-identical subset of the locally
supplied LunaNav snapshot, not reproduction of the upstream science pipeline.
The snapshot's repository URL/revision was not independently verified.

## Contents and size

47 payload files: **31,349,382 bytes (29.90 MiB)**, plus the 8,307-byte hash manifest.

| Path under `data/lunanav/` | Purpose | Bytes |
| --- | --- | ---: |
| `data/series/*.npz` (33 files) | Named-site ephemeris series | 14,780,164 |
| `data/{horizons.json,sites.yaml,derived_sites.yaml,landed_missions.yaml,dsn.npz,earth_distance.npz}` plus `LICENSE` | Site catalogs, skylines, station geometry, distances, MIT notice | 650,319 |
| `web/public/data/{atlas.bin,ephem.bin,manifest.json,dsn.bin,psr.bin,thermal.bin,engine_expected.json}` | Mission atlas, hourly ephemeris, region polygons, DSN, science layers, small upstream parity-test fixture | 15,918,899 |

`bundle-manifest.json` records each payload's relative path, size, SHA-256.
The upstream `web/public/data/manifest.json` is distinct: preserved scientific
metadata, not the packaging integrity manifest. Largest file: `psr.bin`,
6,390,796 bytes. No Git LFS required. Do not stage the entire upstream snapshot.

## Default roots and overrides

`backend/app/data_paths.py` provides shared resolvers for reference data,
mission search, and science layers. Roots are resolved on each call:

- NPZ/catalog default: `data/lunanav/data`, relative to the repository root.
  `LUNANAV_DATA_DIR` overrides this directory.
- Both mission and science web roots: explicit `LUNANAV_WEB_DATA_DIR` wins;
  otherwise `data_dir().parent / "web/public/data"`.
  Default: `data/lunanav/web/public/data`.

Setting only `LUNANAV_DATA_DIR` now consistently selects its sibling web tree
for both consumers. This preserves science's sibling-root behavior and corrects
mission search's formerly independent default. Set both variables when your
catalog and web data do not follow that layout. Restart the backend after
changing deployment roots because artifact loaders cache data.

## Repackage and verify

Python 3.11+; standard library only. From repository root:

```console
python scripts/package_reference_data.py --source lmNasa-main
python scripts/package_reference_data.py --verify
python -m pytest backend/tests -q
```

`--destination` supports another output directory. Packaging uses an explicit
allowlist; all 33 series IDs come from `horizons.json`. Missing inputs or unknown
destination files fail instead of silently deleting files. Existing allowlisted
files are overwritten. No timestamps or machine-specific absolute paths enter
the generated manifest. Re-running on identical source bytes yields identical
payloads and manifest. `--verify` needs only the bundle, checks hashes and sizes,
rejects extra files. Hashes detect changes; they do not authenticate NASA origin
or validate scientific accuracy. Preserve exact payload bytes through Git
(no line-ending conversion under `data/lunanav/`).

## Attribution and scientific provenance

`data/lunanav/LICENSE` preserves the supplied MIT notice verbatim:
**Copyright (c) 2026 yutuf**. See also `backend/THIRD_PARTY_NOTICES.md`.
MIT software licensing alone does not establish terms for every upstream dataset.
No NASA endorsement, flight certification, or independently verified provenance
is implied. The following are upstream-declared sources:

- Terrain/skylines: NASA LRO LOLA PDS products,
  <https://pds-geosciences.wustl.edu/missions/lro/lola.htm>.
- Ephemerides: JPL/Skyfield; local NPZ metadata declares `de421.bsp`.
  The upstream web manifest generically claims DE440. These claims conflict;
  retain artifact-specific metadata, do not relabel all artifacts DE440.
  JPL Horizons: <https://ssd.jpl.nasa.gov/horizons/>.
- PSR and long-term Sun/Earth visibility: NASA GSFC PGDA product 69,
  Mazarico et al., <https://pgda.gsfc.nasa.gov/products/69>.
  Ice favorability: USGS Astrogeology
  `Moon_IceFavorabilityIndex_90S000E_591mp.tif`; an index, not detected ice.
- Thermal: LRO Diviner Polar Resource Product, UCLA/Paige et al.,
  PDS `lro_diviner_derived1`, `dlre_prp_south.tab`.
- Candidate region outlines: NASA Artemis III candidate regions (October 2024),
  USGS navigational grids, <https://doi.org/10.5066/P1MEQ6UK>.

Science layers are quantized upstream exports. PSR NaN becomes zero; thermal
empty cells were nearest-neighbor filled upstream. DSN arrays describe Moon-center
geometry, not antenna scheduling or lunar terrain visibility. Bundling does not
remove these limitations. API provenance documents sampling/coverage restrictions.
