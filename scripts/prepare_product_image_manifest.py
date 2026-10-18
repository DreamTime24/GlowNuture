#!/usr/bin/env python3
"""Prepare an owner-review manifest from a CSV and locally supplied images.

Never publishes, approves, alters production inventory, or guesses identities.
Standard library only. Python 3.12+.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import json
import re
import unicodedata
from pathlib import Path

EXTS={".jpg",".jpeg",".png",".webp"}
NAME_FIELDS=("Product Name","product_name","name","Name","title","Title")
ID_FIELDS=("external_id","product_id","id","SKU","sku","Barcode","barcode","gtin")
BRAND_FIELDS=("Brand","brand")
IMAGE_FIELDS=("Direct Image URL","image_url","image","main_image")
SOURCE_FIELDS=("Product Source Link","source_url","url","product_url")

def field(row, choices):
    return next((str(row[k]).strip() for k in choices if k in row and row[k] is not None and str(row[k]).strip()),"")

def key(text):
    normalized=unicodedata.normalize("NFKC",text).casefold()
    normalized=unicodedata.normalize("NFKD",normalized)
    normalized="".join(c for c in normalized if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9\u0980-\u09ff]+","",normalized)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv",required=True,type=Path)
    parser.add_argument("--images",required=True,type=Path)
    parser.add_argument("--output",default="image_review_manifest.csv",type=Path)
    args=parser.parse_args()
    if not args.csv.is_file():parser.error("Catalog CSV not found")
    if not args.images.is_dir():parser.error("Image folder not found")
    if args.output.resolve()==args.csv.resolve():parser.error("Refusing to overwrite source CSV")
    with args.csv.open("r",encoding="utf-8-sig",newline="") as f:
        catalog=list(csv.DictReader(f))
    pictures=sorted(p for p in args.images.rglob("*") if p.is_file() and p.suffix.lower() in EXTS and not p.is_symlink())
    images_by_key={}
    for p in pictures:
        images_by_key.setdefault(key(p.stem),[]).append(p)
    names={}
    for row in catalog:
        n=key(field(row,NAME_FIELDS))
        if n:names[n]=names.get(n,0)+1
    fields=("external_id","product_name","brand","source_url","source_image_url","matched_local_file","image_sha256","match_status","reason")
    rows=[]
    for item in catalog:
        name=field(item,NAME_FIELDS)
        k=key(name)
        match=images_by_key.get(k,[]) if k else []
        status="REVIEW_REQUIRED"
        reason="No exact filename/product-name match; do not publish automatically"
        chosen=""
        sha=""
        if k and names[k]==1 and len(match)==1:
            status="CANDIDATE_REVIEW"
            reason="Exact normalized filename match; human must verify image and redistribution rights"
            chosen=match[0].relative_to(args.images).as_posix()
            sha=hashlib.sha256(match[0].read_bytes()).hexdigest()
        elif len(match)>1:
            reason="Multiple images share this name; manual gallery/variant matching required"
        elif k and names[k]>1:
            reason="Duplicate product name; match by verified variant/SKU manually"
        rows.append(dict(external_id=field(item,ID_FIELDS),product_name=name,brand=field(item,BRAND_FIELDS),source_url=field(item,SOURCE_FIELDS),source_image_url=field(item,IMAGE_FIELDS),matched_local_file=chosen,image_sha256=sha,match_status=status,reason=reason))
    args.output.parent.mkdir(parents=True,exist_ok=True)
    with args.output.open("w",encoding="utf-8-sig",newline="") as f:
        writer=csv.DictWriter(f,fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    print(json.dumps({"catalog_rows":len(catalog),"image_files":len(pictures),"review_candidates":sum(x["match_status"]=="CANDIDATE_REVIEW" for x in rows),"review_required":sum(x["match_status"]=="REVIEW_REQUIRED" for x in rows),"manifest":str(args.output)},indent=2))
if __name__=="__main__":main()
