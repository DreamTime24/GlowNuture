"""Additional acceptance checks: leases, rights, expiry, attribution and safe output."""
import io,json,os,sqlite3,secrets,tarfile
from datetime import timedelta
from sqlalchemy import select,update
from app.models.entities import Product,CatalogImportJob,MediaAsset
from app.services import catalog_jobs,catalog_providers,media,safe_network
from app.core.security import utcnow
from catalog_helpers import draft,attach,verify
from test_catalog_imports import source,fixture_row
from test_operations import run

def test_invalid_bracket_url_is_a_safe_validation_error(make_client):
    owner=make_client("super_admin")
    response=owner.post("/api/admin/catalog/sources",json={"key":"bad-url","name":"Invalid URL source","kind":"supplier_api","endpoint":"https://[invalid","owner_authorized":True})
    assert response.status_code==422

def test_public_media_credit_excludes_private_permission_evidence(client,make_client):
    owner=make_client("super_admin")
    product,asset=attach(owner,draft(owner))
    verify(owner,product)
    row=client.get("/api/products").json()[0]
    credit=row["image_assets"][0]["credit"]
    assert credit["holder"] and credit["license"] and credit["modified"] is True
    assert "evidence" not in credit
    assert client.get("/api/ready").json()["ready"] is True

def test_revoked_supplier_authorization_fails_the_persistent_job(make_client,db):
    owner=make_client("super_admin")
    src=source(owner,kind="supplier_api",endpoint="https://example.com/catalog")
    response=owner.post("/api/admin/catalog/jobs",json={"source_id":src["id"],"request_id":secrets.token_hex(16)})
    assert response.status_code==202
    from app.models.entities import User
    actor=db.get(User,owner.get("/api/auth/me").json()["id"])
    actor.is_active=False;db.commit()
    catalog_jobs.process_one(db)
    job=db.get(CatalogImportJob,response.json()["id"])
    assert job.status=="failed" and job.error=="SOURCE_AUTHORIZATION_REVOKED"
    assert db.scalar(select(Product)) is None

def test_old_lease_cannot_commit_after_reclaim(make_client,db,monkeypatch):
    owner=make_client("super_admin")
    src=source(owner,kind="supplier_api",endpoint="https://example.com/catalog")
    response=owner.post("/api/admin/catalog/jobs",json={"source_id":src["id"],"request_id":secrets.token_hex(16)})
    ident=response.json()["id"]
    def stolen(*args):
        db.execute(update(CatalogImportJob).where(CatalogImportJob.id==ident).values(locked_at=utcnow()+timedelta(seconds=1)))
        db.commit()
        return [fixture_row()]
    monkeypatch.setattr(catalog_providers,"fetch_page",stolen)
    catalog_jobs.process_one(db)
    assert db.scalar(select(Product)) is None
    assert db.get(CatalogImportJob,ident).status=="running"

def test_open_beauty_facts_needs_no_private_key_and_never_auto_copies_photos(make_client,db,monkeypatch):
    owner=make_client("super_admin")
    src=source(owner,kind="openbeautyfacts",license="ODbL / DbCL reference decision",attribution="Open Beauty Facts contributors · offline QA fixture")
    captured={}
    def fixture_fetch(url,**kwargs):
        captured.update({"url":url,**kwargs})
        return safe_network.Fetched(json.dumps({"products":[{"code":"4006381333931","product_name":"QA reference","brands":"QA","quantity":"30 ml","image_front_url":"https://images.openbeautyfacts.org/qa.jpg"}]}).encode(),"application/json",200)
    monkeypatch.setattr(safe_network,"fetch",fixture_fetch)
    response=owner.post("/api/admin/catalog/jobs",json={"source_id":src["id"],"request_id":secrets.token_hex(16)})
    assert response.status_code==202
    catalog_jobs.process_one(db)
    p=db.scalar(select(Product))
    assert p and p.price==0 and p.stock==0 and not p.active and p.image_url is None
    assert db.scalar(select(MediaAsset)) is None
    assert "X-API-Key" not in captured["headers"]
    assert captured["params"]["page_size"]==12

def test_import_payloads_and_credentials_never_return_in_job_responses(make_client):
    from test_catalog_imports import upload
    owner=make_client("super_admin")
    src=source(owner)
    queued=upload(owner,src,[fixture_row()])
    for response in [queued,owner.get("/api/admin/catalog/jobs"),owner.get("/api/admin/catalog/jobs/"+queued.json()["id"])]:
        assert "input_rows_json" not in response.text
        assert "request_hash" not in response.text

def test_expired_unbatched_stock_cannot_enter_checkout(client,make_client,db):
    owner=make_client("super_admin")
    product,asset=attach(owner,draft(owner))
    response=owner.patch("/api/admin/products/"+str(product["id"]),json={"expiry_required":True,"unbatched_expires_at":(utcnow()+timedelta(days=30)).isoformat(),"revision":product["revision"]})
    assert response.status_code==200,response.text
    p=verify(owner,response.json())
    row=db.get(Product,p["id"]);row.unbatched_expires_at=utcnow()-timedelta(days=1);db.commit()
    assert client.get("/api/products").json()[0]["stock"]==0
    assert client.post("/api/checkout/quote",json={"items":[{"product_id":p["id"],"qty":1}]}).status_code==409

def test_media_backup_restores_checksums_without_touching_existing_targets(tmp_path):
    root=tmp_path/"media";root.mkdir()
    (root/"qa.webp").write_bytes(b"ISOLATED QA BACKUP FIXTURE")
    target=tmp_path/"backup.tar.gz";restored=tmp_path/"restored"
    env={**os.environ,"MEDIA_ROOT":str(root)}
    result=run("../scripts/backup_media.py",str(target),env=env)
    assert result.returncode==0,result.stderr
    result=run("../scripts/restore_media.py",str(target),str(restored),env=env)
    assert result.returncode==0,result.stderr
    assert (restored/"qa.webp").read_bytes()==(root/"qa.webp").read_bytes()
    assert run("../scripts/restore_media.py",str(target),str(root),env=env).returncode!=0
    assert (root/"qa.webp").read_bytes()==b"ISOLATED QA BACKUP FIXTURE"

def test_media_restore_rejects_untrusted_paths_without_touching_parent(tmp_path):
    target=tmp_path/"new";archive=tmp_path/"bad.tar.gz"
    with tarfile.open(archive,"w:gz") as tar:
        for name,data in [("manifest.json",json.dumps({"version":1,"files":[{"path":"../escape","size":1,"sha256":"x"}]}).encode()),("media/../escape",b"x")]:
            info=tarfile.TarInfo(name);info.size=len(data);tar.addfile(info,io.BytesIO(data))
    result=run("../scripts/restore_media.py",str(archive),str(target))
    assert result.returncode!=0 and not (tmp_path/"escape").exists() and not target.exists()

def test_decorative_brand_assets_remain_available_with_external_media_root(client):
    response=client.get("/media/products/hero-serum.svg")
    assert response.status_code==200
    assert response.headers["content-type"].startswith("image/svg+xml")

def test_legacy_public_source_credit_never_exposes_unsafe_urls(client,product,db):
    product.source_json={"provider":"QA legacy","attribution":"QA source","url":"javascript:alert(1)","private_payload":"never public"}
    db.commit()
    source=client.get("/api/products").json()[0]["source"]
    assert source=={"provider":"QA legacy","attribution":"QA source"}

def test_push_worker_uses_runtime_public_config_and_contains_no_server_secrets(client):
    from app.core.config import get_settings
    response=client.get("/firebase-messaging-sw.js")
    assert response.status_code==200
    assert "self.GN_FIREBASE_CONFIG=" in response.text
    assert "firebase.initializeApp(self.GN_FIREBASE_CONFIG)" in response.text
    assert get_settings().parse_api_key not in response.text
    assert response.headers["cache-control"]=="no-cache"
