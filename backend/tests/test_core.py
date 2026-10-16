import concurrent.futures,json,secrets
from datetime import timedelta
from fastapi.testclient import TestClient
from sqlalchemy import select,func
from app.main import app
from app.models.entities import Product,Order,OrderItem,Coupon,InventoryMovement,Payment,LedgerEntry,User,Address,Session
from app.core.security import decrypt_text,utcnow,token_digest
from app.core.config import get_settings
from app.services.commerce import expire_reservations
from conftest import checkout_payload,place

def test_empty_catalog_not_demo(client):assert client.get("/api/products").json()==[]
def test_draft_is_not_purchasable(client,product,db):
    product.content_verified=False;db.commit()
    assert client.get("/api/products").json()==[]
    assert client.get("/api/products/offline-product").status_code==404
    assert client.post("/api/checkout/quote",json={"items":[{"product_id":product.id,"qty":1}]}).status_code==409
def test_exact_minor_units_and_hidden_cost(client,product):
    quote=client.post("/api/checkout/quote",json={"items":[{"product_id":product.id,"qty":2}]}).json()
    assert quote["subtotal_minor"]==24050 and quote["total_minor"]==30050
    assert "cost_minor" not in quote["items"][0]
    assert "acquisition_cost" not in client.get("/api/products").json()[0]
def test_order_encryption_and_tracking(client,product,customer,db):
    r=place(client,product,customer);db.refresh(product);assert product.stock==4
    o=db.get(Order,r["id"]);assert customer["address"] not in o.customer_blob
    assert json.loads(decrypt_text(o.customer_blob,get_settings().pii_encryption_key))["phone"]==customer["phone"]
    assert r["tracking_token"] not in o.tracking_hash
    track=client.post("/api/orders/track",json={"order_id":o.id,"token":r["tracking_token"]})
    assert track.status_code==200 and "customer" not in track.json() and "tracking_token" not in track.json()
    assert client.post("/api/orders/track",json={"order_id":o.id,"token":"invalid-tracking-fixture-token"}).status_code==404
def test_idempotency_replay(client,product,customer,db):
    p=checkout_payload(client,product,customer);header={"Idempotency-Key":secrets.token_hex(16)}
    a=client.post("/api/orders",json=p,headers=header);p["recaptcha_token"]="fresh-captcha";b=client.post("/api/orders",json=p,headers=header)
    assert a.status_code==201 and b.status_code==200 and a.json()["id"]==b.json()["id"]
    db.refresh(product);assert product.stock==4 and db.scalar(select(func.count()).select_from(Order))==1
def test_idempotency_mismatch(client,product,customer):
    p=checkout_payload(client,product,customer);h={"Idempotency-Key":secrets.token_hex(16)}
    assert client.post("/api/orders",json=p,headers=h).status_code==201
    p["customer"]["name"]="Another customer"
    assert client.post("/api/orders",json=p,headers=h).status_code==409
def test_total_tamper_rolls_back(client,product,customer,db):
    p=checkout_payload(client,product,customer);p["expected_total_minor"]=1
    assert client.post("/api/orders",json=p,headers={"Idempotency-Key":secrets.token_hex(16)}).status_code==409
    db.refresh(product);assert product.stock==5
    assert db.scalar(select(func.count()).select_from(Order))==0
def test_no_fake_coupon(client,product,customer,db):
    p=checkout_payload(client,product,customer);p["coupon"]="FAKE50"
    assert client.post("/api/orders",json=p,headers={"Idempotency-Key":secrets.token_hex(16)}).status_code==400
    db.refresh(product);assert product.stock==5
def test_coupon_limit_and_cancellation(client,product,customer,db,make_client):
    db.add(Coupon(code="FIXTURE10",kind="percent",value=10,usage_limit=1));db.commit()
    r=place(client,product,customer,coupon="fixture10");assert r["discount"]==12.03
    assert client.post("/api/checkout/quote",json={"items":[{"product_id":product.id,"qty":1}],"coupon":"FIXTURE10"}).status_code==400
    staff=make_client("super_admin")
    assert staff.patch("/api/admin/orders/"+r["id"]+"/status",json={"status":"cancelled","reason":"Fixture cancellation"}).status_code==200
    db.refresh(product);assert product.stock==5 and db.scalar(select(Coupon.used))==0
def test_duplicate_lines_and_zero_qty(client,product,customer):
    p=checkout_payload(client,product,customer);p["items"]*=2
    assert client.post("/api/orders",json=p,headers={"Idempotency-Key":secrets.token_hex(16)}).status_code==422
    p["items"]=[{"product_id":product.id,"qty":0}]
    assert client.post("/api/orders",json=p,headers={"Idempotency-Key":secrets.token_hex(16)}).status_code==422
def test_terms_and_key_required(client,product,customer):
    p=checkout_payload(client,product,customer)
    assert client.post("/api/orders",json=p).status_code==400
    p["accept_terms"]=False
    assert client.post("/api/orders",json=p,headers={"Idempotency-Key":secrets.token_hex(16)}).status_code==422
def test_concurrent_buyers_cannot_oversell(client,product,customer,db):
    product.stock=1;db.commit();p=checkout_payload(client,product,customer)
    def buy(_):
        browser=TestClient(app,headers={"Origin":"http://testserver"})
        try:return browser.post("/api/orders",json=p,headers={"Idempotency-Key":secrets.token_hex(16)}).status_code
        finally:browser.close()
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:r=list(pool.map(buy,range(4)))
    assert r.count(201)==1 and r.count(409)==3,r
    db.refresh(product);assert product.stock==0 and db.scalar(select(func.count()).select_from(Order))==1
def test_cancel_once(client,product,customer,db,make_client):
    r=place(client,product,customer,qty=2);staff=make_client("super_admin");url="/api/admin/orders/"+r["id"]+"/status"
    assert staff.patch(url,json={"status":"cancelled","reason":"Fixture cancellation"}).status_code==200
    assert staff.patch(url,json={"status":"cancelled","reason":"Repeated cancellation"}).status_code==409
    db.refresh(product);assert product.stock==5
    assert db.scalar(select(func.count()).select_from(InventoryMovement).where(InventoryMovement.reason=="order.cancelled"))==1
def test_online_expiry_once(client,product,customer,db):
    r=place(client,product,customer,payment="online");o=db.get(Order,r["id"]);o.expires_at=utcnow()-timedelta(minutes=1);db.commit()
    expire_reservations(db);expire_reservations(db);db.refresh(o);db.refresh(product)
    assert product.stock==5 and o.status=="cancelled" and o.stock_released
def test_unpaid_cannot_fulfill(client,product,customer,make_client):
    r=place(client,product,customer,payment="online");staff=make_client("super_admin")
    assert staff.patch("/api/admin/orders/"+r["id"]+"/status",json={"status":"confirmed"}).status_code==409
def test_cod_lifecycle_ledger_and_invoice(client,product,customer,make_client,db):
    r=place(client,product,customer);staff=make_client("super_admin");oid=r["id"];base="/api/admin/orders/"+oid
    for status in ["confirmed","processing","packed"]:assert staff.patch(base+"/status",json={"status":status}).status_code==200
    assert staff.patch(base+"/status",json={"status":"shipped"}).status_code==409
    assert staff.post(base+"/shipment",json={"provider":"manual","tracking_number":"OFFLINE-TRACKING","shipping_cost":40}).status_code==200
    for status in ["shipped","delivered"]:assert staff.patch(base+"/status",json={"status":status}).status_code==200
    payload={"amount":180.25,"reference":"OFFLINE-COD-REF"}
    assert staff.post(base+"/cod",json=payload).status_code==200
    assert staff.post(base+"/cod",json=payload).status_code==200
    assert db.get(Order,oid).payment_status=="cod_collected"
    report=staff.get("/api/admin/reports").json()
    assert report["net_sales"]==120.25 and report["gross_profit"]==60.25 and report["net_profit"]==80.25,report
    invoice=client.post("/api/invoices/guest",json={"order_id":oid,"token":r["tracking_token"]})
    assert invoice.status_code==200 and invoice.content.startswith(b"%PDF") and invoice.headers["cache-control"]=="no-store"
def test_customer_cannot_admin(make_client):
    client=make_client();assert client.get("/api/admin/dashboard").status_code==403
def test_roles_are_server_owned(make_client,db):
    client=make_client();user=db.scalar(select(User));assert user.role=="customer"
    assert client.post("/api/auth/firebase/session",json={"id_token":"offline-fixture-token:uid-new","role":"super_admin"}).status_code==422
def test_role_boundaries(make_client):
    inventory=make_client("inventory_manager")
    assert inventory.get("/api/admin/products").status_code==200
    assert inventory.get("/api/admin/orders").status_code==403
    support=make_client("customer_support")
    assert support.get("/api/admin/support/orders").status_code==200
    assert support.post("/api/admin/products",json={"sku":"UNAUTHORIZED","slug":"unauthorized","name":"Unauthorized","price":10}).status_code==403
def test_staff_get_does_not_require_origin(make_client):
    client=make_client("super_admin");client.headers.pop("Origin")
    assert client.get("/api/admin/products").status_code==200
def test_csrf_and_origin(make_client):
    client=make_client();client.headers.pop("X-CSRF-Token")
    assert client.patch("/api/profile",json={"name":"New name"}).status_code==403
    client.headers["X-CSRF-Token"]=client.cookies.get("gn_csrf");client.headers["Origin"]="https://wrong.example.com"
    assert client.patch("/api/profile",json={"name":"New name"}).status_code==403
def test_owned_order_history_and_idor(make_client,product,customer):
    one=make_client(uid="owner-customer");r=place(one,product,customer)
    other=make_client(uid="different-customer")
    assert len(one.get("/api/orders/me").json())==1 and other.get("/api/orders/me").json()==[]
    assert other.get("/api/orders/"+r["id"]).status_code==404
def test_address_owner_only(make_client,customer):
    one=make_client(uid="first-address-owner");other=make_client(uid="second-address-owner")
    r=one.post("/api/addresses",json=customer);assert r.status_code==201,r.text
    assert other.delete("/api/addresses/"+str(r.json()["id"])).status_code==404
def test_dev_password_auth(client):
    p={"name":"Local fixture","phone":"01711112222","email":"local-fixture@example.com","password":"local-test-fixture-password"}
    assert client.post("/api/auth/register",json=p).status_code==201
    assert client.post("/api/auth/login",json={"phone":p["phone"],"password":"wrong-fixture"}).status_code==401
    assert client.post("/api/auth/login",json={"phone":p["phone"],"password":p["password"]}).status_code==200
def test_validation_and_secret_free_config(client,make_client):
    staff=make_client("super_admin")
    assert staff.post("/api/admin/products",json={"sku":"NEGATIVE","slug":"negative","name":"Bad product","price":100,"stock":-1}).status_code==422
    assert staff.post("/api/admin/products",json={"sku":"UNREVIEWED","slug":"unreviewed","name":"Unreviewed","price":100,"active":True}).status_code==409
    data=json.dumps(client.get("/api/config").json())
    assert "offline-fixture-password" not in data and "offline-fixture-key" not in data
def test_body_limit_and_headers(client):
    assert client.post("/api/contact",content=b"x"*256001).status_code==413
    r=client.get("/api/health");assert r.headers["x-content-type-options"]=="nosniff" and r.headers["cache-control"]=="no-store"
