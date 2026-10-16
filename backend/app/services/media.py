"""Persistent, sanitized product images, responsive derivatives and integrity checks."""
import hashlib
import io
import re
import secrets
from pathlib import Path
from PIL import Image,ImageOps,UnidentifiedImageError
from sqlalchemy import select
from fastapi import HTTPException
from ..core.config import get_settings
from ..core.security import utcnow
from ..models.entities import MediaAsset,Product

MAX_BYTES=5_000_000
Image.MAX_IMAGE_PIXELS=15_000_000

def media_root():
    configured=get_settings().media_root
    return Path(configured).resolve() if configured else Path(__file__).resolve().parents[3]/"frontend"/"media"

def local_path(url):
    if not isinstance(url,str) or not re.fullmatch(r"/media/[a-zA-Z0-9_./-]+",url) or ".." in url.split("/"):
        raise HTTPException(400,"Invalid local media path")
    root=media_root().resolve()
    path=(root/url.removeprefix("/media/")).resolve()
    if not path.is_relative_to(root):raise HTTPException(400,"Unsafe media path")
    return path

def asset_for_url(db,url):
    return db.scalar(select(MediaAsset).where(MediaAsset.url==url))

def create_asset(db,raw,mime,actor,product_id=None,rights=None):
    if len(raw)>MAX_BYTES:raise HTTPException(413,"Maximum image size is 5 MB")
    if mime not in {"image/jpeg","image/png","image/webp"}:raise HTTPException(415,"Use JPEG, PNG or WebP")
    try:
        image=Image.open(io.BytesIO(raw))
        expected={"JPEG":"image/jpeg","PNG":"image/png","WEBP":"image/webp"}
        if image.format not in expected or expected[image.format]!=mime or image.width*image.height>15_000_000 or getattr(image,"n_frames",1)!=1:
            raise ValueError()
        image.load()
        image=ImageOps.exif_transpose(image).convert("RGBA")
        image.thumbnail((1600,1600))
        canvas=Image.new("RGB",image.size,(250,247,242))
        canvas.paste(image,mask=image.getchannel("A"))
    except (ValueError,UnidentifiedImageError,OSError,Image.DecompressionBombError,Image.DecompressionBombWarning):
        raise HTTPException(400,"Invalid or unsafe image") from None
    if product_id and not db.get(Product,product_id):raise HTTPException(404,"Product not found")
    ident=secrets.token_hex(16)
    folder=media_root()/"assets"/ident
    folder.mkdir(mode=0o750,parents=True,exist_ok=False)
    variants=[]
    try:
        for maximum,name in [(1600,"main"),(160,"thumb"),(320,"small"),(640,"medium"),(960,"large")]:
            resized=canvas.copy()
            resized.thumbnail((maximum,maximum))
            stream=io.BytesIO()
            resized.save(stream,format="WEBP",quality=85,method=4)
            data=stream.getvalue()
            with (folder/(name+".webp")).open("xb") as output:output.write(data)
            variants.append({"url":"/media/assets/"+ident+"/"+name+".webp","width":resized.width,"height":resized.height,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()})
        main=variants[0]
        meta=rights or {}
        asset=MediaAsset(id=ident,product_id=product_id,uploaded_by=actor.id,url=main["url"],sha256=main["sha256"],width=main["width"],height=main["height"],bytes=main["bytes"],variants_json=variants,source_url=meta.get("source_url",""),rights_holder=meta.get("rights_holder",""),license=meta.get("license",""),evidence=meta.get("evidence",""),redistribution_allowed=bool(meta.get("redistribution_allowed")))
        db.add(asset)
        db.flush()
        return asset
    except BaseException:
        # Cleanup is limited to files created for this failed request.
        for path in folder.glob("*.webp"):path.unlink(missing_ok=True)
        folder.rmdir()
        raise

def public_asset(asset):
    return {"id":asset.id,"url":asset.url,"width":asset.width,"height":asset.height,"credit":{"holder":asset.rights_holder,"license":asset.license,"source_url":asset.source_url,"modified":True},"variants":[{k:v for k,v in item.items() if k in {"url","width","height","bytes"}} for item in asset.variants_json]}

def inspect_asset(asset):
    checks=[]
    for item in asset.variants_json:
        try:
            path=local_path(item["url"])
            if not path.is_file():raise ValueError()
            raw=path.read_bytes()
            if len(raw)>MAX_BYTES or hashlib.sha256(raw).hexdigest()!=item["sha256"]:raise ValueError()
            with Image.open(io.BytesIO(raw)) as image:
                if image.format!="WEBP" or image.size!=(item["width"],item["height"]):raise ValueError()
                image.verify()
            checks.append({"url":item["url"],"status":"healthy"})
        except (ValueError,OSError,HTTPException,KeyError):
            checks.append({"url":item.get("url",""),"status":"missing_or_invalid"})
    asset.health="healthy" if checks and all(row["status"]=="healthy" for row in checks) else "broken"
    asset.health_detail="" if asset.health=="healthy" else "One or more stored sizes failed integrity checks."
    asset.checked_at=utcnow()
    return checks

def product_urls(product):
    return list(dict.fromkeys([url for url in [product.image_url,*(product.images_json or [])] if url]))

def attach_images(db,product):
    for url in product_urls(product):
        asset=asset_for_url(db,url)
        if asset:
            if asset.product_id not in {None,product.id}:raise HTTPException(409,"An image belongs to another product. Upload the correct image.")
            asset.product_id=product.id

def images_usable(db,product):
    urls=product_urls(product)
    if not urls:return False
    for url in urls:
        asset=asset_for_url(db,url)
        if not asset or asset.product_id!=product.id or asset.health!="healthy" or not local_path(url).is_file():
            return False
    return True
