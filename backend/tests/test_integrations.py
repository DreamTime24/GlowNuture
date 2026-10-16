import hashlib,json,secrets,time
from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace
import httpx,pytest
from fastapi import HTTPException
from sqlalchemy import select,func
from app.models.entities import Product,Order,Payment,Variant,Coupon,Refund,Review,User,Session,Notification,Outbox,Purchase,Batch,StockAllocation,LedgerEntry
from app.services import catalog,payments,firebase as FB
from app.services.commerce import minor
from app.core.config import get_settings,Settings
from app.core.security import utcnow
from conftest import place,checkout_payload
S=get_settings()
def signed(oid,amount="180.25",status="VALID",val="offline-validation-id"):
    payload={"tran_id":oid,"amount":amount,"currency":"BDT","status":status,"store_id":S.sslcommerz_store_id}
    if status in {"VALID","VALIDATED"}:payload["val_id"]=val
    keys=sorted(payload);values={**payload,"store_passwd":hashlib.md5(S.sslcommerz_store_password.encode()).hexdigest()}
    payload["verify_key"]=",".join(keys);payload["verify_sign"]=hashlib.md5("&".join(f"{k}={values[k]}" for k in sorted(values)).encode()).hexdigest()
    return payload
def verified(oid,amount="180.25",val="offline-validation-id"):
    return {"status":"VALIDATED","tran_id":oid,"amount":amount,"currency":"BDT","val_id":val,"bank_tran_id":"offline-bank-reference","risk_level":"0","store_amount":"175.00"}

def test_parse_response_shapes():
    assert catalog.extract({"data":{"products":[{"name":"A"}]}})==[{"name":"A"}]
    assert catalog.extract({"data":[{"name":"B"}]})==[{"name":"B"}]
    with pytest.raises(HTTPException):catalog.extract({"data":{"error":"wrong shape"}})
def test_parse_safe_missing_fields():
    r=catalog.public_record({"name":"Formula","images":[{"url":"javascript:alert(1)"},{"url":"https://example.com/1.jpg"}],"ingredients":[{"name":"Zinc"}]})
    assert r["images"]==["https://example.com/1.jpg"] and r["ingredients"]==["Zinc"] and r["price"] is None
def test_parse_method_headers_body_retry(monkeypatch):
    requests=[]
    def handler(request):
        requests.append(request)
        return httpx.Response(503) if len(requests)==1 else httpx.Response(200,json={"data":{"products":[{"name":"Formula"}]}})
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:result=catalog.fetch_page(0,client)
    assert result[0]["name"]=="Formula" and len(requests)==2
    assert requests[-1].method=="POST"
    assert requests[-1].headers["x-api-key"]=="offline-fixture-key"
    assert json.loads(requests[-1].content)=={"start":0,"limit":12}
def test_import_dedup_and_local_override_preservation(db):
    data={"id":"upstream-fixture-id","name":"Ordinary Formula","price":"9.50","currency":"GBP","image_url":"https://example.com/img.jpg","key_ingredients":["Zinc"]}
    def handler(request):return httpx.Response(200,json={"data":[data]})
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        assert catalog.import_products(db,client=client)["created"]==1
        product=db.scalar(select(Product));assert not product.active and not product.content_verified and product.stock==0 and product.price==0
        product.price=Decimal("1250");product.stock=8;product.name="Approved local title";product.content_verified=True;product.active=True;db.commit()
        data["price"]="10.50";data["name"]="Changed upstream title"
        result=catalog.import_products(db,client=client);assert result["created"]==0 and result["updated"]==1
        db.refresh(product);assert product.price==1250 and product.stock==8 and product.name=="Approved local title" and product.source_json["price"]=="10.50"
        assert db.scalar(select(func.count()).select_from(Product))==1
def test_catalog_timeout_is_safe():
    def handler(request):raise httpx.ConnectTimeout("fixture secret URL must not be emitted",request=request)
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(HTTPException) as error:catalog.fetch_page(0,client)
    assert error.value.status_code==502 and "secret" not in error.value.detail
def test_forged_payment_does_not_mark_paid(client,product,customer,db):
    o=place(client,product,customer,payment="online")
    assert client.post("/api/payments/ipn",json={"tran_id":o["id"],"status":"VALID","amount":"180.25","currency":"BDT"}).status_code==400
    assert db.get(Order,o["id"]).payment_status=="pending"
def test_signed_tampered_amount_rejected(client,product,customer,db,monkeypatch):
    o=place(client,product,customer,payment="online")
    monkeypatch.setattr(payments,"gateway_json",lambda *args:verified(o["id"],"1.00"))
    assert client.post("/api/payments/ipn",json=signed(o["id"],"1.00")).status_code==400
    assert db.get(Order,o["id"]).payment_status=="pending"
def test_duplicate_verified_payment_only_records_once(client,product,customer,db,monkeypatch):
    o=place(client,product,customer,payment="online")
    monkeypatch.setattr(payments,"gateway_json",lambda *args:verified(o["id"]))
    payload=signed(o["id"])
    assert client.post("/api/payments/ipn",json=payload).status_code==200
    assert client.post("/api/payments/ipn",json=payload).json()["duplicate"] is True
    db.expire_all();assert db.get(Order,o["id"]).payment_status=="paid"
    assert db.get(Order,o["id"]).status=="confirmed"
    assert db.scalar(select(func.count()).select_from(LedgerEntry).where(LedgerEntry.kind=="payment_fee"))==1
def test_provider_mismatch_is_rejected(client,product,customer,db,monkeypatch):
    o=place(client,product,customer,payment="online")
    monkeypatch.setattr(payments,"gateway_json",lambda *args:verified("different-order"))
    assert client.post("/api/payments/ipn",json=signed(o["id"])).status_code==400
    assert db.get(Order,o["id"]).payment_status=="pending"
def test_late_capture_is_reviewed_without_reallocating_stock(client,product,customer,db,make_client,monkeypatch):
    o=place(client,product,customer,payment="online");admin=make_client("super_admin")
    assert admin.patch("/api/admin/orders/"+o["id"]+"/status",json={"status":"cancelled","reason":"Offline fixture cancellation"}).status_code==200
    monkeypatch.setattr(payments,"gateway_json",lambda *args:verified(o["id"]))
    assert client.post("/api/payments/ipn",json=signed(o["id"])).status_code==200
    db.expire_all();assert db.get(Order,o["id"]).payment_status=="review" and db.get(Product,product.id).stock==5
def test_payment_failure_is_verified_and_releases_once(client,product,customer,db,monkeypatch):
    o=place(client,product,customer,payment="online")
    monkeypatch.setattr(payments,"gateway_json",lambda *args:{"element":[{"tran_id":o["id"],"amount":"180.25","currency":"BDT","status":"FAILED"}]})
    p=signed(o["id"],status="FAILED")
    assert client.post("/api/payments/ipn",json=p).status_code==200
    assert client.post("/api/payments/ipn",json=p).json()["duplicate"] is True
    db.expire_all();assert db.get(Product,product.id).stock==5
def test_payment_initiation_uses_safe_host_once(client,product,customer,db,monkeypatch):
    o=place(client,product,customer,payment="online");calls=[]
    def gateway(*args):calls.append(args);return {"status":"SUCCESS","GatewayPageURL":"https://sandbox.sslcommerz.com/offline-fixture"}
    monkeypatch.setattr(payments,"gateway_json",gateway)
    p={"order_id":o["id"],"token":o["tracking_token"]};url="/api/payments/"+o["id"]+"/initiate"
    assert client.post(url,json=p).status_code==200
    assert client.post(url,json=p).status_code==200
    assert len(calls)==1
def test_bad_payment_host_rejected(client,product,customer,monkeypatch):
    o=place(client,product,customer,payment="online")
    monkeypatch.setattr(payments,"gateway_json",lambda *args:{"status":"SUCCESS","GatewayPageURL":"https://evil.example.com/checkout"})
    assert client.post("/api/payments/"+o["id"]+"/initiate",json={"order_id":o["id"],"token":o["tracking_token"]}).status_code==502
def test_staff_mfa_is_enforced(make_client,db):
    client=make_client("super_admin");session=db.scalar(select(Session));session.mfa_verified=False;db.commit()
    assert client.get("/api/admin/dashboard").status_code==403
    assert client.get("/api/orders/non-owned-order").status_code==404
def test_revoked_account_is_not_authenticated(make_client,db):
    client=make_client();user=db.scalar(select(User));user.is_active=False;db.commit()
    assert client.get("/api/auth/me").json() is None and client.get("/api/profile").status_code==401
def test_verified_purchase_review_and_return_flow(make_client,product,customer,db):
    customer_client=make_client();o=place(customer_client,product,customer);oid=o["id"]
    assert customer_client.post("/api/products/"+str(product.id)+"/reviews",json={"order_id":oid,"rating":5,"text":"Offline fixture review"}).status_code==403
    db.get(Order,oid).status="delivered";db.commit()
    assert customer_client.post("/api/products/"+str(product.id)+"/reviews",json={"order_id":oid,"rating":5,"text":"Offline fixture review"}).status_code==201
    assert customer_client.get("/api/products/"+str(product.id)+"/reviews").json()==[]
    staff=make_client("customer_support")
    review=db.scalar(select(Review))
    assert staff.post("/api/admin/reviews/"+str(review.id)+"/approve",json={}).status_code==200
    assert customer_client.get("/api/products/"+str(product.id)+"/reviews").json()[0]["verified"]
    assert customer_client.post("/api/orders/"+oid+"/returns",json={"reason":"Offline fixture return reason"}).status_code==201
def test_refund_limits_manual_confirmation_and_idempotency(client,product,customer,make_client,db):
    o=place(client,product,customer);order=db.get(Order,o["id"]);order.status="delivered";order.payment_status="cod_collected";db.scalar(select(Payment)).status="cod_collected";db.commit()
    db.add(LedgerEntry(order_id=o["id"],kind="sale",amount=120.25,reference="sale:"+o["id"]));db.commit()
    staff=make_client("super_admin");url="/api/admin/orders/"+o["id"]+"/refunds"
    assert staff.post(url,json={"amount":181,"reason":"Offline refund reason"}).status_code==400
    r=staff.post(url,json={"amount":180.25,"reason":"Offline refund reason"});assert r.status_code==201,r.text
    base="/api/admin/refunds/"+str(r.json()["id"])+"/record"
    p={"provider_reference":"offline-refund-reference","confirmed_amount":180.25,"operator_confirmed":False}
    assert staff.post(base,json=p).status_code==400
    p["operator_confirmed"]=True
    assert staff.post(base,json=p).status_code==200 and staff.post(base,json=p).status_code==200
    db.expire_all();assert db.get(Order,o["id"]).payment_status=="refunded"
    assert db.scalar(select(func.count()).select_from(LedgerEntry).where(LedgerEntry.kind=="refund"))==1
    assert db.scalar(select(LedgerEntry.amount).where(LedgerEntry.kind=="refund_sale"))==Decimal("120.25")

@pytest.mark.parametrize("first_cost,expected_total,complete",[("10.01",Decimal("50.05"),True),("0.00",Decimal("40.04"),False)])
def test_allocated_batch_cost_is_exact_and_unknown_units_block_profit(client,product,customer,make_client,db,first_cost,expected_total,complete):
    from app.models.entities import OrderItem
    staff=make_client("super_admin");product.stock=0 if complete else 1;db.commit()
    supplier=staff.post("/api/admin/suppliers",json={"name":"Offline batch supplier","contact":"Fixture contact"}).json()["id"]
    for index,cost,quantity in [(1,first_cost,1),(2,"20.02",2)]:
        if index==1 and not complete:continue
        body={"supplier_id":supplier,"reference":"offline-cost-purchase-"+str(index),"items":[{"product_id":product.id,"quantity":quantity,"unit_cost":cost,"batch_code":"COST-"+str(index),"expires_at":(utcnow()+timedelta(days=index*20)).isoformat()}]}
        created=staff.post("/api/admin/purchases",json=body);assert created.status_code==201,created.text
        received=staff.post("/api/admin/purchases/"+str(created.json()["id"])+"/receive",json={"inspected":True});assert received.status_code==200,received.text
    if not complete:db.refresh(product);product.acquisition_cost=0;db.commit()
    order=place(client,product,customer,qty=3);ident=order["id"];db.expire_all()
    item=db.scalar(select(OrderItem).where(OrderItem.order_id==ident))
    assert item.cost_total==expected_total and item.cost_complete==complete
    assert item.cost_total!=item.cost*item.quantity
    base="/api/admin/orders/"+ident
    for status in ["confirmed","processing","packed"]:
        assert staff.patch(base+"/status",json={"status":status}).status_code==200
    assert staff.post(base+"/shipment",json={"provider":"manual","tracking_number":"OFFLINE-COST-SHIPMENT","shipping_cost":40}).status_code==200
    for status in ["shipped","delivered"]:
        result=staff.patch(base+"/status",json={"status":status});assert result.status_code==200,result.text
    assert db.scalar(select(LedgerEntry.amount).where(LedgerEntry.order_id==ident,LedgerEntry.kind=="cost"))==expected_total
    report=staff.get("/api/admin/reports").json()
    if complete:assert report["gross_profit"]==310.70 and report["missing_cost_records"]==0
    else:assert report["gross_profit"] is None and report["net_profit"] is None and report["missing_cost_records"]==1
    returned=staff.patch(base+"/status",json={"status":"returned","reason":"Inspected offline return","restock":True});assert returned.status_code==200,returned.text
    assert db.scalar(select(LedgerEntry.amount).where(LedgerEntry.order_id==ident,LedgerEntry.kind=="cost_return"))==expected_total

def test_partial_refunds_reconcile_every_paisa_without_exceeding_revenue(client,product,customer,make_client,db):
    order=place(client,product,customer);o=db.get(Order,order["id"]);o.payment_status="cod_collected"
    db.add(LedgerEntry(order_id=o.id,kind="sale",amount=o.subtotal-o.discount,reference="sale:"+o.id));db.commit()
    staff=make_client("super_admin")
    for index,amount in enumerate([Decimal("0.01"),Decimal("0.01"),o.total-Decimal("0.02")]):
        result=staff.post("/api/admin/orders/"+o.id+"/refunds",json={"amount":str(amount),"reason":"Rounding reconciliation fixture"})
        assert result.status_code==201,result.text
        ident=result.json()["id"]
        recorded=staff.post("/api/admin/refunds/"+str(ident)+"/record",json={"provider_reference":"offline-partial-"+str(index),"confirmed_amount":str(amount),"operator_confirmed":True})
        assert recorded.status_code==200,recorded.text
        allocations=db.scalar(select(func.sum(LedgerEntry.amount)).where(LedgerEntry.reference.in_(["refund_"+kind+":"+str(ident) for kind in ["sale","shipping","tax"]])))
        assert allocations==amount
    db.expire_all()
    assert db.get(Order,o.id).payment_status=="refunded"
    for kind,expected in [("sale",o.subtotal-o.discount),("shipping",o.delivery),("tax",o.tax)]:
        assert db.scalar(select(func.sum(LedgerEntry.amount)).where(LedgerEntry.order_id==o.id,LedgerEntry.kind=="refund_"+kind))==expected

def test_standalone_catalog_has_only_hash_authorized_inline_script(client):
    import re,base64,hashlib
    response=client.get("/ordinary-catalog")
    assert response.status_code==200
    script=re.findall(r"<script>(.*?)</script>",response.text,flags=re.S)
    assert len(script)==1
    digest=base64.b64encode(hashlib.sha256(script[0].encode()).digest()).decode()
    assert "'sha256-"+digest+"'" in response.headers["content-security-policy"]
    assert "offline-fixture-key" not in response.text and "X-API-Key" not in response.text
def test_purchase_receive_batch_expiry_and_restock(make_client,product,customer,db):
    client=make_client("super_admin");product.stock=0;db.commit()
    s=client.post("/api/admin/suppliers",json={"name":"Offline Supplier","contact":"Private fixture notes"});assert s.status_code==201
    p=client.post("/api/admin/purchases",json={"supplier_id":s.json()["id"],"reference":"offline-purchase-reference","items":[{"product_id":product.id,"quantity":3,"unit_cost":55,"batch_code":"OFFLINE-BATCH","expires_at":(utcnow()+timedelta(days=30)).isoformat()}]});assert p.status_code==201,p.text
    url="/api/admin/purchases/"+str(p.json()["id"])+"/receive"
    assert client.post(url,json={"inspected":False}).status_code==400
    assert client.post(url,json={"inspected":True}).status_code==200 and client.post(url,json={"inspected":True}).status_code==200
    db.expire_all();assert db.get(Product,product.id).stock==3
    o=place(client,product,customer,qty=2);db.expire_all()
    batch=db.scalar(select(Batch));assert batch.remaining==1
    assert db.scalar(select(func.count()).select_from(StockAllocation))==1
    assert client.patch("/api/admin/orders/"+o["id"]+"/status",json={"status":"cancelled","reason":"Offline batch cancellation"}).status_code==200
    db.expire_all();assert db.get(Batch,batch.id).remaining==3
    db.get(Batch,batch.id).expires_at=utcnow()-timedelta(days=1);db.commit()
    assert client.get("/api/products").json()[0]["stock"]==0
    assert client.post("/api/checkout/quote",json={"items":[{"product_id":product.id,"qty":1}]}).status_code==409
def test_variant_order_deducts_variant_stock_only(make_client,product,customer,db):
    variant=Variant(product_id=product.id,sku="OFFLINE-VAR",label="60 ml",price=210.50,stock=2);db.add(variant);db.commit()
    client=make_client();o=place(client,product,customer,variant_id=variant.id)
    db.expire_all();assert db.get(Variant,variant.id).stock==1 and db.get(Product,product.id).stock==5 and o["subtotal"]==210.50
def test_contact_consent_upload_and_csv_safety(client,make_client,product,db):
    body={"name":"Offline Contact","email":"fixture@example.com","message":"Offline support question","consent":False}
    assert client.post("/api/contact",json=body).status_code==400
    body["consent"]=True;assert client.post("/api/contact",json=body).status_code==201
    staff=make_client("super_admin")
    assert staff.post("/api/admin/media",files={"file":("bad.svg",b"<svg/>","image/svg+xml")}).status_code==415
    product.name="=IMPORTXML";db.commit()
    export=staff.get("/api/admin/exports/products");assert export.status_code==200 and "'=IMPORTXML" in export.text
def test_notification_consent_owner_and_worker_skip(make_client,product,customer,db,monkeypatch):
    client=make_client();o=place(client,product,customer)
    assert len(client.get("/api/notifications").json())==1
    body={"token":"offline-notification-fixture-token","consent":False,"marketing":False}
    assert client.post("/api/push/subscriptions",json=body).status_code==400
    body["consent"]=True;assert client.post("/api/push/subscriptions",json=body).status_code==200
    other=make_client(uid="another-device-owner")
    assert other.post("/api/push/subscriptions",json=body).status_code==409
    from app.worker import run_once
    monkeypatch.setattr(FB,"mirror_notifications",lambda *args:None)
    assert run_once()==1
    db.expire_all();assert db.scalar(select(Outbox.status))=="skipped"
def test_production_configuration_fails_closed():
    with pytest.raises(ValueError):Settings(app_env="production")
def test_recapcha_server_checks_hostname(monkeypatch):
    monkeypatch.setattr(S,"recaptcha_enabled",True);monkeypatch.setattr(S,"recaptcha_secret","offline-captcha-secret")
    monkeypatch.setattr(httpx,"post",lambda *args,**kwargs:SimpleNamespace(json=lambda:{"success":True,"hostname":"wrong.example.com"}))
    with pytest.raises(HTTPException) as e:FB.verify_recaptcha("offline-captcha", "127.0.0.1","checkout")
    assert e.value.status_code==403
def test_seo_does_not_publish_drafts_and_links_correct_route(client,product,db):
    page=client.get("/p/offline-product");assert page.status_code==200 and "/#/p/" in page.text and '"priceCurrency": "BDT"' in page.text
    product.content_verified=False;db.commit()
    assert client.get("/p/offline-product").status_code==404 and "offline-product" not in client.get("/sitemap.xml").text

def test_firebase_admin_verifier_is_called_with_revocation_and_project_checks(monkeypatch):
    from conftest import REAL_VERIFY_TOKEN
    from firebase_admin import auth
    calls=[]
    monkeypatch.setattr(FB,"admin_app",lambda:"offline-admin-app")
    def decode(token,app,check_revoked):
        calls.append((token,app,check_revoked))
        return {"uid":"offline-uid","aud":S.firebase_project_id,"iss":"https://securetoken.google.com/"+S.firebase_project_id}
    monkeypatch.setattr(auth,"verify_id_token",decode)
    assert REAL_VERIFY_TOKEN("offline-token")["uid"]=="offline-uid"
    assert calls==[("offline-token","offline-admin-app",True)]
    monkeypatch.setattr(auth,"verify_id_token",lambda *a,**k:{"uid":"uid","aud":"wrong-project","iss":"https://securetoken.google.com/"+S.firebase_project_id})
    with pytest.raises(HTTPException) as e:REAL_VERIFY_TOKEN("offline-token")
    assert e.value.status_code==401
def test_logout_clears_even_revoked_user_session(make_client,db):
    client=make_client();user=db.scalar(select(User));user.is_active=False;db.commit()
    response=client.post("/api/auth/logout",json={})
    assert response.status_code==200 and not client.cookies.get("gn_session")
def test_account_deletion_anonymizes_profile_and_keeps_order_record(make_client,product,customer,db,monkeypatch):
    client=make_client();o=place(client,product,customer);uid=db.scalar(select(User)).firebase_uid;calls=[]
    monkeypatch.setattr(FB,"delete_identity",lambda value:calls.append(value))
    assert client.delete("/api/account").status_code==200
    db.expire_all();user=db.scalar(select(User))
    assert calls==[uid] and not user.is_active and user.profile_blob is None and user.firebase_uid is None
    assert db.get(Order,o["id"]) is not None

def test_malformed_payment_payload_is_rejected(client):
    assert client.post("/api/payments/ipn",json={"status":["VALID"],"verify_key":{},"verify_sign":{}}).status_code==400
