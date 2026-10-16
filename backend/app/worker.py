"""SQL notification outbox with leases/retry; no cloud resources are created."""
import argparse,json,smtplib,time
from datetime import timedelta
from email.message import EmailMessage
from sqlalchemy import select,update
from fastapi import HTTPException
from .db import SessionLocal
from .models.entities import Outbox,User,PushSubscription
from .core.config import get_settings
from .core.security import utcnow,decrypt_text
from .services import firebase as FB
from .services.commerce import expire_reservations
S=get_settings()
def email_job(user,payload):
    if not user or not user.email_verified or not (user.preferences_json or {}).get("email"):return "skipped"
    if not S.smtp_host or not S.smtp_from:return "unconfigured"
    profile=json.loads(decrypt_text(user.profile_blob,S.pii_encryption_key)) if user.profile_blob else {}
    if not profile.get("email"):return "skipped"
    message=EmailMessage();message["From"]=S.smtp_from;message["To"]=profile["email"];message["Subject"]="Glow Nuture · "+payload["title"]
    message.set_content(payload["body"]+"\n\n"+S.allowed_origin+"/#/account/orders\nManage email preferences in Account settings.")
    with smtplib.SMTP(S.smtp_host,S.smtp_port,timeout=15) as smtp:
        smtp.starttls()
        if S.smtp_username:smtp.login(S.smtp_username,S.smtp_password)
        smtp.send_message(message)
    return "sent"
def push_job(db,user,job):
    if not user or not user.firebase_uid:return "skipped"
    try:FB.mirror_notifications(user.firebase_uid,job.payload_json.get("notification_id",job.id),job.payload_json)
    except HTTPException as error:
        if error.status_code==503:return "unconfigured"
        raise
    if not (user.preferences_json or {}).get("push"):return "skipped"
    subscriptions=db.scalars(select(PushSubscription).where(PushSubscription.user_id==user.id,PushSubscription.active.is_(True))).all()
    if not subscriptions:return "skipped"
    success=0
    for offset in range(0,len(subscriptions),500):
        group=subscriptions[offset:offset+500];result=FB.send_push([decrypt_text(r.token_blob,S.pii_encryption_key) for r in group],job.payload_json["title"],job.payload_json["body"],job.event_key)
        success+=result.success_count
        for row,response in zip(group,result.responses):
            if not response.success and getattr(response.exception,"code","") in {"messaging/registration-token-not-registered","messaging/invalid-registration-token","UNREGISTERED"}:row.active=False
    return "sent" if success else "failed"
def run_once():
    processed=0
    with SessionLocal() as db:
        expire_reservations(db)
        db.execute(update(Outbox).where(Outbox.status=="processing",Outbox.locked_at<utcnow()-timedelta(minutes=10)).values(status="pending",locked_at=None));db.commit()
        ids=db.scalars(select(Outbox.id).where(Outbox.status=="pending",Outbox.attempts<5,((Outbox.locked_at.is_(None))|(Outbox.locked_at<=utcnow()))).order_by(Outbox.id).limit(30)).all()
        for ident in ids:
            changed=db.execute(update(Outbox).where(Outbox.id==ident,Outbox.status=="pending").values(status="processing",locked_at=utcnow(),attempts=Outbox.attempts+1)).rowcount;db.commit()
            if not changed:continue
            job=db.get(Outbox,ident);db.refresh(job);user=db.get(User,job.user_id)
            try:
                job.status=email_job(user,job.payload_json) if job.channel=="email" else push_job(db,user,job);job.last_error=""
            except Exception as error:job.status="failed";job.last_error=type(error).__name__
            job.locked_at=None
            if job.status=="failed" and job.attempts<5:job.status="pending";job.locked_at=utcnow()+timedelta(seconds=30*2**job.attempts)
            db.commit();processed+=1
    from .services.catalog_jobs import heartbeat
    heartbeat("notification-worker",{"jobs_processed":processed})
    return processed
if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--once",action="store_true");args=parser.parse_args()
    while True:
        print("Processed notification jobs:",run_once(),flush=True)
        if args.once:break
        time.sleep(30)
