"""Offline provider fixtures; actual SQL and HTTP handlers are exercised."""
import os,tempfile,time,secrets
from pathlib import Path
import pytest
from cryptography.fernet import Fernet
temp=tempfile.TemporaryDirectory(prefix="glow-tests-")
os.environ["MEDIA_ROOT"]=str(Path(temp.name)/"media")
os.environ.update({"APP_ENV":"test","DATABASE_URL":"sqlite:///"+str(Path(temp.name)/"commerce.db"),"PII_ENCRYPTION_KEY":Fernet.generate_key().decode(),"PII_HMAC_KEY":secrets.token_hex(32),"ALLOWED_ORIGIN":"http://testserver","COOKIE_SECURE":"false","LOCAL_AUTH_ENABLED":"true","AUTO_CREATE_SCHEMA":"true","SEED_DEMO_PRODUCTS":"false","CHECKOUT_ENABLED":"true","SELLER_LEGAL_NAME":"Offline Test Store","SELLER_ADDRESS":"Offline Fixture Address","SUPPORT_EMAIL":"fixture@example.com","SUPPORT_PHONE":"01712345678","PARSE_API_KEY":"offline-fixture-key","SSLCOMMERZ_STORE_ID":"offline-fixture-store","SSLCOMMERZ_STORE_PASSWORD":"offline-fixture-password","SSLCOMMERZ_LIVE":"false","SSLCOMMERZ_LIVE_VERIFIED":"false","RECAPTCHA_ENABLED":"false","APP_CHECK_ENFORCE":"false","ADMIN_BOOTSTRAP_PHONE":"","ADMIN_BOOTSTRAP_PASSWORD":""})
test_url=os.environ.get("TEST_DATABASE_URL")
if test_url:
    from sqlalchemy.engine import make_url
    if not test_url.startswith("postgresql") or make_url(test_url).database!="glownuture_test":raise RuntimeError("Use an isolated PostgreSQL database named glownuture_test")
    os.environ["DATABASE_URL"]=test_url
from fastapi.testclient import TestClient
from sqlalchemy import select
from app.main import app
from app.db import Base,engine,SessionLocal
from app.models.entities import User,Product
from app.core.auth import _attempts
from app.services import firebase as FB
from app.api.platform import _catalog_cache
REAL_VERIFY_TOKEN=FB.verify_token
@pytest.fixture(autouse=True)
def isolated(monkeypatch):
    Base.metadata.drop_all(engine);Base.metadata.create_all(engine);_attempts.clear();_catalog_cache.clear()
    monkeypatch.setattr(FB,"verify_live_session",lambda *args:None)
    monkeypatch.setattr(FB,"verify_token",lambda token:{"uid":token.split(":",1)[-1],"email":"fixture@example.com","email_verified":True,"name":"Offline Customer","auth_time":int(time.time()),"firebase":{"sign_in_second_factor":"totp"},"role":"super_admin"})
    yield
@pytest.fixture
def db():
    with SessionLocal() as db:yield db
@pytest.fixture
def client():
    with TestClient(app,headers={"Origin":"http://testserver"}) as client:yield client
@pytest.fixture
def make_client():
    clients=[]
    def make(role="customer",uid=None):
        client=TestClient(app,headers={"Origin":"http://testserver"});clients.append(client)
        uid=uid or "fixture-"+role
        r=client.post("/api/auth/firebase/session",json={"id_token":"offline-fixture-token:"+uid})
        assert r.status_code==200,r.text
        with SessionLocal() as db:
            user=db.scalar(select(User).where(User.firebase_uid==uid));user.role=role;db.commit()
        client.headers["X-CSRF-Token"]=client.cookies.get("gn_csrf");return client
    yield make
    for client in clients:client.close()
@pytest.fixture
def product(db):
    p=Product(sku="OFFLINE-SKU",slug="offline-product",name="Offline fixture product",en="Offline fixture product",brand="Fixture",price="120.25",stock=5,active=True,content_verified=True,publication_state="PUBLISHED",legacy_approved=True,approved_revision=1,expiry_required=False,acquisition_cost="60.00")
    db.add(p);db.commit();return p
@pytest.fixture
def customer():
    return {"name":"Offline Customer","phone":"01712345678","email":"fixture@example.com","division":"ঢাকা","district":"ঢাকা","upazila":"Fixture area","address":"Offline fixture address"}
def checkout_payload(client,p,customer,qty=1,payment="cod",coupon=None,variant_id=None):
    item={"product_id":p.id,"qty":qty}
    if variant_id:item["variant_id"]=variant_id
    quote=client.post("/api/checkout/quote",json={"items":[item],"coupon":coupon,"division":customer["division"],"district":customer["district"]})
    assert quote.status_code==200,quote.text
    return {"items":[item],"customer":customer,"coupon":coupon,"payment":payment,"expected_total_minor":quote.json()["total_minor"],"accept_terms":True}
def place(client,p,customer,**kwargs):
    payload=checkout_payload(client,p,customer,**kwargs)
    r=client.post("/api/orders",json=payload,headers={"Idempotency-Key":secrets.token_hex(16)})
    assert r.status_code==201,r.text
    return r.json()
