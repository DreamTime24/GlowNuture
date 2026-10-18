"""Owner-authorized, repeatable import of the three supplied catalog files."""
import hashlib
import math
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..core.auth import rate_limit, require_admin, require_user
from ..db import get_db
from ..models.entities import AuditLog, CatalogImportJob, CatalogSource
from ..schemas.platform import Strict
from ..services import catalog_jobs
from ..services.catalog_normalize import InvalidCatalog, normalize, parse_upload
from .catalog_sources import job_out


router = APIRouter()
CATALOG_ROOT = Path(__file__).resolve().parents[2] / "data" / "catalog_sources"
BUNDLES = (
    (
        "glownuture-website-500",
        "GlowNuture 500 product references",
        "GlowNuture_500_Products_Website.csv",
        500,
        "Open Beauty Facts ODbL/DbCL metadata; image reuse reviewed separately",
        "Open Beauty Facts contributors; owner-supplied GlowNuture reference catalog",
    ),
    (
        "ordinary-bd-reference",
        "The Ordinary BD retailer references",
        "The_Ordinary_GlowNuture_BD_Catalog.xlsx",
        12,
        "Owner-authorized reference data; retailer and image rights reviewed separately",
        "Owner-supplied The Ordinary BD spreadsheet and its retailer source links",
    ),
    (
        "shajgoj-price-reference",
        "Shajgoj BDT price references",
        "Shajgoj_BDT_Product_Price_Catalog.csv",
        227,
        "Owner-authorized reference data; retailer and image rights reviewed separately",
        "Owner-supplied Shajgoj price catalog and its retailer source links",
    ),
)


class BundledImportIn(Strict):
    owner_authorized: bool
    request_id: str = Field(pattern=r"^[a-f0-9]{32}$")


@router.post("/api/admin/catalog/bundled-imports", status_code=202)
def import_bundled_catalogs(
    payload: BundledImportIn,
    request: Request,
    db=Depends(get_db),
    principal=Depends(require_user),
):
    actor = require_admin(request, db, principal, "inventory")
    if actor.role != "super_admin":
        raise HTTPException(403, "Only the business owner can authorize bundled catalog imports")
    if not payload.owner_authorized:
        raise HTTPException(422, "Review and authorize the three metadata sources and their reuse terms")
    rate_limit("catalog-bundle:" + str(actor.id), 8, 60)

    prepared = []
    for key, name, filename, expected, license_name, attribution in BUNDLES:
        try:
            raw = (CATALOG_ROOT / filename).read_bytes()
            input_rows = parse_upload(raw, filename)
            provisional = CatalogSource(key=key, kind="file", license=license_name, attribution=attribution)
            snapshots = [normalize(row, provisional) for row in input_rows]
        except (OSError, InvalidCatalog):
            raise HTTPException(503, "A bundled catalog is unavailable or invalid") from None
        if len(snapshots) != expected or any(not row["reference_only"] for row in snapshots):
            raise HTTPException(503, "A bundled catalog has unexpected contents")
        job_id = hashlib.sha256((payload.request_id + ":" + key).encode()).hexdigest()[:32]
        prepared.append((key, name, license_name, attribution, snapshots, job_id))

    # Check every source before registering or queuing one. A replay with the same
    # request ID is allowed, including recovery after a partially completed call.
    for key, _, _, _, _, job_id in prepared:
        source = db.scalar(select(CatalogSource).where(CatalogSource.key == key))
        if source and (source.kind != "file" or not source.enabled):
            raise HTTPException(409, "A bundled catalog source key is in use or disabled")
        if source:
            active = db.scalar(select(CatalogImportJob).where(
                CatalogImportJob.source_id == source.id,
                CatalogImportJob.status.in_(["queued", "running"]),
            ))
            if active and active.id != job_id:
                raise HTTPException(409, "Wait for the current catalog import to finish")

    jobs = []
    try:
        for key, name, license_name, attribution, snapshots, job_id in prepared:
            source = db.scalar(select(CatalogSource).where(CatalogSource.key == key))
            if source is None:
                source = CatalogSource(
                    key=key,
                    name=name,
                    kind="file",
                    license=license_name,
                    attribution=attribution,
                    enabled=True,
                    authorized_by=actor.id,
                )
                db.add(source)
                db.flush()
                db.add(AuditLog(
                    actor_user_id=actor.id,
                    action="catalog.source_authorized",
                    entity="catalog_source",
                    entity_id=str(source.id),
                    metadata_json={"key":key,"kind":"file","bundled":True},
                ))
            rows = [normalize(row, source) for row in snapshots]
            job = catalog_jobs.enqueue(db, source, actor, job_id, pages=math.ceil(len(rows) / 100), rows=rows)
            jobs.append(job_out(job))
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Catalog sources changed during import; retry with the same request ID") from None
    return {"jobs": jobs}
