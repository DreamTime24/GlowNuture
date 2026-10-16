"""CLI acceptance checks on disposable databases, never owner/live data."""
import os,sqlite3,subprocess,sys
from pathlib import Path

BACKEND=Path(__file__).resolve().parents[1]
def run(*args,env=None):
    return subprocess.run([sys.executable,*args],cwd=BACKEND,env=env,capture_output=True,text=True,timeout=30)

def test_sqlite_backup_roundtrip_is_private_and_never_overwrites(tmp_path):
    source=tmp_path/"source.db";target=tmp_path/"backup.db"
    with sqlite3.connect(source) as db:
        db.execute("CREATE TABLE acceptance (id INTEGER PRIMARY KEY, amount NUMERIC)")
        db.execute("INSERT INTO acceptance VALUES (1, 120.25)")
    env={**os.environ,"DATABASE_URL":"sqlite:///"+str(source)}
    result=run("../scripts/backup_database.py",str(target),env=env)
    assert result.returncode==0,result.stderr
    with sqlite3.connect(target) as db:
        assert db.execute("SELECT amount FROM acceptance WHERE id=1").fetchone()[0]==120.25
        assert db.execute("PRAGMA integrity_check").fetchone()[0]=="ok"
    if os.name!="nt":assert target.stat().st_mode&0o777==0o600
    previous=target.read_bytes()
    assert run("../scripts/backup_database.py",str(target),env=env).returncode!=0
    assert target.read_bytes()==previous

def test_fresh_migrations_rollback_and_real_startup(tmp_path):
    env={**os.environ,"DATABASE_URL":"sqlite:///"+str(tmp_path/"migrated.db"),"AUTO_CREATE_SCHEMA":"false"}
    for command in [("upgrade","head"),("check",),("downgrade","base"),("upgrade","head"),("check",)]:
        result=run("-m","alembic",*command,env=env)
        assert result.returncode==0,result.stderr
    code="""from fastapi.testclient import TestClient
from app.main import app
with TestClient(app) as c:
 page=c.get('/')
 assert page.status_code==200
 scripts=page.headers['content-security-policy'].split('script-src',1)[1].split(';',1)[0]
 assert 'https://apis.google.com' in scripts and 'unsafe-inline' not in scripts
 assert c.get('/manifest.webmanifest').status_code==200
 assert c.get('/firebase-messaging-sw.js').status_code==200
 assert c.get('/api/health').status_code==200
 assert c.get('/backend/.env').status_code==404
 assert c.get('/ordinary-catalog').status_code==200
"""
    result=run("-c",code,env=env)
    assert result.returncode==0,result.stderr


def test_additive_upgrade_preserves_existing_live_draft_archived_and_orders(tmp_path):
    source=tmp_path/"prior-version.db"
    env={**os.environ,"DATABASE_URL":"sqlite:///"+str(source),"AUTO_CREATE_SCHEMA":"false"}
    result=run("-m","alembic","upgrade","7ba1d85a24ef",env=env)
    assert result.returncode==0,result.stderr
    code="""from sqlalchemy import create_engine,MetaData
from app.core.config import get_settings
from datetime import datetime,timezone
engine=create_engine(get_settings().database_url);meta=MetaData();meta.reflect(engine)
stamp=datetime.now(timezone.utc)
with engine.begin() as c:
 for ident,active,verified,archived in [(1,True,True,False),(2,False,False,False),(3,False,True,True)]:
  values=dict(id=ident,slug="prior-"+str(ident),sku="PRIOR-"+str(ident),name="Prior QA product "+str(ident),en="",brand="QA",category="skincare",sub="",short="",description="Existing verified description",price="275.50",compare=0,stock=7,acquisition_cost="120.25",size="30 ml",origin="",image_url="/media/prior-photo.jpg",images_json=[],tags_json=[],ingredients_json=["QA INCI"],skin_json=[],usage="QA label",source_id=None,source_json={},active=active,archived=archived,content_verified=verified,created_at=stamp,updated_at=stamp)
  c.execute(meta.tables["products"].insert().values(**values))
 c.execute(meta.tables["users"].insert().values(id=1,phone_hash="offline-existing-customer",name="QA user",email=None,password_hash="fixture",role="customer",is_active=True,firebase_uid=None,profile_blob=None,email_verified=False,preferences_json={},created_at=stamp,deleted_at=None))
 c.execute(meta.tables["orders"].insert().values(id="GN-QA-EXISTING",user_id=1,phone_hash="offline-existing-customer",customer_blob="QA encrypted record placeholder",items_json=[],subtotal="275.50",discount=0,delivery=60,tax=0,total="335.50",payment="cod",status="delivered",payment_status="cod_due",idempotency_hash="offline-existing-idempotency",request_hash="offline-existing-request",tracking_hash="offline-existing-track",tracking_blob="QA opaque tracking placeholder",stock_released=False,coupon_id=None,expires_at=None,created_at=stamp,updated_at=stamp))
 c.execute(meta.tables["order_items"].insert().values(order_id="GN-QA-EXISTING",product_id=1,variant_id=None,quantity=1,price="275.50",cost="120.25",cost_total="120.25",cost_complete=True))
"""
    result=run("-c",code,env=env);assert result.returncode==0,result.stderr
    result=run("-m","alembic","upgrade","head",env=env);assert result.returncode==0,result.stderr
    with sqlite3.connect(source) as db:
        rows=db.execute("SELECT id,publication_state,legacy_approved,price,stock,image_url FROM products ORDER BY id").fetchall()
        assert rows[0]==(1,"PUBLISHED",1,275.5,7,"/media/prior-photo.jpg")
        assert rows[1][1:3]==("DRAFT",0) and rows[2][1]=="ARCHIVED"
        assert db.execute("SELECT count(*) FROM users").fetchone()[0]==1
        assert db.execute("SELECT total FROM orders WHERE id='GN-QA-EXISTING'").fetchone()[0]==335.5
        assert db.execute("SELECT cost_total FROM order_items").fetchone()[0]==120.25
        assert db.execute("SELECT count(*) FROM product_approval_events").fetchone()[0]==0
    result=run("-m","alembic","check",env=env);assert result.returncode==0,result.stderr

def test_postgresql_migrations_generate_boolean_and_partial_index_sql(tmp_path):
    env={**os.environ,"DATABASE_URL":"postgresql+psycopg://qa:qa@127.0.0.1/glownuture_test","AUTO_CREATE_SCHEMA":"false"}
    result=run("-m","alembic","upgrade","head","--sql",env=env)
    assert result.returncode==0,result.stderr
    assert "BOOLEAN DEFAULT false" in result.stdout
    assert "uq_catalog_one_active_source" in result.stdout
    assert "WHERE status IN ('queued', 'running')" in result.stdout
