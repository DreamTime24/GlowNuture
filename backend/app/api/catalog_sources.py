"""Owner-authorized sources, bounded feed uploads and durable import progress."""
import json
import math
from fastapi import APIRouter,Depends,HTTPException,Request,UploadFile,File,Form,Query
from sqlalchemy import select,update
from sqlalchemy.exc import IntegrityError
from ..db import get_db
from ..core.auth import require_user,require_admin,rate_limit
from ..core.config import get_settings
from ..core.security import encrypt_text,utcnow
from ..models.entities import CatalogSource,CatalogImportJob,CatalogItemSource,Product,AuditLog,OperationalHeartbeat,Outbox,MediaAsset
from ..schemas.catalog import SourceIn,ImportJobIn
from ..schemas.platform import Strict
from pydantic import Field
from ..services import product_policy,catalog_jobs,safe_network
from ..services.catalog_normalize import normalize,parse_upload,InvalidCatalog
from .platform import record,product_out

router=APIRouter()
def staff(request,db,principal):
    return require_admin(request,db,principal,"inventory")

def job_out(job):
    result=record(job)
    result.pop("input_rows_json",None)
    return result

def source_out(source):
    return {**record(source),"credential_configured":bool(source.credential_blob)}

def source_values(payload,actor):
    product_policy.reviewer(actor)
    if not payload.owner_authorized:raise HTTPException(422,"The business owner must authorize this source and its reuse terms")
    data=payload.model_dump(exclude={"owner_authorized","credential"})
    if payload.kind=="supplier_api":
        try:safe_network.validate_url(payload.endpoint)
        except safe_network.ExternalFetchError:raise HTTPException(422,"Use a public HTTPS API URL without credentials/query secrets") from None
    else:data["endpoint"]=""
    if payload.kind=="openbeautyfacts" and (len(payload.license.strip())<4 or len(payload.attribution.strip())<10):
        raise HTTPException(422,"Record the Open Beauty Facts metadata license/compliance decision and attribution")
    data["authorized_by"]=actor.id
    data["authorized_at"]=utcnow()
    if payload.credential:
        if payload.kind!="supplier_api":raise HTTPException(422,"Only supplier APIs accept a stored header credential; Parse uses the server secret")
        if any(c in payload.credential for c in "\r\n"):raise HTTPException(422,"Invalid header credential")
        data["credential_blob"]=encrypt_text(payload.credential,get_settings().pii_encryption_key)
    return data

@router.get("/api/admin/catalog/sources")
def sources(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal)
    return [source_out(source) for source in db.scalars(select(CatalogSource).order_by(CatalogSource.name).limit(100)).all()]

@router.post("/api/admin/catalog/sources",status_code=201)
def create_source(payload:SourceIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal)
    source=CatalogSource(**source_values(payload,actor))
    db.add(source)
    db.add(AuditLog(actor_user_id=actor.id,action="catalog.source_authorized",entity="catalog_source",metadata_json={"key":payload.key,"kind":payload.kind}))
    try:db.commit()
    except IntegrityError:db.rollback();raise HTTPException(409,"Source key already exists") from None
    return source_out(source)

@router.put("/api/admin/catalog/sources/{source_id}")
def edit_source(source_id:int,payload:SourceIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal)
    data=source_values(payload,actor)
    source=db.scalar(select(CatalogSource).where(CatalogSource.id==source_id).with_for_update())
    if not source:raise HTTPException(404,"Source not found")
    if payload.key!=source.key or payload.kind!=source.kind:raise HTTPException(409,"Source identity/kind are immutable; register a separate source")
    if db.scalar(select(CatalogImportJob.id).where(CatalogImportJob.source_id==source.id,CatalogImportJob.status.in_(["queued","running"]))):
        raise HTTPException(409,"Wait for the current job before changing source settings")
    for key,value in data.items():setattr(source,key,value)
    db.add(AuditLog(actor_user_id=actor.id,action="catalog.source_updated",entity="catalog_source",entity_id=str(source.id)))
    db.commit()
    return source_out(source)

@router.post("/api/admin/catalog/jobs",status_code=202)
def create_job(payload:ImportJobIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal)
    rate_limit("catalog-job:"+str(actor.id),10,60)
    source=db.get(CatalogSource,payload.source_id)
    if not source:raise HTTPException(404,"Source not found")
    if source.kind=="file":raise HTTPException(422,"Upload CSV/JSON for a file source")
    if payload.pages>get_settings().catalog_max_pages:raise HTTPException(422,"Too many pages for one bounded job")
    return job_out(catalog_jobs.enqueue(db,source,actor,payload.request_id,payload.start,payload.pages))

@router.post("/api/admin/catalog/uploads",status_code=202)
async def upload_feed(request:Request,file:UploadFile=File(...),source_id:int=Form(...),request_id:str=Form(...),db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal)
    rate_limit("catalog-file:"+str(actor.id),8,60)
    source=db.get(CatalogSource,source_id)
    if not source or source.kind!="file":raise HTTPException(422,"Select an owner-authorized file source")
    raw=await file.read(1_000_001)
    try:
        input_rows=parse_upload(raw,file.filename or "")
        rows=[normalize(row,source) for row in input_rows]
    except InvalidCatalog as error:raise HTTPException(422,str(error)) from None
    return job_out(catalog_jobs.enqueue(db,source,actor,request_id,pages=math.ceil(len(rows)/100),rows=rows))

@router.get("/api/admin/catalog/jobs")
def jobs(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal)
    return [job_out(job) for job in db.scalars(select(CatalogImportJob).order_by(CatalogImportJob.created_at.desc()).limit(100)).all()]

@router.get("/api/admin/catalog/jobs/{job_id}")
def job_detail(job_id:str,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal)
    job=db.get(CatalogImportJob,job_id)
    if not job:raise HTTPException(404,"Import job not found")
    return job_out(job)

@router.post("/api/admin/catalog/jobs/{job_id}/retry")
def retry_job(job_id:str,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal)
    job=db.scalar(select(CatalogImportJob).where(CatalogImportJob.id==job_id).with_for_update())
    if not job or job.status!="failed":raise HTTPException(409,"Only a failed import can be retried")
    job.status="queued"
    job.attempts=0
    job.error=""
    job.next_attempt_at=None
    db.add(AuditLog(actor_user_id=actor.id,action="catalog.import_retried",entity="catalog_job",entity_id=job.id))
    try:db.commit()
    except IntegrityError:db.rollback();raise HTTPException(409,"Another import is active for this source") from None
    return job_out(job)

@router.get("/api/admin/products/{product_id}/sources")
def product_sources(product_id:int,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal)
    items=db.scalars(select(CatalogItemSource).where(CatalogItemSource.product_id==product_id).limit(20)).all()
    return [record(item) for item in items]

class ApplySourceIn(Strict):
    fields:list[str]=Field(min_length=1,max_length=15)
    expected_revision:int=Field(ge=1)
    reason:str=Field(min_length=8,max_length=1000)

@router.post("/api/admin/catalog/items/{item_id}/apply")
def apply_source(item_id:int,payload:ApplySourceIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal)
    item=db.get(CatalogItemSource,item_id)
    if not item:raise HTTPException(404,"Source item not found")
    mapping={"name":"name","en":"en","brand":"brand","size":"size","category":"category","description":"description","short":"short","ingredients":"ingredients_json","usage":"usage","warnings":"warnings","origin":"origin","gtin":"gtin"}
    if any(key not in mapping for key in payload.fields):raise HTTPException(422,"Prices, costs, inventory, images and approval flags cannot be copied from a feed")
    product=db.scalar(select(Product).where(Product.id==item.product_id).with_for_update())
    data={mapping[key]:item.snapshot_json.get(key,[] if key=="ingredients" else "") for key in payload.fields}
    data["revision"]=payload.expected_revision
    product_policy.apply_edit(db,product,data,actor)
    db.add(AuditLog(actor_user_id=actor.id,action="catalog.source_fields_applied",entity="product",entity_id=str(product.id),metadata_json={"source_item_id":item.id,"fields":payload.fields,"reason":payload.reason}))
    db.commit()
    return product_out(product,db,True)

@router.get("/api/admin/catalog/duplicates")
def duplicates(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal)
    result=[]
    for item in db.scalars(select(CatalogItemSource).where(CatalogItemSource.gtin!="").limit(500)).all():
        matches=db.scalars(select(Product).where(Product.gtin==item.gtin,Product.id!=item.product_id).limit(5)).all()
        if matches:result.append({"source_item_id":item.id,"product_id":item.product_id,"gtin":item.gtin,"candidates":[{"id":p.id,"sku":p.sku,"name":p.name,"revision":p.revision} for p in matches]})
    return result[:100]

class SourceLinkIn(Strict):
    product_id:int=Field(gt=0)
    expected_revision:int=Field(ge=1)
    confirmed:bool
    reason:str=Field(min_length=10,max_length=1000)

@router.post("/api/admin/catalog/items/{item_id}/link")
def link_source(item_id:int,payload:SourceLinkIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal)
    product_policy.reviewer(actor)
    if not payload.confirmed:raise HTTPException(422,"Explicitly confirm the source mapping; no inventory/products will be merged or deleted")
    item=db.scalar(select(CatalogItemSource).where(CatalogItemSource.id==item_id).with_for_update())
    product=db.get(Product,payload.product_id)
    if not item or not product:raise HTTPException(404,"Source item or product not found")
    if product.revision!=payload.expected_revision:raise HTTPException(409,"Review the current target product")
    previous=item.product_id
    item.product_id=product.id
    db.add(AuditLog(actor_user_id=actor.id,action="catalog.source_linked",entity="product",entity_id=str(product.id),metadata_json={"from_product":previous,"source_item_id":item.id,"reason":payload.reason}))
    db.commit()
    return {"ok":True,"source_item_id":item.id,"product_id":product.id,"retained_product_id":previous}

@router.get("/api/admin/operations")
def operations(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    require_admin(request,db,principal,"dashboard")
    return {"heartbeats":[record(row) for row in db.scalars(select(OperationalHeartbeat)).all()],"failed_import_jobs":len(db.scalars(select(CatalogImportJob.id).where(CatalogImportJob.status=="failed").limit(1000)).all()),"failed_notifications":len(db.scalars(select(Outbox.id).where(Outbox.status.in_(["failed","unconfigured"])).limit(1000)).all()),"broken_media":len(db.scalars(select(MediaAsset.id).where(MediaAsset.health!="healthy").limit(1000)).all()),"checkout_enabled":get_settings().checkout_enabled}
