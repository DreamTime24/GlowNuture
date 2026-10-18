"""Build a read-only Firebase catalog from explicitly approved owner product rows.

This never changes the transactional FastAPI store, prices, stock, or admin status.
Only local, explicitly cleared photographs are copied into public hosting.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FEED = ROOT / "client_catalog" / "approved_products.csv"
IMAGES = ROOT / "client_catalog" / "images"
MAX_IMAGE_BYTES = 6 * 1024 * 1024
MAX_ROWS = 5000
IMAGE_TYPES = {".jpg": "jpg", ".jpeg": "jpg", ".png": "png", ".webp": "webp"}
TRUE = {"yes", "true", "1", "approved"}
FIELDS = {
    "product_id", "name", "brand", "category", "size", "description_bn",
    "description_en", "ingredients", "source_url", "local_image", "image_credit",
    "product_approved", "image_rights_approved", "image_match_approved",
    "price_bdt", "price_verified",
}

def approved(value: str) -> bool:
    return str(value or "").strip().lower() in TRUE

def compact(value: str, limit: int = 8000) -> str:
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", str(value or "").strip())[:limit]

def safe_image_path(name: str) -> Path:
    if not name or "\\" in name or name.startswith("/"):
        raise ValueError("Use a filename relative to client_catalog/images")
    root = IMAGES.resolve()
    path = (IMAGES / name).resolve()
    if not path.is_relative_to(root) or path.is_symlink() or not path.is_file():
        raise ValueError("Image does not exist inside client_catalog/images")
    if path.suffix.lower() not in IMAGE_TYPES:
        raise ValueError("Image must be JPEG, PNG or WebP")
    if path.stat().st_size > MAX_IMAGE_BYTES or path.stat().st_size < 20:
        raise ValueError("Image size must be 20 bytes to 6MB")
    with path.open("rb") as f:
        start = f.read(12)
    if path.suffix.lower() in (".jpg", ".jpeg"):
        valid = start.startswith(b"\xff\xd8\xff")
    elif path.suffix.lower() == ".png":
        valid = start.startswith(b"\x89PNG\r\n\x1a\n")
    else:
        valid = start[:4] == b"RIFF" and start[8:12] == b"WEBP"
    if not valid:
        raise ValueError("File content does not match image extension")
    return path

def read_catalog(feed: Path = FEED):
    if not feed.exists():
        return []
    if feed.stat().st_size > 8_000_000:
        raise ValueError("Product feed exceeds 8MB")
    with feed.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames or not FIELDS.issubset(reader.fieldnames) or len(set(reader.fieldnames)) != len(reader.fieldnames):
            raise ValueError("Catalog headers missing, duplicated or invalid")
        result = []
        for row in reader:
            if None in row:
                raise ValueError("Unexpected extra CSV fields")
            result.append(row)
            if len(result) > MAX_ROWS:
                raise ValueError("Too many product records")
        return result

def build_collection(destination: Path, feed: Path = FEED):
    output = Path(destination) / "collection"
    output.mkdir(parents=True, exist_ok=True)
    records = read_catalog(feed)
    published = []
    errors = []
    unique_ids = set()
    target_images = output / "images"
    # Treat feeds as untrusted input even though a maintainer commits them.
    for index, row in enumerate(records, start=2):
        if not approved(row["product_approved"]):
            continue
        identity = compact(row["product_id"], 140)
        name = compact(row["name"], 220)
        description = compact(row["description_bn"] or row["description_en"])
        brand = compact(row["brand"], 120)
        rights = approved(row["image_rights_approved"])
        identity_confirmed = approved(row["image_match_approved"])
        credit = compact(row["image_credit"], 400)
        source_url = compact(row["source_url"], 2000)
        if source_url and not source_url.startswith("https://"):
            errors.append(f"Row {index}: Source URL must be HTTPS")
            continue
        if (not identity or not name or not brand or not description or
                identity in unique_ids or not rights or not identity_confirmed or not credit):
            errors.append(f"Row {index}: Identity, description, photo rights, credit or match not approved")
            continue
        try:
            path = safe_image_path(compact(row["local_image"], 500))
        except ValueError as error:
            errors.append(f"Row {index}: {error}")
            continue
        image_bytes = path.read_bytes()
        digest = hashlib.sha256(image_bytes).hexdigest()
        ext = "jpg" if path.suffix.lower() == ".jpeg" else path.suffix.lower().lstrip(".")
        filename = digest[:20] + "." + ext
        target_images.mkdir(parents=True, exist_ok=True)
        (target_images / filename).write_bytes(image_bytes)
        unique_ids.add(identity)
        price = None
        if approved(row["price_verified"]):
            raw = compact(row["price_bdt"], 20)
            if re.fullmatch(r"\d{1,8}(?:\.\d{1,2})?", raw) and float(raw) > 0:
                price = float(raw)
            else:
                errors.append(f"Row {index}: Invalid verified BDT price; price hidden")
        published.append({
            "id": identity, "name": name, "brand": brand,
            "category": compact(row["category"], 100),
            "size": compact(row["size"], 70),
            "description": description,
            "ingredients": compact(row["ingredients"], 4000),
            "image": "./images/" + filename,
            "image_credit": credit,
            "source_url": source_url,
            "price_bdt": price,
            "purchasable": False,
        })
    payload = {"products": published, "catalog_type": "read_only", "count": len(published)}
    (output / "catalog.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Firebase collection: {len(published)} approved products; {len(errors)} rejected/warning rows")
    for error in errors[:30]:
        print("  -", error)
    return payload, errors

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--destination", default="build/firebase-preview")
    p.add_argument("--feed", default=str(FEED))
    opts = p.parse_args()
    build_collection(Path(opts.destination), Path(opts.feed))
