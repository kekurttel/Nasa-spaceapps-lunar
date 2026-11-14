# Reproducible scientific data preparation

Prerequisites: Node.js >=22.6, Python with `venv` and `pip`, Bash/Linux, HTTPS access to NASA PDS and NAIF (and PyPI when installing Python dependencies). No npm install is needed for this scientific test suite.

From repository root, clean-clone preparation plus real-terrain tests:

```bash
node scripts/prepare-data.mjs --setup-python --test
```

This command verifies existing data, downloads only missing or incorrect files, creates the ignored `.venv/`, installs `scripts/requirements-registration.txt`, and runs downloader, horizon, visibility, terrain, LOLA, registration, real-workflow, integration, and independent-audit tests. It does not start or build the web app. Python dependencies are optional for data preparation alone, but required for registered scientific tests. The command exits nonzero on download, dependency installation, verification, or test failure; no missing-data skip is substituted for real tests.

Other modes:

```bash
# Prepare six manifest-listed files, without Python installation or tests.
node scripts/prepare-data.mjs

# Offline verification: no downloads, fail on missing/modified files.
node scripts/prepare-data.mjs --verify-only

# Reuse already installed Python dependencies; tests invoke `python` from PATH.
PATH="$PWD/.venv/bin:$PATH" node scripts/prepare-data.mjs --verify-only --test

# Fast downloader regression tests, no real data or network needed.
node --test tests/prepare-data.test.mjs
```

## Sources and integrity

`data/lola-manifest.json` records original PDS URLs, sizes and SHA-256 digests for LOLA raster and label. `data/kernels/manifest.json` records original NAIF URLs, sizes and SHA-256 digests for DE421 kernels. These manifests remain scientific source of truth; downloader does not regenerate hashes from downloaded files or alter scientific contracts. Existing `scripts/fetch-lola.mjs` remains available for LOLA-only preparation.

Every accepted file must match both exact manifest size and SHA-256. Downloads use HTTPS, reject redirects, time out after 120 seconds, stream into unique temporary files beside destinations, and abort when manifest size is exceeded. Only fully verified downloads replace destinations by rename. Failed transfers remove partial files and leave existing destinations intact. Matching local files need no network. No large data is committed.

Local verification on 2026-11-14 matched all six actual files against unchanged manifests. Total: **22,740,043 bytes** (about 21.69 MiB); missing-file transfers require only corresponding subset.

| Repository path | Bytes | Verified SHA-256 |
| --- | ---: | --- |
| `data/raw/lola_ldem_4_float.img` | 4147200 | `6eaee9376442dc851b8f8e94790499ec339d923367d7b8608a4316088b85bd45` |
| `data/raw/lola_ldem_4_float.lbl` | 5125 | `37315910c3064d66623180fe49e91abc6c0c6b43b064042d2ac8002d997479d4` |
| `data/kernels/moon_080317.tf` | 21437 | `78732477b96f9863e7b0d65bcee3c22b8707ca5ed0db56d1173319cb2e8c7993` |
| `data/kernels/moon_pa_de421_1900-2050.bpc` | 1770496 | `656f90616403d75a75f0cd6c8830fc5b44f8cb4facb5ccb8915e752b397520cf` |
| `data/kernels/naif0012.tls` | 5257 | `678e32bdb5a744117a467cd9601cd6b373f0e9bc9bbde1371d5eee39600a039b` |
| `data/kernels/de421.bsp` | 16790528 | `08b20db2ae22488650641c5a9033e5bfda4b1c4b440cfeaf20f621cfa18ecdb3` |

## Clean snapshot validation

On 2026-11-14, `git archive HEAD` plus new preparation script/tests/docs was extracted into a disposable directory. All three ignored binaries and `.venv/` were absent before running the single command above. Official manifest URLs downloaded and verified the LOLA image, lunar orientation kernel, and DE421 ephemeris: **22,708,224 bytes** total. No URL or manifest changes were needed. Fresh `.venv/` installed `spiceypy==8.0.0` and resolved `numpy==2.5.4` (Python wheels reused pip cache). Scientific suite finished **61 passed, 0 failed, 0 skipped**.

Tested environment: CachyOS Linux (Arch-based), x86_64, Node.js **26.13.0**, Python **3.14.9**, pip **26.2.2** in fresh venv. Python must provide `venv` and pip bootstrapping; `.venv/` is covered by repository `.gitignore`. Other Python/platform wheel combinations were not tested.

Hash agreement establishes reproducibility, not independent astronomy validation. Scientific interpretation and DEM resolution limits remain documented in [LOLA](lola.md), [real workflow](real-workflow.md), and [registered workflow](registered-workflow.md). Web MVP uses bundled JSON; this preparation command serves real scientific workflows, not a replacement frontend data contract.
