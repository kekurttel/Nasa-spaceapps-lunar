# Polar LOLA download verification

Source: NASA PDS Geosciences Node, LRO/LOLA `LDEM_80S_80M` V2.1, dataset `LRO-L-LOLA-4-GDR-V1.0`.

Official URLs:

- Label: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/jp2/ldem_80s_80m_jp2.lbl
- Raster: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/jp2/ldem_80s_80m.jp2

## Local verification

- Label: `data/raw/polar/LDEM_80S_80M.lbl`; 6,354 bytes; SHA-256 `497512747bb56490d50cf3f4945f2cb736bf61cd19b65fa61a826825e2a35d79`. Downloaded from official URL; label fields identify product `LDEM_80S_80M`, version `V2.1`, dataset ID `LRO-L-LOLA-4-GDR-V1.0`.
- Raster: `data/raw/polar/LDEM_80S_80M.jp2`; downloaded from official URL; local verification confirms 29,837,992 bytes and SHA-256 `c088dd4f510e879375ee7e6f0d320ba84115f535f45fb592dd7f83a7d2e83ae3`. These are local verification values against digest/size pinned in Agent3 manifest at commit `e241cee6d9f149767379a4891cb0344cf2a7d28d`; they are not claimed as publisher-provided checksums.
- Label's PDS metadata: 7,600 × 7,600 signed 16-bit samples; polar stereographic, planetocentric; 80 m/pixel at pole; scale 0.5 m and radius offset 1,737,400 m; MEAN EARTH/POLAR AXIS OF DE421, body-fixed rotating, east-positive longitude.

Upstream Agent3 retrieval timestamps and prior decoded/tested claims are historical only, not evidence of this workspace's retrieval or scientific validation. See `data/polar-lola-manifest.json` for structured metadata/status. Local verification covers raw asset size and hashes only; no decoded raster or scientific validation is claimed.
