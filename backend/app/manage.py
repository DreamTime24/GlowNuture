"""Owner/server CLI; never an HTTP privilege-escalation endpoint."""
import argparse
from sqlalchemy import select,delete
from .db import SessionLocal
from .models.entities import User,Session,AuditLog,Outbox,BusinessRecord
from .core.config import get_settings
from .services.commerce import expire_reservations
parser=argparse.ArgumentParser();commands=parser.add_subparsers(dest="command",required=True)
grant=commands.add_parser("grant-role");grant.add_argument("--firebase-uid",required=True);grant.add_argument("--role",choices=["super_admin","admin","operations_manager","inventory_manager","customer_support","customer"],required=True);grant.add_argument("--confirm",action="store_true")
commands.add_parser("expire-reservations");commands.add_parser("retry-notifications");commands.add_parser("doctor")
args=parser.parse_args()
with SessionLocal() as db:
    if args.command=="grant-role":
        if not args.confirm:raise SystemExit("Exact UID and --confirm are required.")
        user=db.scalar(select(User).where(User.firebase_uid==args.firebase_uid,User.is_active.is_(True)))
        if not user:raise SystemExit("Sign in with that Firebase account first; no identity was guessed.")
        user.role=args.role;db.execute(delete(Session).where(Session.user_id==user.id));db.add(AuditLog(action="owner.cli_role_grant",entity="user",entity_id=str(user.id),metadata_json={"role":args.role}));db.commit()
        print("Role updated; sign in again with staff MFA.")
    elif args.command=="expire-reservations":expire_reservations(db);print("Expired unpaid reservations reconciled.")
    elif args.command=="retry-notifications":
        rows=db.scalars(select(Outbox).where(Outbox.status.in_(["failed","unconfigured"]))).all()
        for row in rows:row.status="pending";row.attempts=0;row.locked_at=None
        db.commit();print("Requeued jobs:",len(rows))
    elif args.command=="doctor":
        S=get_settings()
        checks={"PostgreSQL selected":S.database_url.startswith("postgresql"),"HTTPS / secure cookies":S.allowed_origin.startswith("https://") and S.cookie_secure,"Seller details":all([S.seller_legal_name,S.seller_address,S.support_email,S.support_phone]),"Rotated Parse key configured":bool(S.parse_api_key and S.parse_key_rotation_confirmed),"Merchant credentials":bool(S.sslcommerz_store_id and S.sslcommerz_store_password),"reCAPTCHA server setup":bool(S.recaptcha_enabled and S.recaptcha_secret),"Staff MFA enforced":S.enforce_admin_mfa,"Firebase web configuration":bool(S.firebase_api_key and S.firebase_app_id and S.firebase_auth_domain)}
        for key in ["terms","privacy","return","delivery"]:
            row=db.scalar(select(BusinessRecord).where(BusinessRecord.kind=="policy",BusinessRecord.record_key==key))
            checks["Approved "+key+" policy"]=bool(row and row.data_json.get("active") and row.data_json.get("body"))
        for name,ok in checks.items():print(("OK   " if ok else "TODO ")+name)
        print("Provider credentials, OAuth domains, live payment/courier/FCM tests and existing Cloud SQL status require separate owner verification.")
