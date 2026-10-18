"""Generate a visibly marked *static* Firebase demo without copying backend or secrets.

Production remains FastAPI + PostgreSQL + worker(s), served from one origin.
"""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
DESTINATION = ROOT / "build" / "firebase-preview"
ALLOWED_FILES = ("index.html", "manifest.webmanifest")
ALLOWED_DIRS = ("assets", "catalog")
PUBLIC_BRAND_ILLUSTRATIONS = ("hero-cleanser.svg", "hero-serum.svg", "hero-sunscreen.svg")
COLLECTION_BANNER = ('<div role="status" data-glownuture-collection-notice '
' style="background:#405542;color:#fff;padding:10px 14px;text-align:center;font:500 12px/1.5 sans-serif">'
'Collection information only · Online orders are not enabled here. Confirm availability with our team.</div>')
PREVIEW_BANNER = (
    '<div role="status" data-glownuture-preview-banner '
    'style="position:relative;z-index:99999;background:#221F1C;color:#fff;'
    'padding:12px 16px;text-align:center;font:600 14px/1.5 sans-serif">'
    'GlowNuture PREVIEW ONLY — products, sign-in, orders and checkout require the live backend. '
    'No purchases can be completed from this static preview.</div>'
)


def build(destination: Path = DESTINATION) -> Path:
    """Build only to a generated path inside ./build; never touch source frontend."""
    destination = destination.resolve()
    safe_root = (ROOT / "build").resolve()
    if destination == safe_root or not destination.is_relative_to(safe_root):
        raise ValueError("Preview destination must be a subdirectory of build/")
    if not (FRONTEND / "index.html").is_file():
        raise FileNotFoundError("frontend/index.html is missing")
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True)
    for name in ALLOWED_FILES:
        source = FRONTEND / name
        if source.is_file():
            shutil.copy2(source, destination / name)
    for name in ALLOWED_DIRS:
        source = FRONTEND / name
        if source.exists():
            if source.is_symlink():
                raise ValueError(f"Refusing symlink: {source}")
            shutil.copytree(source, destination / name, symlinks=False, ignore=_ignore_private)
    # Runtime product media can contain private/unapproved uploads. NEVER copy media/assets.
    originals = FRONTEND / "media" / "products"
    for name in PUBLIC_BRAND_ILLUSTRATIONS:
        source = originals / name
        if source.is_file() and not source.is_symlink():
            target = destination / "media" / "products"
            target.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target / name)
    # Copy only the exact public collection page assets. Never copy a private image directory.
    collection_source = FRONTEND / "collection"
    collection_target = destination / "collection"
    collection_target.mkdir(parents=True, exist_ok=True)
    for name in ("index.html", "collection.css", "collection.js"):
        shutil.copy2(collection_source / name, collection_target / name)
    # Import by explicit path: works both as a CLI script and in isolated tests.
    from importlib.util import module_from_spec, spec_from_file_location
    spec = spec_from_file_location("client_collection_builder", ROOT / "scripts" / "build_client_collection.py")
    module = module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    module.build_collection(destination)
    # Mark every static preview page accurately; the read-only collection gets its own notice.

    for index in destination.rglob("*.html"):
        html = index.read_text(encoding="utf-8")
        if "<body>" not in html:
            raise ValueError(f"The preview HTML has no <body> tag: {index.relative_to(destination)}")
        notice = COLLECTION_BANNER if index.relative_to(destination).as_posix() == "collection/index.html" else PREVIEW_BANNER
        index.write_text(html.replace("<body>", "<body>\n" + notice, 1), encoding="utf-8")
    print("Generated preview at build/firebase-preview (static demo, NOT full-stack hosting).")
    return destination


def _ignore_private(directory: str, names: list[str]) -> set[str]:
    """Whitelist exclusions for files that must never be copied to public hosting."""
    excluded = set()
    for name in names:
        lower = name.lower()
        if ((Path(directory) / name).is_symlink() or name.startswith(".") or lower.endswith((".env", ".pem", ".key", ".p12", ".db", ".sqlite", ".sqlite3"))
            or lower.startswith(("credentials", "service-account", "serviceaccountkey"))
            or name in {"__pycache__", "node_modules", "private-backups"}):
            excluded.add(name)
    return excluded


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()
    build()
