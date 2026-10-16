import json,secrets,time
from collections import defaultdict,deque
from typing import Annotated
from fastapi import Cookie,Depends,HTTPException,Request
from sqlalchemy import select
from ..db import get_db
from ..models.entities import Session,User
from .config import get_settings
from .security import new_opaque_token,token_digest,utcnow,expires_after,decrypt_text
from ..services import firebase as FB
S=get_settings()
SESSION_COOKIE="__Host-gn_session" if S.cookie_secure else "gn_session"
PERMISSIONS={"super_admin":{"dashboard","inventory","orders","support","accounting","marketing","staff"},"admin":{"dashboard","inventory","orders","support","accounting","marketing"},"operations_manager":{"dashboard","orders"},"inventory_manager":{"dashboard","inventory"},"customer_support":{"dashboard","support"},"customer":set()}
_attempts=defaultdict(deque)
def rate_limit(key,limit=8,window_s=60):
    now=time.monotonic()
    if len(_attempts)>10000:
        for k in list(_attempts):
            if not _attempts[k] or _attempts[k][-1]<now-3600:del _attempts[k]
    q=_attempts[key]
    while q and q[0]<=now-window_s:q.popleft()
    if len(q)>=limit:raise HTTPException(429,"Too many attempts. Try again later.")
    q.append(now)
def enforce_origin(request):
    if request.headers.get("origin")!=S.allowed_origin:raise HTTPException(403,"Origin not allowed")
def verify_csrf(request,sess):
    token=request.headers.get("X-CSRF-Token")
    if not token or not secrets.compare_digest(token_digest(token),sess.csrf_hash):raise HTTPException(403,"CSRF validation failed")
def current_session(db,token):
    if not token:return None,None
    sess=db.scalar(select(Session).where(Session.token_hash==token_digest(token),Session.expires_at>utcnow()))
    return (sess,sess.user) if sess else (None,None)
def require_user(db=Depends(get_db),token:Annotated[str|None,Cookie(alias=SESSION_COOKIE)]=None):
    sess,user=current_session(db,token)
    if not sess or not user or not user.is_active or (S.app_env=="production" and not user.firebase_uid):raise HTTPException(401,"Authentication required")
    if user.firebase_uid:FB.verify_live_session(user.firebase_uid,sess.firebase_auth_time)
    return sess,user
def require_admin(request,db,principal,permission="dashboard"):
    sess,user=principal
    if request.method not in {"GET","HEAD"}:enforce_origin(request);verify_csrf(request,sess)
    elif request.headers.get("origin") not in {None,S.allowed_origin}:raise HTTPException(403,"Origin not allowed")
    if permission not in PERMISSIONS.get(user.role,set()):raise HTTPException(403,"Staff permission required")
    if S.enforce_admin_mfa and user.firebase_uid and not sess.mfa_verified:raise HTTPException(403,"Complete multi-factor sign-in before opening the staff dashboard")
    return user
def customer_write(request,principal):enforce_origin(request);verify_csrf(request,principal[0])
def issue_session(db,user,response,claims=None):
    token=new_opaque_token();csrf=new_opaque_token();claims=claims or {}
    db.add(Session(token_hash=token_digest(token),csrf_hash=token_digest(csrf),user_id=user.id,expires_at=expires_after(S.session_ttl_hours),mfa_verified=bool(claims.get("firebase",{}).get("sign_in_second_factor")),firebase_auth_time=claims.get("auth_time")))
    db.commit()
    response.set_cookie(SESSION_COOKIE,token,httponly=True,secure=S.cookie_secure,samesite="lax",path="/",max_age=S.session_ttl_hours*3600)
    response.set_cookie("gn_csrf",csrf,httponly=False,secure=S.cookie_secure,samesite="lax",path="/",max_age=S.session_ttl_hours*3600)
def profile(user):return json.loads(decrypt_text(user.profile_blob,S.pii_encryption_key)) if user.profile_blob else {"name":user.name,"email":user.email,"phone":""}
