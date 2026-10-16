"""Catalog worker: one bounded page per tick; SQL progress survives restarts."""
import argparse
import time
from sqlalchemy import select
from .db import SessionLocal
from .models.entities import MediaAsset
from .services.catalog_jobs import process_one,heartbeat
from .services.media import inspect_asset
from .core.security import utcnow
from datetime import timedelta

def run_once():
    with SessionLocal() as db:
        processed=process_one(db)
        assets=db.scalars(select(MediaAsset).where(MediaAsset.approved_by.is_not(None),MediaAsset.checked_at<utcnow()-timedelta(hours=1)).order_by(MediaAsset.checked_at).limit(3)).all()
        for asset in assets:inspect_asset(asset)
        db.commit()
    heartbeat("catalog-worker",{"pages_processed":processed,"media_checked":len(assets)})
    return processed

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--once",action="store_true")
    args=parser.parse_args()
    while True:
        print("Catalog pages processed:",run_once(),flush=True)
        if args.once:break
        time.sleep(30)
