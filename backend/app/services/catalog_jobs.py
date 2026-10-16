"""Durable page-at-a-time imports. All source changes remain reviewable candidates."""
import json
import hashlib
import math
import re
from datetime import timedelta
from sqlalchemy import select,update
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from ..core.security import utcnow
from ..core.config import get_settings
from ..db import SessionLocal
from ..models.entities import Product,CatalogSource,CatalogItemSource,CatalogImportJob,AuditLog,User,OperationalHeartbeat
from . import catalog_providers as providers,safe_network
from .catalog_normalize import normalize,digest,InvalidCatalog

def page_size(source):return 100 if source.kind=="file" else providers.PAGE_SIZE

def enqueue(db,source,actor,request_id,start=0,pages=1,rows=None):
    rows=rows or []
    if not source.enabled:raise HTTPException(409,"This source is disabled")
    if not re.fullmatch(r"[a-f0-9]{32}",request_id):raise HTTPException(422,"Use a fresh 32-character hex request ID")
    if start%page_size(source):raise HTTPException(422,"Start must match the provider page size")
    if source.kind=="ordinary" and not (get_settings().parse_api_key and get_settings().parse_key_rotation_confirmed):
        raise HTTPException(503,"Configure a rotated Parse key and confirm its rotation on the server")
    fingerprint=hashlib.sha256(json.dumps({"source":source.id,"actor":actor.id,"start":start,"pages":pages,"rows":rows},sort_keys=True,ensure_ascii=False,separators=(",",":")).encode()).hexdigest()
    existing=db.get(CatalogImportJob,request_id)
    if existing:
        if existing.request_hash!=fingerprint:raise HTTPException(409,"Request ID was already used for a different import")
        return existing
    job=CatalogImportJob(id=request_id,source_id=source.id,actor_user_id=actor.id,request_hash=fingerprint,start=start,cursor=start,pages=pages,input_rows_json=rows,counts_json={"created":0,"updated":0,"unchanged":0,"invalid":0})
    db.add(job)
    db.add(AuditLog(actor_user_id=actor.id,action="catalog.import_queued",entity="catalog_job",entity_id=job.id))
    try:db.commit()
    except IntegrityError:
        db.rollback()
        existing=db.get(CatalogImportJob,request_id)
        if existing and existing.request_hash==fingerprint:return existing
        raise HTTPException(409,"Another import for this source is already queued/running") from None
    return job

def ingest(db,source,snapshot,actor,counts):
    external=snapshot["external_id"]
    item=db.scalar(select(CatalogItemSource).where(CatalogItemSource.source_id==source.id,CatalogItemSource.external_id==external))
    hash_value=digest(snapshot)
    if item:
        if item.digest==hash_value:counts["unchanged"]+=1
        else:
            before=item.snapshot_json
            item.changes_json={key:{"before":before.get(key),"after":value} for key,value in snapshot.items() if before.get(key)!=value}
            item.snapshot_json=snapshot
            item.digest=hash_value
            counts["updated"]+=1
        item.gtin=snapshot["gtin"]
        item.last_seen_at=utcnow()
        item.available_at_source=True
        return item
    product=None
    if source.kind=="ordinary":
        product=db.scalar(select(Product).where(Product.source_id==external))
    if not product:
        key=hashlib.sha256((source.key+":"+external).encode()).hexdigest()[:16]
        slug=re.sub(r"[^a-z0-9]+","-",snapshot["name"].casefold()).strip("-")[:100] or "product"
        product=Product(sku="SRC-"+key.upper(),slug=slug+"-"+key,name=snapshot["name"],en=snapshot["en"],brand=snapshot["brand"],size=snapshot["size"],category=snapshot["category"] or "skincare",description=snapshot["description"],short=snapshot["short"],ingredients_json=snapshot["ingredients"],usage=snapshot["usage"],warnings=snapshot["warnings"],origin=snapshot["origin"],gtin=snapshot["gtin"],source_id=external if source.kind=="ordinary" else source.key+":"+key,source_json={"provider":source.key,"url":snapshot["url"],"attribution":source.attribution,"license":source.license},price=0,stock=0,active=False,content_verified=False,publication_state="DRAFT")
        db.add(product)
        db.flush()
    item=CatalogItemSource(source_id=source.id,external_id=external,product_id=product.id,gtin=snapshot["gtin"],snapshot_json=snapshot,changes_json={},digest=hash_value)
    db.add(item)
    db.flush()
    counts["created"]+=1
    db.add(AuditLog(actor_user_id=actor.id,action="catalog.draft_mapped",entity="product",entity_id=str(product.id),metadata_json={"source_id":source.id,"source_item_id":item.id}))
    return item

def process_one(db):
    now=utcnow()
    db.execute(update(CatalogImportJob).where(CatalogImportJob.status=="running",CatalogImportJob.locked_at<now-timedelta(minutes=5)).values(status="queued",locked_at=None).execution_options(synchronize_session=False))
    db.commit()
    job=db.scalar(select(CatalogImportJob).where(CatalogImportJob.status=="queued",(CatalogImportJob.next_attempt_at.is_(None))|(CatalogImportJob.next_attempt_at<=now)).order_by(CatalogImportJob.created_at).limit(1))
    if not job:return 0
    ident=job.id
    changed=db.execute(update(CatalogImportJob).where(CatalogImportJob.id==ident,CatalogImportJob.status=="queued").values(status="running",locked_at=now)).rowcount
    db.commit()
    if not changed:return 0
    db.refresh(job)
    try:
        source=db.get(CatalogSource,job.source_id)
        actor=db.get(User,job.actor_user_id)
        authorizer=db.get(User,source.authorized_by) if source else None
        if not source or not source.enabled or not authorizer or not authorizer.is_active or authorizer.role not in {"super_admin","admin"}:
            raise safe_network.ExternalFetchError("SOURCE_AUTHORIZATION_REVOKED")
        if not actor or not actor.is_active or actor.role not in {"super_admin","admin","inventory_manager"}:
            raise safe_network.ExternalFetchError("IMPORT_PERMISSION_REVOKED")
        size=page_size(source)
        raw=job.input_rows_json[job.cursor:job.cursor+size] if source.kind=="file" else providers.fetch_page(source,job.cursor)
        counts=dict(job.counts_json)
        for row in raw:
            try:snapshot=normalize(row,source)
            except InvalidCatalog:
                counts["invalid"]+=1
                continue
            ingest(db,source,snapshot,actor,counts)
        pages_done=job.pages_done+1
        cursor=job.cursor+size
        complete=len(raw)<size or pages_done>=job.pages
        exhausted=len(raw)<size or (source.kind=="file" and cursor>=len(job.input_rows_json))
        if complete and exhausted and job.start==0:
            db.execute(update(CatalogItemSource).where(CatalogItemSource.source_id==source.id,CatalogItemSource.last_seen_at<job.created_at).values(available_at_source=False).execution_options(synchronize_session=False))
        values={"counts_json":counts,"pages_done":pages_done,"cursor":cursor,"status":"completed" if complete else "queued","attempts":0,"error":"","locked_at":None,"next_attempt_at":None}
        if complete:
            values["input_rows_json"]=[]
            db.add(AuditLog(actor_user_id=actor.id,action="catalog.import_completed",entity="catalog_job",entity_id=job.id,metadata_json=counts))
        # A reclaimed worker must never commit its stale page or source edits.
        owned=db.execute(update(CatalogImportJob).where(CatalogImportJob.id==ident,CatalogImportJob.status=="running",CatalogImportJob.locked_at==now).values(**values).execution_options(synchronize_session=False)).rowcount
        if owned:db.commit()
        else:db.rollback()
        db.expire_all()
    except Exception as error:
        db.rollback()
        job=db.get(CatalogImportJob,ident)
        attempt=job.attempts+1
        retryable=isinstance(error,safe_network.ExternalFetchError) and error.retryable
        if isinstance(error,HTTPException):retryable=error.status_code in {502,503}
        known=isinstance(error,(safe_network.ExternalFetchError,HTTPException,InvalidCatalog,IntegrityError))
        code=error.code if isinstance(error,safe_network.ExternalFetchError) else "PROVIDER_OR_IMPORT_VALIDATION_FAILED" if known else "UNEXPECTED_IMPORT_FAILURE"
        status="queued" if retryable and attempt<3 else "failed"
        db.execute(update(CatalogImportJob).where(CatalogImportJob.id==ident,CatalogImportJob.status=="running",CatalogImportJob.locked_at==now).values(attempts=attempt,error=code,status=status,next_attempt_at=utcnow()+timedelta(seconds=30*2**attempt) if status=="queued" else None,locked_at=None).execution_options(synchronize_session=False))
        db.commit()
        db.expire_all()
    return 1

def heartbeat(key,details):
    with SessionLocal() as db:
        row=db.get(OperationalHeartbeat,key)
        if row:
            row.checked_at=utcnow()
            row.details_json=details
        else:db.add(OperationalHeartbeat(key=key,details_json=details))
        try:db.commit()
        except IntegrityError:
            db.rollback()
            db.execute(update(OperationalHeartbeat).where(OperationalHeartbeat.key==key).values(checked_at=utcnow(),details_json=details))
            db.commit()
