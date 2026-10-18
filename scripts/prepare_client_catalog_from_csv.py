#!/usr/bin/env python3
"""Convert a real supplier/OBF/Ogerio CSV into a NON-APPROVED owner review worksheet.

Never guesses prices, photo rights, product variants or publication approval.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import re
import unicodedata
from pathlib import Path

FIELDS=("product_id","name","brand","category","size","description_bn","description_en","ingredients","source_url","local_image","image_credit","product_approved","image_rights_approved","image_match_approved","price_bdt","price_verified")

def pick(row,*keys):
    for key in keys:
        v=row.get(key)
        if v is not None and str(v).strip():
            return str(v).strip()
    return ""

def norm(value):
    text=unicodedata.normalize("NFKD",str(value or "").casefold())
    text="".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9\u0980-\u09ff]+","",text)

def create_review(source:Path, destination:Path, images:Path|None=None):
    if not source.is_file():raise ValueError("Source CSV not found")
    if source.resolve()==destination.resolve():raise ValueError("Never overwrite source CSV")
    if destination.exists():raise ValueError("Destination exists. Choose a new review filename to avoid overwriting approvals")
    if source.stat().st_size>12_000_000:raise ValueError("CSV is larger than the supported 12MB")
    photos={}
    if images:
        if not images.is_dir():raise ValueError("Image folder does not exist")
        for path in images.rglob("*"):
            if path.is_file() and path.suffix.casefold() in {".jpg",".jpeg",".png",".webp"} and not path.is_symlink():
                photos.setdefault(norm(path.stem),[]).append(path.relative_to(images).as_posix())
    output=[]
    with source.open(encoding="utf-8-sig",newline="") as f:
        reader=csv.DictReader(f)
        if not reader.fieldnames:raise ValueError("Missing CSV header")
        for row in reader:
            name=pick(row,"Product Name","product_name","name","Name","title","Title")
            if not name:continue
            brand=pick(row,"Brand","brand","brands")
            ident=pick(row,"product_id","external_id","id","Barcode","barcode","SKU","sku","gtin")
            origin=pick(row,"Product Source Link","source_url","product_url","url")
            if not ident:
                ident=hashlib.sha256((origin+"|"+brand+"|"+name).encode()).hexdigest()[:24]
            alternatives=photos.get(norm(name),[])
            candidate=alternatives[0] if len(alternatives)==1 else ""
            output.append(dict(
                product_id=ident,name=name,brand=brand,
                category=pick(row,"category","Category","categories"),
                size=pick(row,"Size","size","quantity"),
                description_bn=pick(row,"বাংলা Description","description_bn"),
                description_en=pick(row,"description","Description","long_description","short_description"),
                ingredients=pick(row,"Ingredients (truncated)","ingredients","ingredients_text"),
                source_url=origin,
                local_image=candidate,
                image_credit="",
                product_approved="no",
                image_rights_approved="no",
                image_match_approved="no",
                price_bdt="",price_verified="no"
            ))
            if len(output)>5000:raise ValueError("Maximum 5000 rows")
    if not output:raise ValueError("No product name columns/rows found")
    destination.parent.mkdir(parents=True,exist_ok=True)
    with destination.open("w",encoding="utf-8-sig",newline="") as f:
        writer=csv.DictWriter(f,fieldnames=FIELDS,extrasaction="ignore")
        writer.writeheader();writer.writerows(output)
    return len(output),sum(bool(r["local_image"]) for r in output)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--csv",required=True,type=Path)
    p.add_argument("--output",required=True,type=Path)
    p.add_argument("--images",type=Path,default=None)
    a=p.parse_args()
    n,matched=create_review(a.csv,a.output,a.images)
    print(f"Prepared {n} non-approved review rows; {matched} exact-name candidate image matches.")
    print("Inspect products, image rights, photo variants and prices before setting approval fields to yes.")
    print("Copy reviewed rows to client_catalog/approved_products.csv only after checking them.")

if __name__=="__main__":main()
