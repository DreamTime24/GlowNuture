"""Database transactions own stock, coupons and money. Amounts are calculated in paisa."""
import json,secrets
from datetime import timedelta
from decimal import Decimal,ROUND_HALF_UP
from sqlalchemy import select,update,or_,func
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from ..core.config import get_settings
from ..core.security import utcnow,encrypt_text,decrypt_text,token_digest,new_opaque_token,hmac_phone,normalize_phone
from ..models.entities import Product,Variant,Coupon,Order,OrderItem,InventoryMovement,Payment,AuditLog,Notification,Outbox,User,Shipment,LedgerEntry,Batch,StockAllocation,PurchaseItem
from ..schemas.platform import QuoteIn
from .firebase import identity_hash
S=get_settings()
def minor(value):return int((Decimal(str(value))*100).quantize(Decimal(1),rounding=ROUND_HALF_UP))
def major(value):return Decimal(value)/100
def allocate_refund(amount,capacities):
    """Allocate every paisa across remaining recognized revenue, delivery and tax."""
    total=sum(capacities.values())
    if not total:return {key:0 for key in capacities}
    if amount<0 or amount>total:raise ValueError("Refund allocation exceeds remaining recognized amount")
    result={key:amount*value//total for key,value in capacities.items()}
    remainder=amount-sum(result.values())
    ranked=sorted(capacities,key=lambda key:amount*capacities[key]%total,reverse=True)
    for key in ranked:
        if remainder and result[key]<capacities[key]:result[key]+=1;remainder-=1
    if remainder:raise ValueError("Refund allocation could not be reconciled")
    return result
def aware(value):return value.replace(tzinfo=utcnow().tzinfo) if value and not value.tzinfo else value
def expired_stock(db,product_id,variant_id=None):
    expired=db.scalar(select(func.coalesce(func.sum(Batch.remaining),0)).where(Batch.product_id==product_id,Batch.variant_id==variant_id,Batch.expires_at<=utcnow())) or 0
    product=db.get(Product,product_id)
    if product and product.unbatched_expires_at and aware(product.unbatched_expires_at)<=utcnow():
        sale=db.get(Variant,variant_id) if variant_id else product
        tracked=db.scalar(select(func.coalesce(func.sum(Batch.remaining),0)).where(Batch.product_id==product_id,Batch.variant_id==variant_id)) or 0
        expired+=max(0,sale.stock-tracked) if sale else 0
    return expired
def calculate(db,payload,lock=False):
    lines=[];subtotal=0
    for item in sorted(payload.items,key=lambda x:(x.product_id,x.variant_id or 0)):
        query=select(Product).where(Product.id==item.product_id,Product.active.is_(True),Product.content_verified.is_(True),Product.archived.is_(False))
        product=db.scalar(query.with_for_update() if lock else query)
        from .product_policy import eligible
        if not eligible(db,product) or product.price<=0:raise HTTPException(409,"A product is no longer available")
        variant=None
        if item.variant_id:
            query=select(Variant).where(Variant.id==item.variant_id,Variant.product_id==product.id,Variant.active.is_(True))
            variant=db.scalar(query.with_for_update() if lock else query)
            if not variant:raise HTTPException(409,"Product option is unavailable")
        sale=variant or product
        if sale.stock-expired_stock(db,product.id,item.variant_id)<item.qty:raise HTTPException(409,"Insufficient unexpired stock for "+product.name)
        price=minor(sale.price);subtotal+=price*item.qty
        lines.append({"product_id":product.id,"variant_id":item.variant_id,"sku":sale.sku,"name":product.name,"label":variant.label if variant else product.size,"price":float(major(price)),"price_minor":price,"qty":item.qty,"cost_minor":minor(product.acquisition_cost)})
    discount=0;coupon=None
    if payload.coupon:
        coupon=db.scalar(select(Coupon).where(Coupon.code==payload.coupon.strip().upper(),Coupon.active.is_(True)))
        if not coupon or (coupon.starts_at and aware(coupon.starts_at)>utcnow()) or (coupon.expires_at and aware(coupon.expires_at)<=utcnow()) or (coupon.usage_limit is not None and coupon.used>=coupon.usage_limit) or subtotal<minor(coupon.minimum):
            raise HTTPException(400,"Coupon is unavailable for this order")
        discount=minor(coupon.value) if coupon.kind=="fixed" else int((Decimal(subtotal)*coupon.value/100).quantize(Decimal(1),rounding=ROUND_HALF_UP))
        if coupon.maximum_discount is not None:discount=min(discount,minor(coupon.maximum_discount))
        discount=min(subtotal,discount)
    local=payload.division in {"ঢাকা","Dhaka","dhaka"} and payload.district in {"ঢাকা","Dhaka","dhaka"}
    delivery=0 if S.free_shipping_threshold and subtotal-discount>=minor(S.free_shipping_threshold) else minor(S.shipping_dhaka if local else S.shipping_outside)
    tax=int((Decimal(subtotal-discount)*Decimal(str(S.tax_percent))/100).quantize(Decimal(1),rounding=ROUND_HALF_UP))
    return {"lines":lines,"subtotal_minor":subtotal,"discount_minor":discount,"delivery_minor":delivery,"tax_minor":tax,"total_minor":subtotal-discount+delivery+tax,"coupon_id":coupon.id if coupon else None}
def quote_output(quote):
    return {**{k:v for k,v in quote.items() if k not in {"lines","coupon_id"}},"currency":"BDT","items":[{k:v for k,v in line.items() if k!="cost_minor"} for line in quote["lines"]]}
def notify(db,order,kind,title):
    if not order.user_id:return
    note=Notification(user_id=order.user_id,kind=kind,title=title,body="Order "+order.id+": "+order.status)
    db.add(note);db.flush()
    payload={"notification_id":note.id,"title":title,"body":note.body}
    db.add(Outbox(event_key="notification:"+str(note.id),user_id=order.user_id,channel="push",payload_json=payload))
    user=db.get(User,order.user_id)
    if user and user.email_verified and (user.preferences_json or {}).get("email"):
        db.add(Outbox(event_key="email:"+str(note.id),user_id=order.user_id,channel="email",payload_json=payload))
def release_stock(db,order,reason):
    changed=db.execute(update(Order).where(Order.id==order.id,Order.stock_released.is_(False)).values(stock_released=True)).rowcount
    if not changed:return False
    for line in order.items_json:
        model=Variant if line.get("variant_id") else Product;ident=line.get("variant_id") or line["product_id"]
        db.execute(update(model).where(model.id==ident).values(stock=model.stock+line["qty"]))
        db.add(InventoryMovement(product_id=line["product_id"],variant_id=line.get("variant_id"),delta=line["qty"],reason=reason,order_id=order.id))
    for alloc in db.scalars(select(StockAllocation).where(StockAllocation.order_id==order.id)).all():
        db.execute(update(Batch).where(Batch.id==alloc.batch_id).values(remaining=Batch.remaining+alloc.quantity))
    if order.coupon_id:db.execute(update(Coupon).where(Coupon.id==order.coupon_id,Coupon.used>0).values(used=Coupon.used-1))
    order.stock_released=True;return True
def expire_reservations(db):
    orders=db.scalars(select(Order).where(Order.status=="pending",Order.payment=="online",Order.payment_status=="pending",Order.expires_at<utcnow()).with_for_update()).all()
    for order in orders:
        release_stock(db,order,"payment.expired");order.status="cancelled";order.payment_status="unpaid"
        payment=db.scalar(select(Payment).where(Payment.order_id==order.id))
        if payment:payment.status="unpaid"
        notify(db,order,"order.expired","Unpaid order reservation expired")
    if orders:db.commit()
def create_checkout(db,payload,key,user):
    if not S.checkout_enabled or not all([S.seller_legal_name,S.seller_address,S.support_email,S.support_phone]):raise HTTPException(503,"Orders are not open yet. Contact the store.")
    if payload.payment=="cod" and not S.cod_enabled:raise HTTPException(400,"Cash on delivery is unavailable")
    if payload.payment=="online" and not (S.sslcommerz_store_id and S.sslcommerz_store_password):raise HTTPException(503,"Online payment is unavailable")
    if user and user.firebase_uid and not user.email_verified:raise HTTPException(403,"Verify your email before ordering with this account")
    if not key or not 16<=len(key)<=100 or not all(c.isalnum() or c in "_-" for c in key):raise HTTPException(400,"Reload checkout and try again")
    digest=identity_hash("checkout:"+key)
    raw=payload.model_dump(mode="json");raw.pop("recaptcha_token",None);raw["user_id"]=user.id if user else None
    fingerprint=identity_hash(json.dumps(raw,sort_keys=True,ensure_ascii=False))
    existing=db.scalar(select(Order).where(Order.idempotency_hash==digest))
    if existing:
        if existing.request_hash!=fingerprint:raise HTTPException(409,"This attempt was already used for a different order")
        return existing,False
    expire_reservations(db)
    try:
        quote=calculate(db,QuoteIn(items=payload.items,coupon=payload.coupon,division=payload.customer.division,district=payload.customer.district),lock=True)
        if quote["total_minor"]!=payload.expected_total_minor:raise HTTPException(409,"Price or delivery changed. Review your checkout.")
        if quote["coupon_id"]:
            changed=db.execute(update(Coupon).where(Coupon.id==quote["coupon_id"],Coupon.active.is_(True),or_(Coupon.usage_limit.is_(None),Coupon.used<Coupon.usage_limit)).values(used=Coupon.used+1)).rowcount
            if not changed:raise HTTPException(409,"Coupon has reached its usage limit")
        for line in quote["lines"]:
            model=Variant if line["variant_id"] else Product;ident=line["variant_id"] or line["product_id"]
            expired=expired_stock(db,line["product_id"],line["variant_id"])
            changed=db.execute(update(model).where(model.id==ident,model.active.is_(True),model.stock>=line["qty"]+expired).values(stock=model.stock-line["qty"])).rowcount
            if not changed:raise HTTPException(409,"Stock changed. Review your bag.")
        customer=payload.customer.model_dump(mode="json");token=new_opaque_token();oid="GN-"+secrets.token_hex(10).upper()
        lines=[{k:v for k,v in line.items() if k!="cost_minor"} for line in quote["lines"]]
        order=Order(id=oid,user_id=user.id if user else None,phone_hash=hmac_phone(customer["phone"],S.pii_hmac_key),customer_blob=encrypt_text(json.dumps(customer,ensure_ascii=False),S.pii_encryption_key),items_json=lines,subtotal=major(quote["subtotal_minor"]),discount=major(quote["discount_minor"]),delivery=major(quote["delivery_minor"]),tax=major(quote["tax_minor"]),total=major(quote["total_minor"]),coupon_id=quote["coupon_id"],payment=payload.payment,payment_status="cod_due" if payload.payment=="cod" else "pending",idempotency_hash=digest,request_hash=fingerprint,tracking_hash=token_digest(token),tracking_blob=encrypt_text(token,S.pii_encryption_key),expires_at=utcnow()+timedelta(minutes=30) if payload.payment=="online" else None)
        db.add(order);db.flush()
        for line in quote["lines"]:
            qty=line["qty"];cost_total_minor=0;cost_complete=True
            batches=db.scalars(select(Batch).where(Batch.product_id==line["product_id"],Batch.variant_id==line["variant_id"],Batch.remaining>0,or_(Batch.expires_at.is_(None),Batch.expires_at>utcnow())).order_by(Batch.expires_at.asc().nulls_last(),Batch.id).with_for_update()).all()
            for batch in batches:
                if not qty:break
                take=min(batch.remaining,qty)
                changed=db.execute(update(Batch).where(Batch.id==batch.id,Batch.remaining>=take).values(remaining=Batch.remaining-take)).rowcount
                if not changed:raise HTTPException(409,"Batch stock changed")
                unit_cost=minor(db.get(PurchaseItem,batch.purchase_item_id).unit_cost)
                cost_total_minor+=take*unit_cost;cost_complete=cost_complete and unit_cost>0
                db.add(StockAllocation(order_id=oid,batch_id=batch.id,quantity=take));qty-=take
            if qty:cost_total_minor+=qty*line["cost_minor"];cost_complete=cost_complete and line["cost_minor"]>0
            db.add(OrderItem(order_id=oid,product_id=line["product_id"],variant_id=line["variant_id"],quantity=line["qty"],price=major(line["price_minor"]),cost=major(line["cost_minor"]),cost_total=major(cost_total_minor),cost_complete=cost_complete))
            db.add(InventoryMovement(product_id=line["product_id"],variant_id=line["variant_id"],delta=-line["qty"],reason="order.reserved",order_id=oid))
        db.add(Payment(order_id=oid,provider=payload.payment,amount=order.total,status=order.payment_status))
        db.add(AuditLog(actor_user_id=user.id if user else None,action="order.created",entity="order",entity_id=oid))
        notify(db,order,"order.created","Your order has been received")
        db.commit();return order,True
    except IntegrityError:
        db.rollback();existing=db.scalar(select(Order).where(Order.idempotency_hash==digest))
        if existing and existing.request_hash==fingerprint:return existing,False
        raise HTTPException(409,"Order changed. Review your bag and try again.") from None
    except Exception:db.rollback();raise
def order_output(order,include_token=False):
    result={"id":order.id,"subtotal":float(order.subtotal),"discount":float(order.discount),"delivery":float(order.delivery),"tax":float(order.tax),"total":float(order.total),"total_minor":minor(order.total),"currency":"BDT","status":order.status,"payment":order.payment,"payment_status":order.payment_status,"items":order.items_json,"created_at":order.created_at.isoformat()}
    if include_token:result["tracking_token"]=decrypt_text(order.tracking_blob,S.pii_encryption_key)
    return result
TRANSITIONS={"pending":{"confirmed","cancelled"},"confirmed":{"processing","cancelled"},"processing":{"packed","cancelled"},"packed":{"shipped","cancelled"},"shipped":{"delivered","failed_delivery"},"failed_delivery":{"shipped","returned"},"delivered":{"returned"},"returned":set(),"cancelled":set(),"refund_pending":set(),"refunded":set()}
def change_status(db,order,payload,actor):
    previous=order.status
    if payload.status not in TRANSITIONS.get(previous,set()):raise HTTPException(409,"Follow the permitted order stages")
    if payload.status in {"confirmed","processing","packed","shipped","delivered"} and order.payment=="online" and order.payment_status!="paid":raise HTTPException(409,"Verify online payment before fulfillment")
    if payload.status=="cancelled" and order.payment_status in {"paid","review","cod_collected","partially_refunded"}:raise HTTPException(409,"Captured payment requires a reviewed refund")
    if payload.status=="shipped" and not db.scalar(select(Shipment.id).where(Shipment.order_id==order.id)):raise HTTPException(409,"Add a real courier reference before shipping")
    if payload.status in {"returned","failed_delivery"} and not payload.reason:raise HTTPException(400,"Record the reason")
    changed=db.execute(update(Order).where(Order.id==order.id,Order.status==previous).values(status=payload.status)).rowcount
    if not changed:raise HTTPException(409,"Order stage changed. Reload.")
    if payload.status=="cancelled" or (payload.status=="returned" and payload.restock):release_stock(db,order,"order."+payload.status)
    order.status=payload.status
    if payload.status=="delivered" and not db.scalar(select(LedgerEntry.id).where(LedgerEntry.reference=="sale:"+order.id)):
        for kind,amount in [("sale",order.subtotal-order.discount),("shipping_income",order.delivery),("tax_payable",order.tax)]:
            db.add(LedgerEntry(order_id=order.id,kind=kind,amount=amount,reference=kind+":"+order.id))
        cost=sum(item.cost_total for item in db.scalars(select(OrderItem).where(OrderItem.order_id==order.id)).all())
        db.add(LedgerEntry(order_id=order.id,kind="cost",amount=cost,reference="cost:"+order.id))
    if payload.status=="returned" and payload.restock and db.scalar(select(LedgerEntry.id).where(LedgerEntry.reference=="cost:"+order.id)):
        cost=sum(item.cost_total for item in db.scalars(select(OrderItem).where(OrderItem.order_id==order.id)).all())
        db.add(LedgerEntry(order_id=order.id,kind="cost_return",amount=cost,reference="cost_return:"+order.id))
    shipment=db.scalar(select(Shipment).where(Shipment.order_id==order.id))
    if shipment:shipment.status=payload.status;shipment.events_json=[*(shipment.events_json or []),{"status":payload.status,"at":utcnow().isoformat()}]
    db.add(AuditLog(actor_user_id=actor.id,action="order.status_changed",entity="order",entity_id=order.id,metadata_json={"from":previous,**payload.model_dump()}))
    notify(db,order,"order.status."+payload.status,"Your order status has changed")
    db.commit()
