"""Existing FastAPI host, with transactional services and explicit feature routers."""
import asyncio,base64,hashlib,re,json
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse,Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from .core.config import get_settings
from .core.http import SecurityMiddleware
from .core.auth import _attempts,issue_session
from .db import Base,engine,SessionLocal
from .models import entities
from .services.seed import seed
from .realtime import broker
from .seo import router as seo_router
S=get_settings();ROOT=Path(__file__).resolve().parents[2];FRONTEND=ROOT/"frontend"
@asynccontextmanager
async def lifespan(app):
    broker.bind(asyncio.get_running_loop())
    if S.auto_create_schema and S.app_env!="production":Base.metadata.create_all(engine)
    else:
        from alembic.config import Config
        from alembic.script import ScriptDirectory
        from alembic.migration import MigrationContext
        with engine.connect() as connection:current=MigrationContext.configure(connection).get_current_revision()
        expected=ScriptDirectory.from_config(Config(str(ROOT/"backend"/"alembic.ini"))).get_current_head()
        if current!=expected:raise RuntimeError("Apply database migrations first: alembic upgrade head")
    with SessionLocal() as db:seed(db)
    yield
app=FastAPI(title=S.app_name,version="3.0.0",lifespan=lifespan)
app.add_middleware(CORSMiddleware,allow_origins=[S.allowed_origin],allow_credentials=True,allow_methods=["GET","POST","PUT","PATCH","DELETE","OPTIONS"],allow_headers=["Content-Type","X-CSRF-Token","Idempotency-Key","X-Firebase-AppCheck"])
app.add_middleware(SecurityMiddleware)
app.mount("/assets",StaticFiles(directory=str(FRONTEND/"assets")),name="assets")
app.include_router(seo_router)
from .api.platform import router as platform_router
from .api.business import router as business_router
app.include_router(platform_router);app.include_router(business_router)
from .api.catalog_admin import router as catalog_admin_router
app.include_router(catalog_admin_router)
from .api.catalog_sources import router as catalog_sources_router
app.include_router(catalog_sources_router)
from .api.catalog_bundles import router as catalog_bundles_router
app.include_router(catalog_bundles_router)
@app.exception_handler(RequestValidationError)
async def validation_error(request,error):
    return JSONResponse({"detail":[{"loc":item["loc"],"msg":item["msg"],"type":item["type"]} for item in error.errors()]},status_code=422)
@app.get("/",include_in_schema=False)
def storefront():return FileResponse(FRONTEND/"index.html",headers={"Cache-Control":"no-cache"})
@app.get("/firebase-messaging-sw.js",include_in_schema=False)
def messaging_worker():
    config={"apiKey":S.firebase_api_key,"authDomain":S.firebase_auth_domain,"projectId":S.firebase_project_id,"storageBucket":S.firebase_storage_bucket,"messagingSenderId":S.firebase_messaging_sender_id,"appId":S.firebase_app_id}
    code="self.GN_FIREBASE_CONFIG="+json.dumps(config,ensure_ascii=True)+";\n"+(FRONTEND/"firebase-messaging-sw.js").read_text(encoding="utf8")
    return Response(code,media_type="application/javascript",headers={"Cache-Control":"no-cache","Service-Worker-Allowed":"/"})
@app.get("/manifest.webmanifest",include_in_schema=False)
def manifest():return FileResponse(FRONTEND/"manifest.webmanifest",media_type="application/manifest+json")
@app.get("/ordinary-catalog",include_in_schema=False)
def standalone_catalog():
    path=FRONTEND/"catalog"/"index.html"
    scripts=re.findall(r"<script>(.*?)</script>",path.read_text(encoding="utf8"),flags=re.S)
    hashes=" ".join("'sha256-"+base64.b64encode(hashlib.sha256(script.encode()).digest()).decode()+"'" for script in scripts)
    policy="default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; script-src 'self' "+hashes+"; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'"
    return FileResponse(path,headers={"Cache-Control":"no-cache","Content-Security-Policy":policy})
