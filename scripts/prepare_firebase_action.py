"""Prepare a hosting-only Firebase deployment directory for GitHub Actions."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def prepare() -> None:
    source = ROOT / "build" / "firebase-preview"
    dest = ROOT / "build" / "firebase-action"
    if not (source / "index.html").is_file():
        raise FileNotFoundError("Run scripts/build_firebase_preview.py first")
    config = json.loads((ROOT / "firebase.preview.json").read_text(encoding="utf-8"))
    if list(config.keys()) != ["hosting"] or not isinstance(config["hosting"], dict):
        raise ValueError("Preview config must contain hosting only")
    if config["hosting"].get("public") != "build/firebase-preview":
        raise ValueError("Unexpected preview public directory")
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(source, dest)
    config["hosting"]["public"] = "."
    (dest / "firebase.json").write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    print("Prepared Firebase Hosting-only deployment folder")


if __name__ == "__main__":
    prepare()
