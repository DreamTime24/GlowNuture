"""Backend identity verification via Admin SDK/ADC; never accept client-supplied roles."""
from functools import lru_cache
import hashlib,hmac
from urllib.parse import urlsplit
import httpx
from fastapi import HTTPException
from ..core.config import get_settings
@lru_cache
def admin_app():
    import firebase_admin
    from firebase_admin import credentials
    S=get_settings()
    try:return firebase_admin.get_app("glownuture")
    except ValueError:
        try:
            cred=credentials.ApplicationDefault();cred.get_credential()
            return firebase_admin.initialize_app(cred,{"projectId":S.firebase_project_id,"databaseURL":S.firebase_database_url},name="glownuture")
        except Exception:raise HTTPException(503,"Sign-in is temporarily unavailable. Contact the store.") from None
def verify_token(token):
    from firebase_admin import auth
    S=get_settings()
    if not S.firebase_enabled:raise HTTPException(503,"Firebase sign-in is unavailable")
    app=admin_app()
    try:
        claims=auth.verify_id_token(token,app=app,check_revoked=True)
        if claims.get("aud")!=S.firebase_project_id or claims.get("iss")!="https://securetoken.google.com/"+S.firebase_project_id or not claims.get("uid"):raise ValueError()
        return claims
    except Exception:raise HTTPException(401,"Your sign-in expired. Please sign in again.") from None
def verify_live_session(uid,auth_time):
    from firebase_admin import auth
    app=admin_app()
    try:
        user=auth.get_user(uid,app=app)
        if user.disabled or not auth_time or auth_time*1000<user.tokens_valid_after_timestamp:raise ValueError()
    except Exception:raise HTTPException(401,"Sign in again to continue") from None
def identity_hash(value):return hmac.new(get_settings().pii_hmac_key.encode(),value.encode(),hashlib.sha256).hexdigest()
def verify_app_check(request):
    if not get_settings().app_check_enforce:return
    from firebase_admin import app_check
    token=request.headers.get("X-Firebase-AppCheck")
    if not token:raise HTTPException(403,"Application verification required")
    try:app_check.verify_token(token,app=admin_app())
    except Exception:raise HTTPException(403,"Application verification failed") from None
def verify_recaptcha(token,ip,action):
    S=get_settings()
    if not S.recaptcha_enabled:return
    if not S.recaptcha_secret:raise HTTPException(503,"Verification is temporarily unavailable")
    if not token:raise HTTPException(400,"Complete the verification challenge")
    try:r=httpx.post("https://www.google.com/recaptcha/api/siteverify",data={"secret":S.recaptcha_secret,"response":token,"remoteip":ip},timeout=10).json()
    except Exception:raise HTTPException(503,"Verification is temporarily unavailable") from None
    if not r.get("success") or r.get("hostname")!=urlsplit(S.allowed_origin).hostname:raise HTTPException(403,"Verification challenge failed")
    if S.recaptcha_mode=="v3" and (r.get("action")!=action or float(r.get("score",0))<.5):raise HTTPException(403,"Verification challenge failed")
def delete_identity(uid):
    from firebase_admin import auth
    try:auth.delete_user(uid,app=admin_app())
    except HTTPException:raise
    except Exception:raise HTTPException(503,"Account deletion could not be completed; retry later") from None
def send_push(tokens,title,body,key):
    from firebase_admin import messaging
    message=messaging.MulticastMessage(tokens=tokens[:500],data={"title":title,"body":body,"event_key":key,"url":"/#/account/notifications"},webpush=messaging.WebpushConfig(headers={"TTL":"86400"}))
    return messaging.send_each_for_multicast(message,app=admin_app())
def mirror_notifications(uid,ident,payload):
    from firebase_admin import db
    db.reference(f"notifications/{uid}/{ident}",app=admin_app()).set(payload)
