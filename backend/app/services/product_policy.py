"""Owner approval is a versioned, auditable server transition."""
from decimal import Decimal
from sqlalchemy import select,update,func,or_
from fastapi import HTTPException
from ..core.security import utcnow
from ..models.entities import Product,Variant,Batch,Supplier,ProductApprovalEvent,AuditLog
from ..schemas.catalog import CONFIRMATIONS
from . import media

REVIEWERS={"super_admin","admin"}

def public_predicate():
    return (Product.active.is_(True),Product.content_verified.is_(True),Product.archived.is_(False),Product.publication_state=="PUBLISHED",or_(Product.legacy_approved.is_(True),Product.approved_revision==Product.revision))

def eligible(db,product):
    if not product or not product.active or not product.content_verified or product.archived or product.publication_state!="PUBLISHED":
        return False
    if product.legacy_approved:return True
    return product.approved_revision==product.revision and media.images_usable(db,product)

def reviewer(actor):
    if actor.role not in REVIEWERS:raise HTTPException(403,"Only the owner or an explicitly delegated admin can verify and publish products")

def reject_legacy_flags(data):
    if any(data.get(key) for key in ["active","content_verified","archived"]):
        raise HTTPException(409,"Use the versioned owner approval workflow; publish/verification flags cannot be patched")
    for key in ["active","content_verified","archived"]:data.pop(key,None)
    return data

def invalidate(db,product,actor,reason="material_changed"):
    revision=product.revision
    state="ARCHIVED" if product.archived else "DRAFT"
    changed=db.execute(update(Product).where(Product.id==product.id,Product.revision==revision).values(revision=revision+1,approved_revision=None,legacy_approved=False,publication_state=state,active=False,content_verified=False)).rowcount
    if not changed:raise HTTPException(409,"Product changed. Reload before editing.")
    db.add(ProductApprovalEvent(product_id=product.id,actor_user_id=actor.id,revision=revision+1,action="changed",state=state,reason=reason))
    db.add(AuditLog(actor_user_id=actor.id,action="product.approval_invalidated",entity="product",entity_id=str(product.id),metadata_json={"revision":revision+1,"reason":reason}))

def validate_product(db,product):
    errors=[]
    for key in ["sku","slug","name","brand","size","category"]:
        if not str(getattr(product,key,"") or "").strip():errors.append(key+" is required")
    if len(product.description.strip())<10:errors.append("An accurate description is required")
    if not product.ingredients_json:errors.append("Supply the verified ingredient/INCI information")
    if not product.usage.strip():errors.append("Supply the verified instructions")
    if product.condition not in {"new","sealed"}:errors.append("Only inspected new/sealed products may be published")
    if product.price<=0:errors.append("Set an actual positive BDT price")
    if product.compare and product.compare<=product.price:errors.append("Compare price must exceed the actual selling price")
    if product.expiry_required:
        variants=db.scalars(select(Variant).where(Variant.product_id==product.id,Variant.active.is_(True))).all()
        for variant in [None,*variants]:
            variant_id=variant.id if variant else None
            stock=variant.stock if variant else product.stock
            tracked=db.scalar(select(func.coalesce(func.sum(Batch.remaining),0)).where(Batch.product_id==product.id,Batch.variant_id==variant_id)) or 0
            expiry=product.unbatched_expires_at
            if expiry and not expiry.tzinfo:expiry=expiry.replace(tzinfo=utcnow().tzinfo)
            if stock>tracked and (not expiry or expiry<=utcnow()):errors.append("Unbatched stock needs a verified future expiry date")
        expired=db.scalar(select(Batch.id).where(Batch.product_id==product.id,Batch.remaining>0,Batch.expires_at<=utcnow()).limit(1))
        if expired:errors.append("Quarantine expired batches before verification")
    urls=media.product_urls(product)
    if not product.image_url or not urls:errors.append("A real main image is required")
    for url in urls:
        asset=media.asset_for_url(db,url)
        if not asset or asset.product_id!=product.id:
            errors.append("Store each image in managed media and attach it to this product")
            continue
        media.inspect_asset(asset)
        if asset.health!="healthy" or min(asset.width,asset.height)<256:errors.append("Images must be intact and at least 256 × 256 pixels")
        if not (asset.rights_holder and asset.license and len(asset.evidence.strip())>=10 and asset.redistribution_allowed):
            errors.append("Record image rights holder, license/permission evidence and redistribution consent")
    if errors:raise HTTPException(422,{"message":"Product is not ready for verification/publication","checks":list(dict.fromkeys(errors))})

def transition(db,product,payload,actor):
    if product.revision!=payload.expected_revision:raise HTTPException(409,"Product revision changed; review the current version")
    action=payload.action
    previous=product.publication_state
    if action!="submit":reviewer(actor)
    if action=="submit":
        if previous not in {"DRAFT","REJECTED"}:raise HTTPException(409,"Only drafts/rejected revisions can enter review")
        state="NEEDS_REVIEW"
    elif action=="verify":
        if previous!="NEEDS_REVIEW":raise HTTPException(409,"Submit this revision for review first")
        if set(payload.confirmations)!=CONFIRMATIONS or any(type(v) is not bool or not v for v in payload.confirmations.values()):
            raise HTTPException(422,"Every owner verification confirmation must be explicitly true")
        if len(payload.evidence.strip())<10:raise HTTPException(422,"Record supplier, condition and expiry verification evidence")
        supplier=db.get(Supplier,payload.supplier_id) if payload.supplier_id else None
        if not supplier or not supplier.active:raise HTTPException(422,"Select the actual active supplier")
        validate_product(db,product)
        state="VERIFIED"
        for url in media.product_urls(product):
            asset=media.asset_for_url(db,url)
            asset.approved_by=actor.id
            asset.approved_at=utcnow()
    elif action=="publish":
        if previous!="VERIFIED" or product.approved_revision!=product.revision:raise HTTPException(409,"Only the current verified revision can be published")
        review=db.scalar(select(ProductApprovalEvent).where(ProductApprovalEvent.product_id==product.id,ProductApprovalEvent.revision==product.revision,ProductApprovalEvent.action=="verify").order_by(ProductApprovalEvent.id.desc()))
        if not review or not db.get(Supplier,review.supplier_id) or not db.get(Supplier,review.supplier_id).active:
            raise HTTPException(409,"A current owner verification and active supplier are required")
        validate_product(db,product)
        state="PUBLISHED"
    elif action=="reject":
        if previous not in {"DRAFT","NEEDS_REVIEW","VERIFIED"}:raise HTTPException(409,"Unpublish first before rejecting a published revision")
        if len(payload.reason.strip())<8:raise HTTPException(422,"Record the rejection reason")
        state="REJECTED"
    elif action=="unpublish":
        if previous!="PUBLISHED":raise HTTPException(409,"Product is not published")
        if len(payload.reason.strip())<8:raise HTTPException(422,"Record why the product is being unpublished")
        state="NEEDS_REVIEW"
    elif action=="archive":
        if len(payload.reason.strip())<8:raise HTTPException(422,"Record the archive reason")
        state="ARCHIVED"
    else:
        if previous!="ARCHIVED":raise HTTPException(409,"Only archived products can be restored")
        state="DRAFT"
    verified=state in {"VERIFIED","PUBLISHED"}
    values={"publication_state":state,"active":state=="PUBLISHED","content_verified":verified,"archived":state=="ARCHIVED","approved_revision":product.revision if verified else None,"legacy_approved":False}
    changed=db.execute(update(Product).where(Product.id==product.id,Product.revision==payload.expected_revision,Product.publication_state==previous).values(**values)).rowcount
    if not changed:raise HTTPException(409,"Product was edited during review. Reload.")
    db.add(ProductApprovalEvent(product_id=product.id,actor_user_id=actor.id,supplier_id=payload.supplier_id,revision=product.revision,action=action,state=state,confirmations_json=payload.confirmations,evidence=payload.evidence,reason=payload.reason))
    db.add(AuditLog(actor_user_id=actor.id,action="product."+action,entity="product",entity_id=str(product.id),metadata_json={"from":previous,"to":state,"revision":product.revision}))
    db.commit()
    db.refresh(product)
    return product

def apply_edit(db,product,data,actor):
    data=reject_legacy_flags(data)
    expected=data.pop("revision",product.revision)
    if expected!=product.revision:raise HTTPException(409,"This form has an old product revision")
    material=any(getattr(product,key)!=value for key,value in data.items() if key not in {"stock","acquisition_cost"})
    old_revision=product.revision
    old_stock=product.stock
    if material:invalidate(db,product,actor)
    conditions=[Product.id==product.id,Product.revision==old_revision+(1 if material else 0)]
    if "stock" in data:conditions.append(Product.stock==old_stock)
    if data and not db.execute(update(Product).where(*conditions).values(**data)).rowcount:
        raise HTTPException(409,"Inventory/product changed; reload before saving")
    db.refresh(product)
    media.attach_images(db,product)
