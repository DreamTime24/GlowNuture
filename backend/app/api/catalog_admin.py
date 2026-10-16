"""Versioned approvals and media inspection; no external product is auto-published."""
import json
import re
from pathlib import Path
from fastapi import APIRouter,Depends,HTTPException,Request,Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from ..db import get_db
from ..models.entities import Product,MediaAsset,ProductApprovalEvent,AuditLog
from ..core.auth import require_user,require_admin,rate_limit
from ..schemas.catalog import ProductReviewIn,MediaMetadataIn,MediaRightsIn
from ..services import product_policy as policy,media,safe_network
from .platform import product_out,record

router=APIRouter()
def staff(request,db,principal):
    return require_admin(request,db,principal,"inventory")

@router.post("/api/admin/products/{product_id}/review")
def review(product_id:int,payload:ProductReviewIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal)
    product=db.scalar(select(Product).where(Product.id==product_id).with_for_update())
    if not product:raise HTTPException(404,"Product not found")
    return product_out(policy.transition(db,product,payload,actor),db,True)

@router.get("/api/admin/approval-queue")
def queue(request:Request,state:str="",q:str="",offset:int=Query(0,ge=0),limit:int=Query(40,ge=1,le=100),db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal)
    query=select(Product)
    if state:
        if state not in {"DRAFT","NEEDS_REVIEW","VERIFIED","REJECTED","PUBLISHED","ARCHIVED"}:raise HTTPException(422,"Unknown review state")
        query=query.where(Product.publication_state==state)
    if q:
        pattern="%"+q[:100].replace("%",r"\%").replace("_",r"\_")+"%"
        query=query.where(Product.name.ilike(pattern,escape="\\")|Product.sku.ilike(pattern,escape="\\"))
    rows=db.scalars(query.order_by(Product.updated_at.desc()).offset(offset).limit(limit+1)).all()
    return {"items":[product_out(p,db,True) for p in rows[:limit]],"next_offset":offset+limit if len(rows)>limit else None}

@router.get("/api/admin/products/{product_id}/approval")
def approval_detail(product_id:int,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal)
    product=db.get(Product,product_id)
    if not product:raise HTTPException(404,"Product not found")
    errors=[]
    try:policy.validate_product(db,product)
    except HTTPException as error:errors=error.detail.get("checks",[]) if isinstance(error.detail,dict) else [str(error.detail)]
    assets=db.scalars(select(MediaAsset).where(MediaAsset.product_id==product.id).order_by(MediaAsset.created_at)).all()
    events=db.scalars(select(ProductApprovalEvent).where(ProductApprovalEvent.product_id==product_id).order_by(ProductApprovalEvent.id.desc()).limit(100)).all()
    return {"product":product_out(product,db,True),"checks":errors,"media":[record(a) for a in assets],"history":[record(e) for e in events]}

@router.patch("/api/admin/media/{asset_id}/rights")
def media_rights(asset_id:str,payload:MediaMetadataIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal)
    policy.reviewer(actor)
    asset=db.get(MediaAsset,asset_id)
    if not asset:raise HTTPException(404,"Image not found")
    if asset.product_id:
        product=db.scalar(select(Product).where(Product.id==asset.product_id).with_for_update())
        if product:policy.invalidate(db,product,actor,"image_rights_changed")
    for key,value in payload.model_dump().items():setattr(asset,key,value)
    asset.approved_by=None
    asset.approved_at=None
    db.add(AuditLog(actor_user_id=actor.id,action="media.rights_recorded",entity="media",entity_id=asset.id))
    db.commit()
    return record(asset)

@router.post("/api/admin/media/from-url",status_code=201)
def authorized_image(payload:MediaRightsIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal)
    policy.reviewer(actor)
    rate_limit("media-fetch:"+str(actor.id),5,60)
    if not payload.redistribution_allowed or not payload.matches_product:raise HTTPException(422,"Explicit image redistribution and product-match confirmation are required")
    if not db.get(Product,payload.product_id):raise HTTPException(404,"Product not found")
    try:
        response=safe_network.fetch(payload.url,headers={"Accept":"image/jpeg,image/png,image/webp"},maximum=media.MAX_BYTES)
    except safe_network.ExternalFetchError as error:
        raise HTTPException(422,{"message":"Image could not be retrieved safely","code":error.code}) from None
    rights=payload.model_dump()
    rights["source_url"]=rights.pop("url")
    asset=media.create_asset(db,response.body,response.content_type,actor,payload.product_id,rights)
    db.add(AuditLog(actor_user_id=actor.id,action="media.authorized_copy",entity="media",entity_id=asset.id))
    db.commit()
    return {**record(asset),"preview_url":"/api/admin/media/"+asset.id+"/preview"}

@router.post("/api/admin/products/{product_id}/image-health")
def image_health(product_id:int,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal)
    product=db.get(Product,product_id)
    if not product:raise HTTPException(404,"Product not found")
    result=[]
    for url in media.product_urls(product):
        asset=media.asset_for_url(db,url)
        if not asset:result.append({"url":url,"status":"unmanaged_external" if url.startswith("https://") else "unregistered_local","remedy":"Import an authorized persistent copy and review its rights."})
        elif asset.product_id!=product.id:result.append({"url":url,"status":"wrong_product"})
        else:result.append({"url":url,"status":"managed","sizes":media.inspect_asset(asset)})
    if not result:result=[{"status":"missing_main_image"}]
    db.add(AuditLog(actor_user_id=actor.id,action="media.inspected",entity="product",entity_id=str(product.id)))
    db.commit()
    return {"product_id":product_id,"checks":result}

@router.get("/api/admin/media/{asset_id}/preview")
def private_preview(asset_id:str,request:Request,size:str="main",db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal)
    asset=db.get(MediaAsset,asset_id)
    if not asset or size not in {"main","thumb","small","medium","large"}:raise HTTPException(404,"Image not found")
    url="/media/assets/"+asset.id+"/"+size+".webp"
    if not any(item["url"]==url for item in asset.variants_json):raise HTTPException(404,"Image size not found")
    path=media.local_path(url)
    if not path.is_file():raise HTTPException(404,"Stored image is missing")
    return FileResponse(path,media_type="image/webp",headers={"Cache-Control":"no-store"})

@router.get("/media/{media_path:path}",include_in_schema=False)
def published_media(media_path:str,db=Depends(get_db)):
    url="/media/"+media_path
    if re.fullmatch(r"products/hero-(serum|cleanser|sunscreen)\.svg",media_path):
        decoration=Path(__file__).resolve().parents[3]/"frontend"/"media"/media_path
        if not decoration.is_file():raise HTTPException(404,"Decoration not found")
        return FileResponse(decoration,media_type="image/svg+xml")
    path=media.local_path(url)
    if not path.is_file():raise HTTPException(404,"Media not found")
    pieces=media_path.split("/")
    if len(pieces)==3 and pieces[0]=="assets":
        asset=db.get(MediaAsset,pieces[1])
        product=db.get(Product,asset.product_id) if asset and asset.product_id else None
        if not asset or not asset.approved_by or not policy.eligible(db,product) or not any(item["url"]==url for item in asset.variants_json):
            raise HTTPException(404,"Approved image not found")
        return FileResponse(path,media_type="image/webp",headers={"Cache-Control":"public, max-age=31536000, immutable"})
    # Preserve exact media links of records already live before the additive migration.
    legacy=db.scalars(select(Product).where(*policy.public_predicate(),Product.legacy_approved.is_(True))).all()
    if any(url in media.product_urls(product) for product in legacy):return FileResponse(path)
    raise HTTPException(404,"Approved media not found")
