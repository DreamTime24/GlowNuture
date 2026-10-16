"""Persistent inventory, purchases, content and staff operational workflows."""
import io,secrets
from pathlib import Path
from datetime import timedelta
from fastapi import APIRouter,Depends,HTTPException,Request,UploadFile,File,Form
from sqlalchemy import select,update,func
from sqlalchemy.exc import IntegrityError
from ..db import get_db
from ..models.entities import Supplier,Purchase,PurchaseItem,Batch,Product,Variant,InventoryMovement,BusinessRecord,ReturnRequest,LedgerEntry
from ..core.config import get_settings
from ..core.auth import require_user,require_admin,enforce_origin,rate_limit
from ..core.security import encrypt_text,decrypt_text,utcnow
from ..schemas.platform import SupplierIn,PurchaseIn,ReceiveIn,VariantIn,BusinessRecordIn,ReturnDecisionIn,ReasonIn,GroundedQuestionIn
from ..services.commerce import aware
from ..services import product_policy,media as media_service
from .platform import record,audit
router=APIRouter();S=get_settings()
def staff(request,db,principal,permission):return require_admin(request,db,principal,permission)
@router.get("/api/admin/suppliers")
def suppliers(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal,"inventory");return [{**record(r),"contact":decrypt_text(r.contact_blob,S.pii_encryption_key)} for r in db.scalars(select(Supplier)).all()]
@router.post("/api/admin/suppliers",status_code=201)
def supplier(payload:SupplierIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal,"inventory");row=Supplier(name=payload.name,contact_blob=encrypt_text(payload.contact,S.pii_encryption_key),active=payload.active)
    db.add(row);db.flush();audit(db,actor,"supplier.created","supplier",row.id);db.commit();return record(row)
@router.get("/api/admin/purchases")
def purchases(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal,"inventory")
    return [{**record(r),"items":[record(i) for i in db.scalars(select(PurchaseItem).where(PurchaseItem.purchase_id==r.id)).all()]} for r in db.scalars(select(Purchase).order_by(Purchase.created_at.desc()).limit(200)).all()]
@router.post("/api/admin/purchases",status_code=201)
def purchase(payload:PurchaseIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal,"inventory");supplier=db.get(Supplier,payload.supplier_id)
    if not supplier or not supplier.active:raise HTTPException(404,"Active supplier not found")
    for item in payload.items:
        if not db.get(Product,item.product_id):raise HTTPException(404,"Product not found")
        variant=db.get(Variant,item.variant_id) if item.variant_id else None
        if item.variant_id and (not variant or variant.product_id!=item.product_id):raise HTTPException(400,"Variant does not belong to product")
        if item.expires_at and aware(item.expires_at)<=utcnow():raise HTTPException(400,"Do not receive expired products")
    row=Purchase(supplier_id=supplier.id,reference=payload.reference,total=sum(i.quantity*i.unit_cost for i in payload.items));db.add(row)
    try:
        db.flush()
        for item in payload.items:db.add(PurchaseItem(purchase_id=row.id,**item.model_dump()))
        audit(db,actor,"purchase.created","purchase",row.id);db.commit()
    except IntegrityError:db.rollback();raise HTTPException(409,"Purchase reference already exists") from None
    return record(row)
@router.post("/api/admin/purchases/{purchase_id}/receive")
def receive(purchase_id:int,payload:ReceiveIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal,"inventory")
    if not payload.inspected:raise HTTPException(400,"Inspect authenticity, count, batch and expiry first")
    purchase=db.scalar(select(Purchase).where(Purchase.id==purchase_id).with_for_update())
    if not purchase:raise HTTPException(404,"Purchase not found")
    if purchase.status=="received":return record(purchase)
    changed=db.execute(update(Purchase).where(Purchase.id==purchase.id,Purchase.status=="draft").values(status="received")).rowcount
    if not changed:raise HTTPException(409,"Receiving is already in progress")
    try:
        for item in db.scalars(select(PurchaseItem).where(PurchaseItem.purchase_id==purchase.id).order_by(PurchaseItem.product_id,PurchaseItem.id)).all():
            if item.expires_at and aware(item.expires_at)<=utcnow():raise HTTPException(409,"Batch has expired")
            model=Variant if item.variant_id else Product
            db.execute(update(model).where(model.id==(item.variant_id or item.product_id)).values(stock=model.stock+item.quantity))
            product=db.scalar(select(Product).where(Product.id==item.product_id).with_for_update());product.acquisition_cost=item.unit_cost
            db.add(Batch(purchase_item_id=item.id,product_id=item.product_id,variant_id=item.variant_id,code=item.batch_code,received=item.quantity,remaining=item.quantity,expires_at=item.expires_at))
            db.add(InventoryMovement(product_id=item.product_id,variant_id=item.variant_id,delta=item.quantity,reason="purchase.received",actor_user_id=actor.id))
        audit(db,actor,"purchase.received","purchase",purchase.id)
        db.add(LedgerEntry(kind="inventory_purchase",amount=purchase.total,reference="purchase:"+str(purchase.id),description=purchase.reference));db.commit();db.refresh(purchase);return record(purchase)
    except Exception:db.rollback();raise
@router.get("/api/admin/batches")
def batches(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal,"inventory")
    return [{**record(r),"expired":bool(r.expires_at and aware(r.expires_at)<=utcnow()),"expiry_warning":bool(r.expires_at and aware(r.expires_at)<utcnow()+timedelta(days=90))} for r in db.scalars(select(Batch).order_by(Batch.expires_at).limit(500)).all()]
@router.post("/api/admin/batches/{batch_id}/quarantine")
def quarantine(batch_id:int,payload:ReasonIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal,"inventory");row=db.scalar(select(Batch).where(Batch.id==batch_id).with_for_update())
    if not row:raise HTTPException(404,"Batch not found")
    if not row.remaining:return record(row)
    model=Variant if row.variant_id else Product;qty=row.remaining
    changed=db.execute(update(model).where(model.id==(row.variant_id or row.product_id),model.stock>=qty).values(stock=model.stock-qty)).rowcount
    if not changed:raise HTTPException(409,"Reconcile physical stock first")
    row.remaining=0;db.add(InventoryMovement(product_id=row.product_id,variant_id=row.variant_id,delta=-qty,reason="batch.quarantined",actor_user_id=actor.id))
    audit(db,actor,"batch.quarantined","batch",row.id,{"reason":payload.reason,"quantity":qty});db.commit();return record(row)
@router.get("/api/admin/products/{product_id}/variants")
def admin_variants(product_id:int,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal,"inventory");return [record(r) for r in db.scalars(select(Variant).where(Variant.product_id==product_id)).all()]
@router.post("/api/admin/products/{product_id}/variants",status_code=201)
def variant(product_id:int,payload:VariantIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal,"inventory")
    parent=db.scalar(select(Product).where(Product.id==product_id).with_for_update())
    if not parent:raise HTTPException(404,"Product not found")
    product_policy.invalidate(db,parent,actor,"variant_created")
    row=Variant(product_id=product_id,**payload.model_dump());db.add(row)
    try:
        db.flush()
        if row.stock:db.add(InventoryMovement(product_id=product_id,variant_id=row.id,delta=row.stock,reason="variant.initial_stock",actor_user_id=actor.id))
        audit(db,actor,"variant.created","variant",row.id);db.commit()
    except IntegrityError:db.rollback();raise HTTPException(409,"Variant SKU already exists") from None
    return record(row)
@router.patch("/api/admin/variants/{variant_id}")
def edit_variant(variant_id:int,payload:VariantIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal,"inventory");row=db.scalar(select(Variant).where(Variant.id==variant_id).with_for_update())
    if not row:raise HTTPException(404,"Variant not found")
    tracked=db.scalar(select(func.coalesce(func.sum(Batch.remaining),0)).where(Batch.variant_id==row.id)) or 0
    if payload.stock<tracked:raise HTTPException(409,"Reconcile tracked batches first")
    db.add(InventoryMovement(product_id=row.product_id,variant_id=row.id,delta=payload.stock-row.stock,reason="variant.stock_adjusted",actor_user_id=actor.id))
    parent=db.scalar(select(Product).where(Product.id==row.product_id).with_for_update())
    if any(getattr(row,key)!=value for key,value in payload.model_dump().items() if key!="stock"):product_policy.invalidate(db,parent,actor,"variant_changed")
    for k,v in payload.model_dump().items():setattr(row,k,v)
    audit(db,actor,"variant.updated","variant",row.id)
    try:db.commit()
    except IntegrityError:db.rollback();raise HTTPException(409,"Variant SKU already exists") from None
    return record(row)
@router.post("/api/admin/media",status_code=201)
async def upload_image(request:Request,file:UploadFile=File(...),product_id:int|None=Form(None),rights_holder:str=Form(""),license:str=Form(""),evidence:str=Form(""),redistribution_allowed:bool=Form(False),db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal,"inventory")
    if len(rights_holder)>200 or len(license)>200 or len(evidence)>2000:raise HTTPException(422,"Image rights fields are too long")
    raw=await file.read(media_service.MAX_BYTES+1)
    asset=media_service.create_asset(db,raw,file.content_type,actor,product_id,{"rights_holder":rights_holder,"license":license,"evidence":evidence,"redistribution_allowed":redistribution_allowed})
    audit(db,actor,"media.uploaded","media",asset.id)
    db.commit()
    return {**record(asset),"preview_url":"/api/admin/media/"+asset.id+"/preview"}

KINDS={"banner","policy","faq","category","brand"}
@router.get("/api/content/{kind}")
def public_content(kind:str,db=Depends(get_db)):
    if kind not in KINDS:raise HTTPException(404,"Content not found")
    return [{"key":r.record_key,**r.data_json} for r in db.scalars(select(BusinessRecord).where(BusinessRecord.kind==kind)).all() if r.data_json.get("active")]
@router.get("/api/admin/content/{kind}")
def admin_content(kind:str,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal,"marketing")
    if kind not in KINDS:raise HTTPException(404,"Content not found")
    return [{"key":r.record_key,**r.data_json} for r in db.scalars(select(BusinessRecord).where(BusinessRecord.kind==kind)).all()]
@router.put("/api/admin/content/{kind}/{key}")
def save_content(kind:str,key:str,payload:BusinessRecordIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal,"marketing")
    import re
    if kind not in KINDS or not re.fullmatch(r"[a-z0-9_-]{1,80}",key):raise HTTPException(400,"Invalid content key")
    row=db.scalar(select(BusinessRecord).where(BusinessRecord.kind==kind,BusinessRecord.record_key==key))
    if not row:row=BusinessRecord(kind=kind,record_key=key,data_json=payload.model_dump());db.add(row)
    else:row.data_json=payload.model_dump()
    audit(db,actor,"content.updated",kind,key);db.commit();return {"key":key,**row.data_json}
@router.patch("/api/admin/returns/{return_id}")
def return_decision(return_id:int,payload:ReturnDecisionIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal,"orders");row=db.scalar(select(ReturnRequest).where(ReturnRequest.id==return_id).with_for_update())
    if not row:raise HTTPException(404,"Return not found")
    stages={"requested":{"approved","rejected"},"approved":{"received"}}
    if payload.status not in stages.get(row.status,set()):raise HTTPException(409,"Follow return approval stages")
    row.status=payload.status;audit(db,actor,"return."+payload.status,"return",row.id,{"reason":payload.reason});db.commit();return record(row)
@router.get("/api/admin/settings")
def settings_status(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal,"marketing")
    return {"checkout_enabled":S.checkout_enabled,"seller_complete":bool(S.seller_legal_name and S.seller_address and S.support_email and S.support_phone),"facebook_enabled":S.firebase_facebook_enabled,"recaptcha_enabled":S.recaptcha_enabled,"recaptcha_secret_configured":bool(S.recaptcha_secret),"parse_configured":bool(S.parse_api_key),"payments_configured":bool(S.sslcommerz_store_id and S.sslcommerz_store_password),"payments_live":S.sslcommerz_live,"courier":"manual workflow; live API not configured","firebase_admin":"Requires approved server ADC/workload identity","analytics_opt_in":S.analytics_enabled}
@router.post("/api/assistant")
def assistant(payload:GroundedQuestionIn,request:Request,db=Depends(get_db)):
    enforce_origin(request);rate_limit("assistant:"+request.client.host,12,60)
    if not S.ai_enabled:raise HTTPException(503,"Catalog helper is disabled")
    words=[w.casefold() for w in payload.question.split() if len(w)>2]
    rows=db.scalars(select(Product).where(*product_policy.public_predicate())).all()
    score=lambda p:sum(w in (p.name+" "+p.en+" "+p.brand+" "+" ".join(p.ingredients_json)).casefold() for w in words)
    hits=[p for p in sorted(rows,key=score,reverse=True)[:3] if score(p)]
    return {"mode":"approved_catalog_lookup","answer":"Only approved catalog matches. For skin conditions, consult a qualified clinician.","products":[{"name":p.name,"slug":p.slug,"price":float(p.price),"stock":p.stock,"ingredients":p.ingredients_json} for p in hits],"currency":"BDT"}
