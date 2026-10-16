import io,json,secrets
from datetime import timedelta
from sqlalchemy import select,func
from app.models.entities import Product,CatalogItemSource,CatalogImportJob,CatalogSource
from app.services import catalog_jobs,catalog_providers,safe_network
from app.core.security import utcnow,decrypt_text
from app.core.config import get_settings
from catalog_helpers import attach,verify

def source(owner,kind="file",key="qa-source",**extra):
    response=owner.post("/api/admin/catalog/sources",json={"key":key,"name":"QA authorized source","kind":kind,"owner_authorized":True,**extra})
    assert response.status_code==201,response.text
    return response.json()

def upload(owner,source,rows,request_id=None):
    request_id=request_id or secrets.token_hex(16)
    return owner.post("/api/admin/catalog/uploads",data={"source_id":source["id"],"request_id":request_id},files={"file":("qa.json",json.dumps(rows).encode(),"application/json")})

def fixture_row(**changes):
    return {"external_id":"qa-001","name":"QA catalog item","brand":"QA only","size":"30 ml","category":"skincare","description":"Isolated QA catalog description.","ingredients":["QA fixture"],"usage":"QA label only.","price":"9999.00","stock":999,"active":True,"content_verified":True,**changes}

def test_uploaded_feed_creates_only_unpriced_drafts(client,make_client,db):
    owner=make_client("super_admin")
    src=source(owner)
    queued=upload(owner,src,[fixture_row()])
    assert queued.status_code==202,queued.text
    assert db.scalar(select(func.count()).select_from(Product))==0
    assert catalog_jobs.process_one(db)==1
    product=db.scalar(select(Product))
    assert product.publication_state=="DRAFT" and not product.active and not product.content_verified
    assert product.price==0 and product.stock==0 and product.acquisition_cost==0
    assert product.image_url is None
    assert client.get("/api/products").json()==[]
    job=db.get(CatalogImportJob,queued.json()["id"])
    assert job.status=="completed" and job.counts_json["created"]==1

def test_queue_request_replay_and_one_active_job_per_source(make_client,db):
    owner=make_client("super_admin")
    src=source(owner)
    ident=secrets.token_hex(16)
    first=upload(owner,src,[fixture_row()],ident)
    assert first.status_code==202
    assert upload(owner,src,[fixture_row()],ident).status_code==202
    assert upload(owner,src,[fixture_row(name="Another payload")],ident).status_code==409
    assert upload(owner,src,[fixture_row()]).status_code==409
    assert db.scalar(select(func.count()).select_from(CatalogImportJob))==1

def test_refresh_keeps_verified_local_price_stock_and_content(make_client,db):
    owner=make_client("super_admin")
    src=source(owner)
    assert upload(owner,src,[fixture_row()]).status_code==202
    catalog_jobs.process_one(db)
    product=db.scalar(select(Product))
    edited=owner.patch("/api/admin/products/"+str(product.id),json={"price":"250.25","stock":5,"acquisition_cost":"120.00","condition":"sealed","expiry_required":False}).json()
    edited,asset=attach(owner,edited)
    published=verify(owner,edited)
    again=upload(owner,src,[fixture_row(name="Changed external title",price=1,stock=10000)])
    assert again.status_code==202,again.text
    catalog_jobs.process_one(db)
    assert all(j.status=="completed" for j in db.scalars(select(CatalogImportJob)).all()), [(j.status,j.error,j.counts_json) for j in db.scalars(select(CatalogImportJob)).all()]
    db.expire_all()
    product=db.get(Product,product.id)
    assert product.price==250.25 and product.stock==5 and product.name=="QA catalog item"
    assert product.active and product.publication_state=="PUBLISHED"
    item=db.scalar(select(CatalogItemSource))
    assert item.changes_json["name"]["after"]=="Changed external title"
    assert product.image_url==asset["url"]

def test_identical_reimport_is_idempotent(make_client,db):
    owner=make_client("super_admin")
    src=source(owner)
    for _ in range(2):
        response=upload(owner,src,[fixture_row()])
        assert response.status_code==202,response.text
        catalog_jobs.process_one(db)
    assert db.scalar(select(func.count()).select_from(Product))==1
    assert db.scalar(select(func.count()).select_from(CatalogItemSource))==1
    latest=db.scalars(select(CatalogImportJob).order_by(CatalogImportJob.created_at.desc())).first()
    assert latest.counts_json["unchanged"]==1, [(j.status,j.error,j.counts_json) for j in db.scalars(select(CatalogImportJob)).all()]

def test_csv_utf8_bom_malicious_fields_and_duplicate_headers(make_client,db):
    owner=make_client("super_admin")
    src=source(owner)
    raw='\ufeffexternal_id,name,brand,price,stock,active,content_verified\ncsv-1,"=2+2",QA,10,999,true,true\n'.encode()
    result=owner.post("/api/admin/catalog/uploads",data={"source_id":src["id"],"request_id":secrets.token_hex(16)},files={"file":("qa.csv",raw,"text/csv")})
    assert result.status_code==202,result.text
    catalog_jobs.process_one(db)
    product=db.scalar(select(Product))
    assert product.name=="=2+2" and product.price==0 and product.stock==0 and not product.content_verified
    bad=owner.post("/api/admin/catalog/uploads",data={"source_id":src["id"],"request_id":secrets.token_hex(16)},files={"file":("bad.csv",b"id,name,name\n1,a,b","text/csv")})
    assert bad.status_code==422

def test_source_authorization_permissions_and_encrypted_header_credentials(make_client,db):
    inventory=make_client("inventory_manager")
    assert inventory.post("/api/admin/catalog/sources",json={"key":"forged-source","name":"Forged","kind":"file","owner_authorized":True}).status_code==403
    owner=make_client("super_admin")
    registered=source(owner,kind="supplier_api",endpoint="https://example.com/products",credential="offline-header-fixture")
    assert "offline-header-fixture" not in str(registered)
    stored=db.get(CatalogSource,registered["id"])
    assert "offline-header-fixture" not in stored.credential_blob
    assert decrypt_text(stored.credential_blob,get_settings().pii_encryption_key)=="offline-header-fixture"

def test_provider_failure_retries_and_resumes_without_duplicate_products(make_client,db,monkeypatch):
    owner=make_client("super_admin")
    src=source(owner,kind="supplier_api",endpoint="https://example.com/products")
    request=owner.post("/api/admin/catalog/jobs",json={"source_id":src["id"],"request_id":secrets.token_hex(16),"pages":1})
    assert request.status_code==202,request.text
    def fail(*args):raise safe_network.ExternalFetchError("HTTP_503",True)
    monkeypatch.setattr(catalog_providers,"fetch_page",fail)
    catalog_jobs.process_one(db)
    job=db.get(CatalogImportJob,request.json()["id"])
    assert job.status=="queued" and job.attempts==1 and job.error=="HTTP_503"
    assert catalog_jobs.process_one(db)==0
    job.next_attempt_at=utcnow()-timedelta(seconds=1)
    db.commit()
    monkeypatch.setattr(catalog_providers,"fetch_page",lambda *args:[fixture_row()])
    assert catalog_jobs.process_one(db)==1
    db.refresh(job)
    assert job.status=="completed" and job.counts_json["created"]==1

def test_partial_scan_does_not_mark_unseen_references_removed(make_client,db,monkeypatch):
    owner=make_client("super_admin")
    src=source(owner,kind="supplier_api",endpoint="https://example.com/products")
    full=[fixture_row(external_id="qa-"+str(i)) for i in range(12)]
    monkeypatch.setattr(catalog_providers,"fetch_page",lambda *args:full)
    request=owner.post("/api/admin/catalog/jobs",json={"source_id":src["id"],"request_id":secrets.token_hex(16),"pages":1})
    assert request.status_code==202
    catalog_jobs.process_one(db)
    monkeypatch.setattr(catalog_providers,"fetch_page",lambda *args:[])
    later=owner.post("/api/admin/catalog/jobs",json={"source_id":src["id"],"request_id":secrets.token_hex(16),"pages":1,"start":12})
    assert later.status_code==202
    catalog_jobs.process_one(db)
    assert all(item.available_at_source for item in db.scalars(select(CatalogItemSource)).all())

def test_feed_cannot_copy_price_stock_or_approval_through_apply(make_client,db):
    owner=make_client("super_admin")
    src=source(owner)
    upload(owner,src,[fixture_row()])
    catalog_jobs.process_one(db)
    item=db.scalar(select(CatalogItemSource))
    product=db.get(Product,item.product_id)
    for field in ["price","stock","active","image_url"]:
        response=owner.post("/api/admin/catalog/items/"+str(item.id)+"/apply",json={"fields":[field],"expected_revision":product.revision,"reason":"Explicit isolated QA change review"})
        assert response.status_code==422
