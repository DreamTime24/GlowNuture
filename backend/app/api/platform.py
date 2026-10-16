import csv,io,json,secrets,time
from datetime import timedelta
from decimal import Decimal
from typing import Annotated
from fastapi import APIRouter,Depends,HTTPException,Request,Response,Cookie,Query
from fastapi.responses import StreamingResponse,RedirectResponse
from starlette.concurrency import run_in_threadpool
from sqlalchemy import select,func,delete,update
from sqlalchemy.exc import IntegrityError
from ..db import get_db,SessionLocal
from ..models.entities import User,Session,Product,CatalogSource,Variant,Order,OrderItem,Coupon,Address,CustomerState,Payment,Shipment,Refund,ReturnRequest,Review,Notification,Outbox,PushSubscription,SupportMessage,Subscription,LedgerEntry,AuditLog,ImportLog,InventoryMovement,Batch
from ..core.config import get_settings
from ..core.auth import require_user,require_admin,customer_write,enforce_origin,verify_csrf,current_session,issue_session,SESSION_COOKIE,rate_limit,profile
from ..core.security import encrypt_text,decrypt_text,token_digest,utcnow,hmac_phone,normalize_phone,hash_password,verify_password,new_opaque_token
from ..schemas.common import RegisterIn,LoginIn,CustomerIn
from ..schemas.platform import FirebaseSessionIn,QuoteIn,CheckoutIn,TrackIn,ProfileIn,PreferencesIn,CustomerStateIn,ProductMutation,CouponIn,StatusIn,ShipmentIn,CodCollectionIn,RefundIn,RefundRecordIn,ReviewIn,ReasonIn,PushIn,ContactIn,NewsletterIn,ImportIn,StaffRoleIn,ExpenseIn
from ..services import firebase as FB,catalog,payments,catalog_jobs
from ..services import product_policy as product_policy,media as media_service
from ..services.catalog_normalize import url as public_source_url
from ..services.commerce import calculate,quote_output,create_checkout,order_output,minor,major,aware,expired_stock,change_status,expire_reservations
from ..realtime import broker
router=APIRouter();S=get_settings();_catalog_cache={}
def record(row):
    result={}
    for column in row.__table__.columns:
        if column.name.endswith(("_blob","_hash")) or column.name=="password_hash":continue
        v=getattr(row,column.name)
        result[column.name]=float(v) if isinstance(v,Decimal) else v.isoformat() if hasattr(v,"isoformat") else v
    return result
def user_data(user,db):
    return {"id":user.id,**profile(user),"role":user.role,"firebase_uid":user.firebase_uid,"email_verified":user.email_verified,"created_at":user.created_at.isoformat(),"preferences":user.preferences_json or {},"addresses":[{"id":row.id,**json.loads(decrypt_text(row.record_blob,S.pii_encryption_key))} for row in db.scalars(select(Address).where(Address.user_id==user.id)).all()]}
def product_out(p,db,admin=False):
    source=p.source_json if isinstance(p.source_json,dict) else {}
    result={"id":p.id,**{key:getattr(p,key) for key in ["sku","slug","name","en","brand","category","sub","short","description","size","origin","image_url","active","archived","content_verified","usage","warnings","condition"]},"price":float(p.price),"compare":p.compare,"stock":p.stock if admin else max(0,p.stock-expired_stock(db,p.id)),"tags":p.tags_json,"ingredients":p.ingredients_json,"images":p.images_json,"skin":p.skin_json,"source":p.source_json}
    result["image_assets"]=[media_service.public_asset(asset) for url in media_service.product_urls(p) if (asset:=media_service.asset_for_url(db,url)) and asset.product_id==p.id]
    if admin:
        result.update({"acquisition_cost":float(p.acquisition_cost),"publication_state":p.publication_state,"revision":p.revision,"approved_revision":p.approved_revision,"legacy_approved":p.legacy_approved,"gtin":p.gtin,"warnings":p.warnings,"condition":p.condition,"expiry_required":p.expiry_required,"unbatched_expires_at":p.unbatched_expires_at.isoformat() if p.unbatched_expires_at else None})
    else:
        result["source"]={key:source.get(key) for key in ["provider","attribution","license"] if isinstance(source.get(key),str) and source.get(key)}
        if source_url:=public_source_url(source.get("url")):result["source"]["url"]=source_url
        result["variants"]=[{"id":v.id,"sku":v.sku,"label":v.label,"price":float(v.price),"stock":max(0,v.stock-expired_stock(db,p.id,v.id))} for v in db.scalars(select(Variant).where(Variant.product_id==p.id,Variant.active.is_(True))).all()]
    return result
def staff(request,db,principal,permission="dashboard"):return require_admin(request,db,principal,permission)
def private_order(db,payload):
    row=db.get(Order,payload.order_id)
    if not row or not secrets.compare_digest(row.tracking_hash,token_digest(payload.token)):raise HTTPException(404,"Check your order number and private tracking code")
    return row
def owned_order(db,oid,user):
    row=db.get(Order,oid)
    if not row or row.user_id!=user.id:raise HTTPException(404,"Order not found")
    return row
def audit(db,actor,action,entity,ident=None,data=None):db.add(AuditLog(actor_user_id=actor.id if actor else None,action=action,entity=entity,entity_id=str(ident) if ident is not None else None,metadata_json=data))
def invoice_pdf(order):
    from reportlab.pdfgen import canvas
    stream=io.BytesIO();pdf=canvas.Canvas(stream,pagesize=(595,842));y=792
    def line(text,bold=False):
        nonlocal y
        if y<60:pdf.showPage();y=792
        pdf.setFont("Helvetica-Bold" if bold else "Helvetica",10)
        pdf.drawString(45,y,str(text).replace("\n"," ").replace("\r"," ")[:100]);y-=21
    line("GLOW NUTURE",True);line("Order receipt / "+order.id);line("Seller: "+S.seller_legal_name);line("Date: "+order.created_at.isoformat());line("Status: "+order.status+" / "+order.payment_status)
    for item in order.items_json:
        title=item["name"] if item["name"].isascii() else item["sku"]
        line(f"{title} | {item['qty']} x BDT {item['price']:.2f}")
    for label,value in [("Subtotal",order.subtotal),("Discount",order.discount),("Delivery",order.delivery),("Tax",order.tax),("Total",order.total)]:line(f"{label}: BDT {value:.2f}",label=="Total")
    line("Receipt does not itself confirm online payment.")
    line("Private tracking code (keep confidential):");line(decrypt_text(order.tracking_blob,S.pii_encryption_key))
    pdf.save();return stream.getvalue()
def reports(db):
    grouped=dict(db.execute(select(LedgerEntry.kind,func.sum(LedgerEntry.amount)).group_by(LedgerEntry.kind)).all());totals={key:float(value or 0) for key,value in grouped.items()}
    missing=db.scalar(select(func.count()).select_from(OrderItem).join(Order,Order.id==OrderItem.order_id).where(Order.status.in_(["delivered","returned","refunded"]),OrderItem.cost_complete.is_(False))) or 0
    net_sales=totals.get("sale",0)-totals.get("refund_sale",0)
    gross=net_sales-totals.get("cost",0)+totals.get("cost_return",0)
    net=gross+totals.get("shipping_income",0)-totals.get("refund_shipping",0)-sum(totals.get(k,0) for k in ["expense","shipping","payment_fee"])
    fee_missing=db.scalar(select(func.count()).select_from(Payment).where(Payment.provider=="online",Payment.validation_id.is_not(None),~select(LedgerEntry.id).where(LedgerEntry.order_id==Payment.order_id,LedgerEntry.kind=="payment_fee").exists())) or 0
    return {"recorded":totals,"net_sales":net_sales,"gross_profit":None if missing else gross,"net_profit":None if missing or fee_missing else net,"missing_cost_records":missing,"missing_fee_records":fee_missing,"currency":"BDT"}

@router.get("/api/health")
def health():return {"ok":True,"service":S.app_name,"time":utcnow().isoformat()}
@router.get("/api/ready")
def ready(db=Depends(get_db)):
    try:db.execute(select(1))
    except Exception:raise HTTPException(503,"Database is not ready") from None
    return {"ready":True,"database":"reachable"}
@router.get("/api/config")
def config():
    return {"brand":{"name":"Glow Nuture","facebook":S.facebook_url,"instagram":S.instagram_url},"seller":{"name":S.seller_legal_name,"address":S.seller_address,"email":S.support_email,"phone":S.support_phone},"firebase":{"enabled":S.firebase_enabled and bool(S.firebase_api_key and S.firebase_app_id and S.firebase_auth_domain),"config":{"apiKey":S.firebase_api_key,"authDomain":S.firebase_auth_domain,"projectId":S.firebase_project_id,"storageBucket":S.firebase_storage_bucket,"messagingSenderId":S.firebase_messaging_sender_id,"appId":S.firebase_app_id,"measurementId":S.firebase_measurement_id,"databaseURL":S.firebase_database_url},"vapidKey":S.firebase_vapid_key,"google":S.firebase_google_enabled,"facebook":S.firebase_facebook_enabled,"localAuth":S.local_auth_enabled,"appCheckSiteKey":S.app_check_site_key},"recaptcha":{"enabled":S.recaptcha_enabled,"siteKey":S.recaptcha_site_key,"mode":S.recaptcha_mode},"shipping":{"dhaka":S.shipping_dhaka,"outside":S.shipping_outside,"freeThreshold":S.free_shipping_threshold},"checkoutEnabled":S.checkout_enabled and bool(S.seller_legal_name and S.seller_address and S.support_email and S.support_phone),"payments":{"cod":S.cod_enabled,"online":bool(S.sslcommerz_store_id and S.sslcommerz_store_password),"sandbox":not S.sslcommerz_live},"analyticsEnabled":S.analytics_enabled,"aiEnabled":S.ai_enabled,"journalEnabled":S.journal_enabled}
@router.post("/api/auth/firebase/session")
def firebase_session(payload:FirebaseSessionIn,request:Request,response:Response,db=Depends(get_db)):
    enforce_origin(request);rate_limit("firebase:"+request.client.host,12,60);FB.verify_app_check(request);FB.verify_recaptcha(payload.recaptcha_token,request.client.host,"login")
    claims=FB.verify_token(payload.id_token);uid=claims["uid"]
    user=db.scalar(select(User).where(User.firebase_uid==uid))
    if user and not user.is_active:raise HTTPException(403,"This account is unavailable")
    if not user:
        user=User(firebase_uid=uid,phone_hash=FB.identity_hash("firebase:"+uid),password_hash="firebase-managed",role="customer")
        db.add(user);db.flush()
    previous=profile(user)
    data={**previous,"name":(payload.name or claims.get("name") or previous.get("name") or "Customer")[:120],"email":claims.get("email") or previous.get("email"),"phone":normalize_phone(claims.get("phone_number","")) or previous.get("phone","")}
    user.profile_blob=encrypt_text(json.dumps(data,ensure_ascii=False),S.pii_encryption_key);user.email_verified=bool(claims.get("email_verified"))
    db.commit();issue_session(db,user,response,claims);return user_data(user,db)
@router.post("/api/auth/register",status_code=201)
def local_register(payload:RegisterIn,request:Request,response:Response,db=Depends(get_db)):
    if not S.local_auth_enabled:raise HTTPException(409,"Use Firebase email or social sign-in")
    enforce_origin(request);rate_limit("register:"+request.client.host,5,300)
    phone=normalize_phone(payload.phone);digest=hmac_phone(phone,S.pii_hmac_key)
    if db.scalar(select(User).where(User.phone_hash==digest)):raise HTTPException(409,"An account exists for this mobile")
    user=User(phone_hash=digest,name=payload.name,email=str(payload.email) if payload.email else None,password_hash=hash_password(payload.password),role="customer",profile_blob=encrypt_text(json.dumps({"name":payload.name,"phone":phone,"email":str(payload.email) if payload.email else None}),S.pii_encryption_key))
    db.add(user);db.commit();issue_session(db,user,response);return user_data(user,db)
@router.post("/api/auth/login")
def local_login(payload:LoginIn,request:Request,response:Response,db=Depends(get_db)):
    if not S.local_auth_enabled:raise HTTPException(409,"Use Firebase email or social sign-in")
    enforce_origin(request);rate_limit("login:"+request.client.host)
    user=db.scalar(select(User).where(User.phone_hash==hmac_phone(payload.phone,S.pii_hmac_key)))
    if not user or not user.is_active or not verify_password(payload.password,user.password_hash):raise HTTPException(401,"Invalid credentials")
    issue_session(db,user,response);return user_data(user,db)
@router.get("/api/auth/me")
def me(db=Depends(get_db),token:Annotated[str|None,Cookie(alias=SESSION_COOKIE)]=None):
    sess,user=current_session(db,token)
    if not user or not user.is_active or (S.app_env=="production" and not user.firebase_uid):return None
    if user.firebase_uid:FB.verify_live_session(user.firebase_uid,sess.firebase_auth_time)
    return user_data(user,db)
@router.get("/api/auth/csrf")
def csrf_token(response:Response,db=Depends(get_db),token:Annotated[str|None,Cookie(alias=SESSION_COOKIE)]=None):
    sess,user=current_session(db,token)
    if not sess or not user or not user.is_active:return {"authenticated":False}
    raw=new_opaque_token();sess.csrf_hash=token_digest(raw);db.commit()
    response.set_cookie("gn_csrf",raw,httponly=False,secure=S.cookie_secure,samesite="lax",path="/",max_age=S.session_ttl_hours*3600)
    return {"authenticated":True}
@router.post("/api/auth/logout")
def logout(request:Request,response:Response,db=Depends(get_db),token:Annotated[str|None,Cookie(alias=SESSION_COOKIE)]=None):
    enforce_origin(request);sess,user=current_session(db,token)
    if sess:verify_csrf(request,sess);db.delete(sess);db.commit()
    response.delete_cookie(SESSION_COOKIE,path="/");response.delete_cookie("gn_csrf",path="/");return {"ok":True}
@router.get("/api/profile")
def get_profile(db=Depends(get_db),principal=Depends(require_user)):return user_data(principal[1],db)
@router.patch("/api/profile")
def update_profile(payload:ProfileIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    customer_write(request,principal);user=principal[1];old=profile(user)
    if user.firebase_uid and payload.email and str(payload.email)!=old.get("email"):raise HTTPException(400,"Change sign-in email through Firebase authentication")
    import re
    if payload.phone and not re.fullmatch(r"01[3-9]\d{8}",normalize_phone(payload.phone)):raise HTTPException(400,"Enter a valid Bangladesh mobile")
    data={**old,**payload.model_dump(mode="json",exclude_none=True)}
    if payload.phone:data["phone"]=normalize_phone(payload.phone)
    user.profile_blob=encrypt_text(json.dumps(data,ensure_ascii=False),S.pii_encryption_key);db.commit();return user_data(user,db)
@router.patch("/api/profile/preferences")
def preferences(payload:PreferencesIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    customer_write(request,principal);principal[1].preferences_json=payload.model_dump();db.commit();return {"ok":True}
@router.delete("/api/account")
def delete_account(request:Request,response:Response,db=Depends(get_db),principal=Depends(require_user)):
    customer_write(request,principal);sess,user=principal
    if user.role!="customer":raise HTTPException(409,"Staff accounts require owner review")
    if user.firebase_uid:
        if not sess.firebase_auth_time or time.time()-sess.firebase_auth_time>300:raise HTTPException(401,"Sign out and sign in again before deleting your account")
        FB.delete_identity(user.firebase_uid)
    for model in [Address,CustomerState,PushSubscription,Session,Notification,Outbox]:
        db.execute(delete(model).where(model.user_id==user.id))
    user.name="Deleted customer";user.email=None;user.profile_blob=None;user.firebase_uid=None;user.phone_hash=FB.identity_hash("deleted:"+secrets.token_hex(16));user.password_hash="deleted";user.is_active=False;user.preferences_json={};user.deleted_at=utcnow()
    audit(db,user,"account.deleted","user",user.id);db.commit()
    response.delete_cookie(SESSION_COOKIE,path="/");response.delete_cookie("gn_csrf",path="/");return {"ok":True}
@router.get("/api/customer/state")
def get_state(db=Depends(get_db),principal=Depends(require_user)):
    row=db.get(CustomerState,principal[1].id);return {"cart":row.cart_json,"wishlist":row.wishlist_json,"comparison":row.comparison_json} if row else {"cart":[],"wishlist":[],"comparison":[]}
@router.put("/api/customer/state")
def save_state(payload:CustomerStateIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    customer_write(request,principal)
    row=db.get(CustomerState,principal[1].id)
    if not row:row=CustomerState(user_id=principal[1].id);db.add(row)
    row.cart_json=[item.model_dump() for item in payload.cart];row.wishlist_json=list(dict.fromkeys(payload.wishlist));row.comparison_json=list(dict.fromkeys(payload.comparison));db.commit();return {"ok":True}
@router.post("/api/addresses",status_code=201)
def save_address(payload:CustomerIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    customer_write(request,principal)
    if db.scalar(select(func.count()).select_from(Address).where(Address.user_id==principal[1].id))>=20:raise HTTPException(409,"Address limit reached")
    row=Address(user_id=principal[1].id,record_blob=encrypt_text(payload.model_dump_json(),S.pii_encryption_key));db.add(row);db.commit();return {"id":row.id}
@router.delete("/api/addresses/{address_id}")
def delete_address(address_id:int,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    customer_write(request,principal);row=db.scalar(select(Address).where(Address.id==address_id,Address.user_id==principal[1].id))
    if not row:raise HTTPException(404,"Address not found")
    db.delete(row);db.commit();return {"ok":True}
@router.get("/api/products")
def products(db=Depends(get_db)):
    return [product_out(p,db) for p in db.scalars(select(Product).where(*product_policy.public_predicate()).order_by(Product.created_at.desc()).limit(2000)).all() if product_policy.eligible(db,p)]
@router.get("/api/products/{slug}")
def product(slug:str,db=Depends(get_db)):
    row=db.scalar(select(Product).where(Product.slug==slug,*product_policy.public_predicate()))
    if not product_policy.eligible(db,row):raise HTTPException(404,"Product not found")
    return product_out(row,db)
@router.post("/api/checkout/quote")
def quote(payload:QuoteIn,request:Request,db=Depends(get_db)):
    enforce_origin(request);rate_limit("quote:"+request.client.host,60,60);return quote_output(calculate(db,payload))
@router.post("/api/orders",status_code=201)
def checkout(payload:CheckoutIn,request:Request,response:Response,db=Depends(get_db),token:Annotated[str|None,Cookie(alias=SESSION_COOKIE)]=None):
    enforce_origin(request);rate_limit("order:"+request.client.host,12,60);FB.verify_app_check(request);FB.verify_recaptcha(payload.recaptcha_token,request.client.host,"checkout")
    sess,user=current_session(db,token)
    if user:
        if not user.is_active or (S.app_env=="production" and not user.firebase_uid):raise HTTPException(401,"Sign in again with Firebase")
        verify_csrf(request,sess)
        if user.firebase_uid:FB.verify_live_session(user.firebase_uid,sess.firebase_auth_time)
    order,created=create_checkout(db,payload,request.headers.get("Idempotency-Key"),user)
    response.status_code=201 if created else 200
    if created:broker.publish("admin","order.created",{"id":order.id,"total":float(order.total),"items":len(order.items_json)})
    return order_output(order,True)
@router.post("/api/orders/track")
def track(payload:TrackIn,request:Request,db=Depends(get_db)):
    enforce_origin(request);rate_limit("track:"+request.client.host,15,60);row=private_order(db,payload);expire_reservations(db);db.refresh(row)
    shipment=db.scalar(select(Shipment).where(Shipment.order_id==row.id))
    return {**order_output(row),"shipment":record(shipment) if shipment else None}
@router.get("/api/orders/me")
def my_orders(db=Depends(get_db),principal=Depends(require_user)):
    return [order_output(o) for o in db.scalars(select(Order).where(Order.user_id==principal[1].id).order_by(Order.created_at.desc()).limit(200)).all()]
@router.get("/api/orders/{order_id}")
def order_details(order_id:str,db=Depends(get_db),principal=Depends(require_user)):
    o=owned_order(db,order_id,principal[1]);shipment=db.scalar(select(Shipment).where(Shipment.order_id==o.id))
    return {**order_output(o,True),"customer":json.loads(decrypt_text(o.customer_blob,S.pii_encryption_key)),"shipment":record(shipment) if shipment else None}
@router.get("/api/orders/{order_id}/invoice")
def invoice(order_id:str,db=Depends(get_db),principal=Depends(require_user)):
    o=owned_order(db,order_id,principal[1]);return Response(invoice_pdf(o),media_type="application/pdf",headers={"Content-Disposition":f'attachment; filename="{o.id}.pdf"'})
@router.post("/api/invoices/guest")
def guest_invoice(payload:TrackIn,request:Request,db=Depends(get_db)):
    enforce_origin(request);rate_limit("invoice:"+request.client.host,15,60);o=private_order(db,payload)
    return Response(invoice_pdf(o),media_type="application/pdf",headers={"Content-Disposition":f'attachment; filename="{o.id}.pdf"'})
@router.post("/api/orders/{order_id}/returns",status_code=201)
def request_return(order_id:str,payload:ReasonIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    customer_write(request,principal);o=owned_order(db,order_id,principal[1])
    if o.status not in {"delivered","failed_delivery"}:raise HTTPException(409,"Order is not eligible for a return")
    row=db.scalar(select(ReturnRequest).where(ReturnRequest.order_id==o.id,ReturnRequest.status=="requested"))
    if not row:row=ReturnRequest(order_id=o.id,user_id=principal[1].id,reason=payload.reason);db.add(row);db.commit()
    return record(row)
@router.get("/api/products/{product_id}/reviews")
def reviews(product_id:int,db=Depends(get_db)):
    return [{"id":r.id,"name":profile(db.get(User,r.user_id)).get("name","Customer").split(" ")[0],"rating":r.rating,"text":r.text,"date":r.created_at.isoformat(),"verified":True} for r in db.scalars(select(Review).where(Review.product_id==product_id,Review.approved.is_(True)).order_by(Review.created_at.desc()).limit(100)).all()]
@router.post("/api/products/{product_id}/reviews",status_code=201)
def add_review(product_id:int,payload:ReviewIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    customer_write(request,principal);o=owned_order(db,payload.order_id,principal[1])
    if o.status!="delivered" or not db.scalar(select(OrderItem.id).where(OrderItem.order_id==o.id,OrderItem.product_id==product_id)):raise HTTPException(403,"Only delivered purchases may be reviewed")
    row=db.scalar(select(Review).where(Review.product_id==product_id,Review.user_id==principal[1].id))
    if not row:row=Review(product_id=product_id,user_id=principal[1].id,order_id=o.id);db.add(row)
    row.rating=payload.rating;row.text=payload.text;row.approved=False;db.commit();return {"ok":True,"status":"pending_review"}
@router.get("/api/notifications")
def notifications(db=Depends(get_db),principal=Depends(require_user)):
    return [record(r) for r in db.scalars(select(Notification).where(Notification.user_id==principal[1].id).order_by(Notification.created_at.desc()).limit(100)).all()]
@router.patch("/api/notifications/{notification_id}")
def read_notification(notification_id:int,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    customer_write(request,principal);row=db.scalar(select(Notification).where(Notification.id==notification_id,Notification.user_id==principal[1].id))
    if not row:raise HTTPException(404,"Notification not found")
    row.read=True;db.commit();return {"ok":True}
@router.post("/api/push/subscriptions")
def push_subscribe(payload:PushIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    customer_write(request,principal)
    if not payload.consent:raise HTTPException(400,"Notification consent is required")
    digest=token_digest(payload.token);row=db.scalar(select(PushSubscription).where(PushSubscription.token_hash==digest))
    if row and row.user_id!=principal[1].id:raise HTTPException(409,"Device token is linked to another account")
    if not row:row=PushSubscription(user_id=principal[1].id,token_hash=digest,token_blob=encrypt_text(payload.token,S.pii_encryption_key));db.add(row)
    row.active=True;row.marketing=payload.marketing;db.commit();return {"ok":True}
@router.delete("/api/push/subscriptions")
def push_disable(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    customer_write(request,principal);db.execute(update(PushSubscription).where(PushSubscription.user_id==principal[1].id).values(active=False));db.commit();return {"ok":True}
@router.post("/api/contact",status_code=201)
def contact(payload:ContactIn,request:Request,db=Depends(get_db)):
    enforce_origin(request);rate_limit("contact:"+request.client.host,5,300)
    if payload.website:return {"ok":True}
    if not payload.consent:raise HTTPException(400,"Support consent is required")
    db.add(SupportMessage(record_blob=encrypt_text(payload.model_dump_json(),S.pii_encryption_key)));db.commit();return {"ok":True}
@router.post("/api/newsletter",status_code=201)
def newsletter(payload:NewsletterIn,request:Request,db=Depends(get_db)):
    enforce_origin(request);rate_limit("newsletter:"+request.client.host,5,300)
    if not payload.consent:raise HTTPException(400,"Subscription consent is required")
    digest=FB.identity_hash("email:"+str(payload.email).lower());row=db.scalar(select(Subscription).where(Subscription.email_hash==digest))
    if not row:db.add(Subscription(email_hash=digest,record_blob=encrypt_text(payload.model_dump_json(),S.pii_encryption_key)))
    else:row.active=True
    db.commit();return {"ok":True}
@router.get("/api/catalog/ordinary")
def reference_catalog(request:Request,start:int=Query(default=0,ge=0,le=480),db=Depends(get_db)):
    rate_limit("catalog:"+request.client.host,30,60)
    if not S.catalog_reference_enabled:raise HTTPException(503,"This collection is not open yet. See the approved shop.")
    if start%12:raise HTTPException(400,"Use offsets in multiples of 12")
    rows=db.scalars(select(Product).where(*product_policy.public_predicate(),Product.brand.in_(["The Ordinary","TheOrdinary"])).order_by(Product.id).offset(start).limit(12)).all()
    return [{**product_out(product,db),"currency":"BDT"} for product in rows if product_policy.eligible(db,product)]
@router.get("/api/search/suggestions")
def suggestions(q:str="",db=Depends(get_db)):
    q=q.strip()[:100]
    if len(q)<2:return []
    pattern="%"+q.replace("%",r"\%").replace("_",r"\_")+"%"
    return [{"name":p.name,"en":p.en,"slug":p.slug} for p in db.scalars(select(Product).where(*product_policy.public_predicate(),Product.name.ilike(pattern,escape="\\")).limit(8)).all() if product_policy.eligible(db,p)]
@router.get("/api/admin/dashboard")
def dashboard(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal)
    day=utcnow().replace(hour=0,minute=0,second=0,microsecond=0)
    count=lambda *where:db.scalar(select(func.count()).select_from(Order).where(*where)) or 0
    low=db.scalars(select(Product).where(Product.active.is_(True),Product.stock<=10).limit(12)).all()
    return {"total_orders":count(),"orders_today":count(Order.created_at>=day),"pending_orders":count(Order.status.in_(["pending","confirmed","processing","packed"])),"revenue":float(db.scalar(select(func.coalesce(func.sum(Order.total),0)).where(Order.status=="delivered")) or 0),"by_status":dict(db.execute(select(Order.status,func.count()).group_by(Order.status)).all()),"products":db.scalar(select(func.count()).select_from(Product)) or 0,"low_stock":[{"id":p.id,"name":p.name,"stock":p.stock} for p in low],"viewers":broker.viewers()}
@router.get("/api/admin/products")
def admin_products(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal,"inventory");return [product_out(p,db,True) for p in db.scalars(select(Product).order_by(Product.updated_at.desc())).all()]
@router.post("/api/admin/products",status_code=201)
def create_product(payload:ProductMutation,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal,"inventory");data=payload.model_dump(exclude_unset=True,exclude_none=True)
    data=product_policy.reject_legacy_flags(data);data.pop("revision",None)
    if not {"sku","slug","name","price"}.issubset(data):raise HTTPException(422,"SKU, slug, name and price are required")
    if data.get("active") and (not data.get("content_verified") or data["price"]<=0):raise HTTPException(400,"Approve content and a BDT price before publishing")
    row=Product(**data);db.add(row)
    try:
        db.flush()
        media_service.attach_images(db,row)
        if row.stock:db.add(InventoryMovement(product_id=row.id,delta=row.stock,reason="admin.initial_stock",actor_user_id=actor.id))
        audit(db,actor,"product.created","product",row.id);db.commit()
    except IntegrityError:db.rollback();raise HTTPException(409,"SKU or slug already exists") from None
    return product_out(row,db,True)
@router.patch("/api/admin/products/{product_id}")
def edit_product(product_id:int,payload:ProductMutation,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal,"inventory");row=db.scalar(select(Product).where(Product.id==product_id).with_for_update())
    if not row:raise HTTPException(404,"Product not found")
    data=payload.model_dump(exclude_unset=True,exclude_none=True)
    if data.get("active",row.active) and (not data.get("content_verified",row.content_verified) or data.get("price",row.price)<=0):raise HTTPException(400,"Approve content and a BDT price before publishing")
    if "stock" in data and data["stock"]!=row.stock:
        tracked=db.scalar(select(func.coalesce(func.sum(Batch.remaining),0)).where(Batch.product_id==row.id,Batch.variant_id.is_(None))) or 0
        if data["stock"]<tracked:raise HTTPException(409,"Reconcile tracked batches before reducing stock")
        db.add(InventoryMovement(product_id=row.id,delta=data["stock"]-row.stock,reason="admin.stock_adjusted",actor_user_id=actor.id))
    product_policy.apply_edit(db,row,data,actor)
    audit(db,actor,"product.updated","product",row.id,{"fields":list(data)})
    try:db.commit()
    except IntegrityError:db.rollback();raise HTTPException(409,"SKU or slug already exists") from None
    broker.publish("public","product",{"id":row.id,"price":float(row.price),"stock":max(0,row.stock-expired_stock(db,row.id)),"active":row.active and row.content_verified and not row.archived})
    return product_out(row,db,True)
@router.get("/api/admin/orders")
def admin_orders(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal,"orders");return [{**order_output(o),"customer":json.loads(decrypt_text(o.customer_blob,S.pii_encryption_key))} for o in db.scalars(select(Order).order_by(Order.created_at.desc()).limit(200)).all()]
@router.patch("/api/admin/orders/{order_id}/status")
def order_status(order_id:str,payload:StatusIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal,"orders");o=db.scalar(select(Order).where(Order.id==order_id).with_for_update())
    if not o:raise HTTPException(404,"Order not found")
    change_status(db,o,payload,actor);broker.publish("admin","order.status",{"id":o.id,"status":o.status});return {"ok":True,"status":o.status}
@router.post("/api/admin/orders/{order_id}/shipment")
def save_shipment(order_id:str,payload:ShipmentIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal,"orders");o=db.get(Order,order_id)
    if not o or o.status in {"cancelled","returned","refunded"}:raise HTTPException(409,"Order is unavailable for dispatch")
    row=db.scalar(select(Shipment).where(Shipment.order_id==order_id))
    if not row:row=Shipment(order_id=order_id,**payload.model_dump());db.add(row)
    else:
        if row.status in {"delivered","returned"}:raise HTTPException(409,"Shipment is closed")
        for k,v in payload.model_dump().items():setattr(row,k,v)
    row.events_json=[*(row.events_json or []),{"status":"manual_reference_recorded","at":utcnow().isoformat()}]
    entry=db.scalar(select(LedgerEntry).where(LedgerEntry.reference=="shipping:"+order_id))
    if not entry:db.add(LedgerEntry(order_id=order_id,kind="shipping",amount=payload.shipping_cost,reference="shipping:"+order_id))
    else:entry.amount=payload.shipping_cost
    audit(db,actor,"shipment.manual_record","order",order_id);db.commit();return record(row)
@router.post("/api/admin/orders/{order_id}/cod")
def record_cod(order_id:str,payload:CodCollectionIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal,"orders");o=db.scalar(select(Order).where(Order.id==order_id).with_for_update());shipment=db.scalar(select(Shipment).where(Shipment.order_id==order_id))
    if not o or o.payment!="cod" or o.status!="delivered" or not shipment:raise HTTPException(409,"Only delivered COD shipments can record collection")
    if minor(payload.amount)!=minor(o.total):raise HTTPException(400,"Collected amount must match the order")
    if o.payment_status=="cod_collected":
        if shipment.cod_reference!=payload.reference:raise HTTPException(409,"Collection was already recorded")
        return {"ok":True}
    o.payment_status="cod_collected";shipment.cod_collected=payload.amount;shipment.cod_reference=payload.reference
    payment=db.scalar(select(Payment).where(Payment.order_id==o.id));payment.status="cod_collected"
    db.add(LedgerEntry(order_id=o.id,kind="cod_collection",amount=payload.amount,reference="cod:"+o.id,description=payload.reference))
    audit(db,actor,"cod.collected","order",o.id);db.commit();return {"ok":True}
@router.get("/api/admin/orders/{order_id}/invoice")
def admin_invoice(order_id:str,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal,"support" if principal[1].role=="customer_support" else "orders");o=db.get(Order,order_id)
    if not o:raise HTTPException(404,"Order not found")
    return Response(invoice_pdf(o),media_type="application/pdf",headers={"Content-Disposition":f'attachment; filename="{o.id}.pdf"'})
@router.post("/api/admin/imports/ordinary",status_code=202)
def import_ordinary(payload:ImportIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal,"inventory")
    rate_limit("import:"+str(actor.id),3,300)
    source=db.scalar(select(CatalogSource).where(CatalogSource.kind=="ordinary",CatalogSource.enabled.is_(True)))
    if not source:raise HTTPException(409,"Register an owner-authorized Ordinary source in Catalog sources first")
    job=catalog_jobs.enqueue(db,source,actor,request.headers.get("Idempotency-Key") or secrets.token_hex(16),payload.start,payload.pages)
    result=record(job)
    result.pop("input_rows_json",None)
    return result
@router.get("/api/admin/imports")
def imports(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal,"inventory");return [record(r) for r in db.scalars(select(ImportLog).order_by(ImportLog.created_at.desc()).limit(50)).all()]
@router.get("/api/admin/inventory")
def inventory(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal,"inventory");return [record(r) for r in db.scalars(select(InventoryMovement).order_by(InventoryMovement.created_at.desc()).limit(200)).all()]
@router.get("/api/admin/coupons")
def coupons(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal,"marketing");return [record(r) for r in db.scalars(select(Coupon)).all()]
@router.post("/api/admin/coupons")
def save_coupon(payload:CouponIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal,"marketing");data=payload.model_dump();data["code"]=data["code"].upper()
    row=db.scalar(select(Coupon).where(Coupon.code==data["code"]))
    if not row:row=Coupon(**data);db.add(row)
    else:
        for k,v in data.items():setattr(row,k,v)
    audit(db,actor,"coupon.updated","coupon",data["code"]);db.commit();return record(row)
@router.get("/api/admin/returns")
def returns(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal,"orders");return [record(r) for r in db.scalars(select(ReturnRequest)).all()]
@router.post("/api/admin/orders/{order_id}/refunds",status_code=201)
def refund_request(order_id:str,payload:RefundIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal,"accounting");o=db.scalar(select(Order).where(Order.id==order_id).with_for_update())
    if not o or o.payment_status not in {"paid","review","cod_collected","partially_refunded"}:raise HTTPException(409,"No captured payment available for refund")
    used=db.scalar(select(func.coalesce(func.sum(Refund.amount),0)).where(Refund.order_id==o.id,Refund.status.in_(["requested","refunded"]))) or Decimal(0)
    if minor(used+payload.amount)>minor(o.total):raise HTTPException(400,"Refund exceeds captured amount")
    row=Refund(order_id=o.id,amount=payload.amount,reason=payload.reason);db.add(row)
    audit(db,actor,"refund.requested","order",o.id);db.commit();return record(row)
@router.get("/api/admin/refunds")
def refunds(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal,"accounting");return [record(r) for r in db.scalars(select(Refund)).all()]
@router.post("/api/admin/refunds/{refund_id}/record")
def refund_record(refund_id:int,payload:RefundRecordIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal,"accounting");row=db.scalar(select(Refund).where(Refund.id==refund_id).with_for_update())
    if not row or not payload.operator_confirmed or minor(payload.confirmed_amount)!=minor(row.amount):raise HTTPException(400,"Confirm actual provider reference and exact refund amount")
    if row.status=="refunded":
        if row.provider_reference!=payload.provider_reference:raise HTTPException(409,"Refund was already recorded")
        return record(row)
    o=db.scalar(select(Order).where(Order.id==row.order_id).with_for_update());total=db.scalar(select(func.coalesce(func.sum(Refund.amount),0)).where(Refund.order_id==o.id,Refund.status=="refunded")) or Decimal(0)
    total+=row.amount;full=minor(total)==minor(o.total)
    if minor(total)>minor(o.total):raise HTTPException(409,"Refund exceeds captured total")
    row.status="refunded";row.provider_reference=payload.provider_reference;o.payment_status="refunded" if full else "partially_refunded"
    if full and o.status=="returned":o.status="refunded"
    payment=db.scalar(select(Payment).where(Payment.order_id==o.id));payment.status=o.payment_status
    db.add(LedgerEntry(order_id=o.id,kind="refund",amount=row.amount,reference="refund:"+str(row.id)))
    recognized=bool(db.scalar(select(LedgerEntry.id).where(LedgerEntry.order_id==o.id,LedgerEntry.kind=="sale")))
    bases={"sale":minor(o.subtotal-o.discount),"shipping":minor(o.delivery),"tax":minor(o.tax)} if recognized else {"sale":0,"shipping":0,"tax":0}
    capacities={}
    for key in ["sale","shipping","tax"]:
        previous=db.scalar(select(func.coalesce(func.sum(LedgerEntry.amount),0)).where(LedgerEntry.order_id==o.id,LedgerEntry.kind=="refund_"+key)) or Decimal(0)
        capacities[key]=max(0,bases[key]-minor(previous))
    from ..services.commerce import allocate_refund
    for key,allocation in allocate_refund(minor(row.amount),capacities).items():
        db.add(LedgerEntry(order_id=o.id,kind="refund_"+key,amount=major(allocation),reference="refund_"+key+":"+str(row.id)))
    audit(db,actor,"refund.externally_recorded","refund",row.id)
    try:db.commit()
    except IntegrityError:db.rollback();raise HTTPException(409,"Provider refund reference already exists") from None
    return record(row)
@router.get("/api/admin/reviews")
def admin_reviews(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal,"support");return [record(r) for r in db.scalars(select(Review)).all()]
@router.post("/api/admin/reviews/{review_id}/approve")
def approve_review(review_id:int,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal,"support");row=db.get(Review,review_id)
    if not row:raise HTTPException(404,"Review not found")
    row.approved=True;audit(db,actor,"review.approved","review",row.id);db.commit();return {"ok":True}
@router.get("/api/admin/customers")
def customers(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal,"support");return [user_data(u,db) for u in db.scalars(select(User).order_by(User.created_at.desc()).limit(200)).all()]
@router.get("/api/admin/support")
def support(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal,"support");return [{"id":r.id,**json.loads(decrypt_text(r.record_blob,S.pii_encryption_key)),"created_at":r.created_at.isoformat()} for r in db.scalars(select(SupportMessage).order_by(SupportMessage.created_at.desc()).limit(100)).all()]
@router.get("/api/admin/support/orders")
def support_orders(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal,"support");return [{**order_output(o),"customer":json.loads(decrypt_text(o.customer_blob,S.pii_encryption_key))} for o in db.scalars(select(Order).order_by(Order.created_at.desc()).limit(200)).all()]
@router.get("/api/admin/staff")
def staff_list(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal,"staff");return [user_data(u,db) for u in db.scalars(select(User).where(User.role!="customer")).all()]
@router.patch("/api/admin/staff/{user_id}")
def set_role(user_id:int,payload:StaffRoleIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal,"staff")
    if not payload.confirm or actor.id==user_id:raise HTTPException(409,"Verify the exact account; your own role cannot change here")
    row=db.get(User,user_id)
    if not row or row.deleted_at:raise HTTPException(404,"Active account not found")
    row.role=payload.role;row.is_active=payload.is_active;db.execute(delete(Session).where(Session.user_id==row.id))
    audit(db,actor,"staff.role_changed","user",row.id,payload.model_dump());db.commit();return {"ok":True}
@router.get("/api/admin/audit")
def audit_log(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal,"staff");return [record(r) for r in db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(200)).all()]
@router.get("/api/admin/reports")
def finance(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal,"accounting");return reports(db)
@router.get("/api/admin/ledger")
def ledger(request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal,"accounting");return [record(r) for r in db.scalars(select(LedgerEntry).order_by(LedgerEntry.created_at.desc()).limit(1000)).all()]
@router.post("/api/admin/expenses",status_code=201)
def expense(payload:ExpenseIn,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    actor=staff(request,db,principal,"accounting");row=LedgerEntry(kind="expense",**payload.model_dump());db.add(row);audit(db,actor,"expense.recorded","ledger",data={"reference":payload.reference})
    try:db.commit()
    except IntegrityError:db.rollback();raise HTTPException(409,"Expense reference already recorded") from None
    return record(row)
@router.get("/api/admin/exports/{kind}")
def export(kind:str,request:Request,db=Depends(get_db),principal=Depends(require_user)):
    staff(request,db,principal,"inventory" if kind=="products" else "accounting")
    if kind=="products":rows=[{"sku":p.sku,"name":p.name,"price_bdt":float(p.price),"stock":p.stock,"published":p.active} for p in db.scalars(select(Product)).all()]
    elif kind=="ledger":rows=[record(r) for r in db.scalars(select(LedgerEntry)).all()]
    else:raise HTTPException(404,"Export not found")
    stream=io.StringIO();writer=csv.DictWriter(stream,fieldnames=list(rows[0]) if rows else ["empty"]);writer.writeheader()
    for row in rows:writer.writerow({k:"'"+v if isinstance(v,str) and v.lstrip(" \t\r\n").startswith(("=","+","-","@")) else v for k,v in row.items()})
    return Response(stream.getvalue().encode("utf-8-sig"),media_type="text/csv",headers={"Content-Disposition":f'attachment; filename="{kind}.csv"'})
@router.post("/api/payments/{order_id}/initiate")
def start_payment(order_id:str,payload:TrackIn,request:Request,db=Depends(get_db)):
    enforce_origin(request);rate_limit("payment:"+request.client.host,8,300);o=private_order(db,payload)
    if order_id!=payload.order_id:raise HTTPException(404,"Order not found")
    return {"payment_url":payments.initiate(db,o),"sandbox":not S.sslcommerz_live}
@router.post("/api/payments/ipn")
async def ipn(request:Request,db=Depends(get_db)):
    rate_limit("ipn:"+request.client.host,60,60)
    payload=await request.json() if request.headers.get("content-type","").startswith("application/json") else dict(await request.form())
    return await run_in_threadpool(payments.validate_notification,db,payload)
@router.post("/api/payments/return")
async def payment_return(request:Request,db=Depends(get_db)):
    payload=await request.json() if request.headers.get("content-type","").startswith("application/json") else dict(await request.form())
    try:await run_in_threadpool(payments.validate_notification,db,payload)
    except HTTPException:pass
    return RedirectResponse("/#/track",303)
@router.get("/api/public/stats")
def public_stats(db=Depends(get_db)):
    return {"products":db.scalar(select(func.count()).select_from(Product).where(*product_policy.public_predicate())) or 0,"orders_delivered":db.scalar(select(func.count()).select_from(Order).where(Order.status=="delivered")) or 0,"districts":None}
@router.get("/api/realtime/stream")
async def realtime(request:Request):return StreamingResponse(broker.stream("public",request,None),media_type="text/event-stream",headers={"Cache-Control":"no-cache","X-Accel-Buffering":"no"})
@router.get("/api/realtime/admin")
async def realtime_admin(request:Request,token:Annotated[str|None,Cookie(alias=SESSION_COOKIE)]=None):
    with SessionLocal() as db:
        sess,user=current_session(db,token)
        if not sess or not user or not user.is_active:raise HTTPException(401,"Authentication required")
        if user.firebase_uid:FB.verify_live_session(user.firebase_uid,sess.firebase_auth_time)
        require_admin(request,db,(sess,user))
    return StreamingResponse(broker.stream("admin",request,None),media_type="text/event-stream",headers={"Cache-Control":"no-cache","X-Accel-Buffering":"no"})
