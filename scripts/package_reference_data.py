"""Copy the allowlisted LunaNav runtime artifacts; never execute upstream code.

Python standard library only. Deterministic manifest (no timestamps/absolute paths).
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

REPO = Path(__file__).resolve().parents[1]
DATA_FILES = (
    "horizons.json", "sites.yaml", "derived_sites.yaml", "landed_missions.yaml",
    "dsn.npz", "earth_distance.npz",
)
# Small upstream parity fixture retained so clean-clone regression tests work.
WEB_FILES = ("atlas.bin", "ephem.bin", "manifest.json", "dsn.bin", "psr.bin", "thermal.bin",
             "engine_expected.json")


def sha256(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def manifest(root, paths):
    return {
        "schema_version": 1,
        "source": "Locally supplied LunaNav snapshot; MIT, Copyright (c) 2026 yutuf",
        "scope": "Byte-identical runtime subset, not regenerated scientific results",
        "files": [
            {"path": path.as_posix(), "bytes": (root / path).stat().st_size,
             "sha256": sha256(root / path)}
            for path in sorted(paths, key=lambda item: item.as_posix())
        ],
    }


def selected_paths(source):
    profiles = json.loads((source / "data/horizons.json").read_text(encoding="utf-8"))
    ids = sorted(profile["site_id"] for profile in profiles)
    if len(ids) != 33 or len(set(ids)) != 33:
        raise ValueError("Expected exactly 33 distinct reference series")
    if any(not site.replace("_", "").replace("-", "").isalnum() for site in ids):
        raise ValueError("Unsafe site ID")
    return ([Path("LICENSE")] + [Path("data") / name for name in DATA_FILES]
            + [Path("data/series") / f"{site}.npz" for site in ids]
            + [Path("web/public/data") / name for name in WEB_FILES])


def verify(destination):
    document = json.loads((destination / "bundle-manifest.json").read_text(encoding="utf-8"))
    paths = selected_paths(destination)
    if document != manifest(destination, paths):
        raise ValueError("Bundle manifest mismatch")
    allowed = {path.as_posix() for path in paths} | {"bundle-manifest.json"}
    extras = {path.relative_to(destination).as_posix() for path in destination.rglob("*") if path.is_file()} - allowed
    if extras:
        raise ValueError(f"Unexpected bundle files: {sorted(extras)}")
    return document


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=REPO / "lmNasa-main")
    parser.add_argument("--destination", type=Path, default=REPO / "data/lunanav")
    parser.add_argument("--verify", action="store_true", help="Verify bundled hashes without upstream source")
    args = parser.parse_args()
    destination = args.destination.resolve()
    if not args.verify:
        source = args.source.resolve()
        if source == destination or source in destination.parents or destination in source.parents:
            raise ValueError("Source and destination must be separate directories")
        paths = selected_paths(source)
        for path in paths:
            if not (source / path).is_file():
                raise FileNotFoundError(source / path)
        # Refuse unknown destination content; never silently delete user files.
        allowed = {path.as_posix() for path in paths} | {"bundle-manifest.json"}
        if destination.exists():
            extras = {path.relative_to(destination).as_posix() for path in destination.rglob("*") if path.is_file()} - allowed
            if extras:
                raise ValueError(f"Unexpected destination files: {sorted(extras)}")
        for path in paths:
            target = destination / path
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source / path, target)
        document = manifest(destination, paths)
        (destination / "bundle-manifest.json").write_text(
            json.dumps(document, indent=2, ensure_ascii=True) + "\n", encoding="utf-8", newline="\n")
    document = verify(destination)
    total = sum(item["bytes"] for item in document["files"])
    print(f"Verified {len(document['files'])} files, {total:,} bytes ({total / 1024**2:.2f} MiB): {destination}")


if __name__ == "__main__":
    main()
