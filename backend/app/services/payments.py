"""Hosted SSLCommerz. Signed callback + server validation are both mandatory."""
import hashlib,hmac,json
from urllib.parse import urlsplit
import httpx
from fastapi import HTTPException
from sqlalchemy import select,update
from sqlalchemy.exc import IntegrityError
from ..models.entities import Order,Payment,AuditLog,LedgerEntry
from ..core.config import get_settings
from ..core.security import utcnow,decrypt_text
from .commerce import minor,release_stock,notify,aware
S=get_settings()
def gateway_base():return "https://securepay.sslcommerz.com" if S.sslcommerz_live else "https://sandbox.sslcommerz.com"
def gateway_json(path,data,method="GET"):
    if not S.sslcommerz_store_id or not S.sslcommerz_store_password:raise HTTPException(503,"Merchant connection is not configured")
    values={**data,"store_id":S.sslcommerz_store_id,"store_passwd":S.sslcommerz_store_password}
    try:
        with httpx.Client(timeout=25,follow_redirects=False) as client:
            r=client.post(gateway_base()+path,data=values) if method=="POST" else client.get(gateway_base()+path,params=values)
        if r.status_code!=200 or len(r.content)>2_000_000:raise ValueError()
        result=r.json()
        if not isinstance(result,dict):raise ValueError()
        return result
    except (httpx.HTTPError,ValueError):raise HTTPException(502,"Payment provider could not complete the request. Contact support.") from None
def verify_signature(payload):
    if not S.sslcommerz_store_password or not isinstance(payload,dict) or any(not isinstance(k,str) or not isinstance(v,(str,int,float)) for k,v in payload.items()):return False
    keys=str(payload.get("verify_key","")).split(",")
    mandatory={"tran_id","amount","currency","status","store_id"}
    if payload.get("status") in {"VALID","VALIDATED"}:mandatory.add("val_id")
    if not mandatory.issubset(set(keys)) or len(set(keys))!=len(keys):return False
    values={key:str(payload[key]) for key in keys if key in payload and key!="store_passwd"}
    values["store_passwd"]=hashlib.md5(S.sslcommerz_store_password.encode()).hexdigest()
    digest=hashlib.md5("&".join(f"{key}={values[key]}" for key in sorted(values)).encode()).hexdigest()
    return hmac.compare_digest(digest,str(payload.get("verify_sign","")).lower())
def initiate(db,order):
    if order.payment!="online" or order.status!="pending" or order.payment_status!="pending" or order.stock_released:raise HTTPException(409,"This order cannot start payment")
    if order.expires_at and aware(order.expires_at)<=utcnow():raise HTTPException(409,"Payment reservation expired")
    payment=db.scalar(select(Payment).where(Payment.order_id==order.id).with_for_update())
    if payment.checkout_url:return payment.checkout_url
    if not S.sslcommerz_store_id or not S.sslcommerz_store_password:raise HTTPException(503,"Merchant connection is not configured")
    changed=db.execute(update(Payment).where(Payment.id==payment.id,Payment.initiation_attempted.is_(False)).values(initiation_attempted=True)).rowcount
    if not changed:raise HTTPException(409,"Payment initiation was already attempted. Contact support for reconciliation.")
    db.commit()
    customer=json.loads(decrypt_text(order.customer_blob,S.pii_encryption_key))
    result=gateway_json("/gwprocess/v4/api.php",{
        "total_amount":f"{order.total:.2f}","currency":"BDT","tran_id":order.id,
        "success_url":S.allowed_origin+"/api/payments/return","fail_url":S.allowed_origin+"/api/payments/return","cancel_url":S.allowed_origin+"/api/payments/return","ipn_url":S.allowed_origin+"/api/payments/ipn",
        "cus_name":customer["name"],"cus_email":customer.get("email") or S.support_email,"cus_add1":customer["address"],"cus_city":customer["district"],"cus_country":"Bangladesh","cus_phone":customer["phone"],
        "shipping_method":"YES","ship_name":customer["name"],"ship_add1":customer["address"],"ship_city":customer["district"],"ship_country":"Bangladesh",
        "num_of_item":sum(x["qty"] for x in order.items_json),"product_name":"Glow Nuture order "+order.id,"product_category":"Skincare","product_profile":"physical-goods"
    },"POST")
    url=result.get("GatewayPageURL","")
    parsed=urlsplit(url) if isinstance(url,str) else None
    if result.get("status")!="SUCCESS" or not parsed or parsed.scheme!="https" or parsed.hostname!=urlsplit(gateway_base()).hostname or parsed.username:raise HTTPException(502,"Payment provider did not return a safe checkout URL")
    db.refresh(payment);payment.checkout_url=url;db.commit();return url
def validate_notification(db,payload):
    if not isinstance(payload,dict) or not verify_signature(payload) or payload.get("store_id")!=S.sslcommerz_store_id:raise HTTPException(400,"Invalid payment notification")
    oid=str(payload.get("tran_id",""))
    order=db.scalar(select(Order).where(Order.id==oid).with_for_update())
    payment=db.scalar(select(Payment).where(Payment.order_id==oid).with_for_update())
    if not order or not payment or order.payment!="online":raise HTTPException(404,"Payment order not found")
    try:matches=payload.get("currency")=="BDT" and minor(payload.get("amount"))==minor(order.total)
    except Exception:matches=False
    if not matches:raise HTTPException(400,"Payment amount or currency mismatch")
    if payload.get("status") in {"VALID","VALIDATED"}:
        result=gateway_json("/validator/api/validationserverAPI.php",{"val_id":payload.get("val_id"),"format":"json"})
    else:
        response=gateway_json("/validator/api/merchantTransIDvalidationAPI.php",{"tran_id":oid,"format":"json"})
        entries=response.get("element",[])
        result=next((row for row in entries if isinstance(row,dict) and row.get("tran_id")==oid),{}) if isinstance(entries,list) else {}
    try:
        verified=result.get("tran_id")==oid and result.get("currency")=="BDT" and minor(result.get("amount"))==minor(order.total) and result.get("store_id",S.sslcommerz_store_id)==S.sslcommerz_store_id
    except Exception:verified=False
    if not verified:raise HTTPException(400,"Payment provider verification did not match the order")
    state=result.get("status")
    if state in {"VALID","VALIDATED"}:
        val_id=str(result.get("val_id",""));tran_id=str(result.get("bank_tran_id",""))
        if not val_id or val_id!=str(payload.get("val_id","")) or not tran_id:raise HTTPException(400,"Missing verified payment identifiers")
        if payment.validation_id:
            if payment.validation_id!=val_id:raise HTTPException(409,"A different payment was already recorded")
            return {"ok":True,"duplicate":True,"payment_status":order.payment_status}
        risky=str(result.get("risk_level","1"))!="0" or order.stock_released or order.status!="pending"
        payment.validation_id=val_id;payment.transaction_id=tran_id;payment.status="review" if risky else "paid";order.payment_status=payment.status
        if not risky:order.status="confirmed"
        if "store_amount" in result:
            try:
                fee=order.total-__import__("decimal").Decimal(str(result["store_amount"]))
                if 0<=fee<=order.total:db.add(LedgerEntry(order_id=oid,kind="payment_fee",amount=fee,reference="payment_fee:"+oid))
            except Exception:pass
    elif state in {"FAILED","CANCELLED"}:
        if payment.validation_id:return {"ok":True,"duplicate":True,"payment_status":order.payment_status}
        if payment.status in {"failed","cancelled"}:return {"ok":True,"duplicate":True}
        release_stock(db,order,"payment."+state.lower());payment.status=state.lower();order.payment_status="unpaid";order.status="cancelled"
    else:raise HTTPException(409,"Payment has not been verified")
    db.add(AuditLog(action="payment.verified",entity="order",entity_id=oid,metadata_json={"status":payment.status}))
    notify(db,order,"payment.status","Payment status updated")
    try:db.commit()
    except IntegrityError:db.rollback();raise HTTPException(409,"Provider transaction was already recorded") from None
    return {"ok":True,"payment_status":order.payment_status}
