"""Optional development owner account only; never seed fabricated sellable products."""
from sqlalchemy import select
from ..models.entities import User
from ..core.config import get_settings
from ..core.security import hmac_phone,hash_password
def seed(db):
    settings=get_settings()
    if not settings.local_auth_enabled or not settings.admin_bootstrap_phone or not settings.admin_bootstrap_password:return
    if len(settings.admin_bootstrap_password)<14:raise ValueError("Local bootstrap password requires 14+ characters")
    digest=hmac_phone(settings.admin_bootstrap_phone,settings.pii_hmac_key)
    if not db.scalar(select(User).where(User.phone_hash==digest)):
        db.add(User(phone_hash=digest,name="Local test administrator",password_hash=hash_password(settings.admin_bootstrap_password),role="super_admin",is_active=True))
        db.commit()
