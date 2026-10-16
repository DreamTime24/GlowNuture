from functools import lru_cache
from pydantic import model_validator
from pydantic_settings import BaseSettings,SettingsConfigDict
from cryptography.fernet import Fernet
from urllib.parse import urlsplit

class Settings(BaseSettings):
    app_env:str="development"
    app_name:str="Glow Nuture API"
    database_url:str="sqlite:///./glownuture.db"
    session_ttl_hours:int=12
    cookie_secure:bool=False
    allowed_origin:str="http://127.0.0.1:8000"
    pii_encryption_key:str
    pii_hmac_key:str
    admin_bootstrap_phone:str=""
    admin_bootstrap_password:str=""
    local_auth_enabled:bool=False
    seed_demo_products:bool=False
    auto_create_schema:bool=False
    firebase_enabled:bool=True
    firebase_project_id:str="glownuture-f157c"
    firebase_api_key:str=""
    firebase_auth_domain:str="glownuture-f157c.firebaseapp.com"
    firebase_storage_bucket:str="glownuture-f157c.firebasestorage.app"
    firebase_messaging_sender_id:str="967903213091"
    firebase_app_id:str="1:967903213091:web:ce788c461791607a842396"
    firebase_measurement_id:str="G-R2GNWV9XVH"
    firebase_database_url:str="https://glownuture-f157c-default-rtdb.asia-southeast1.firebasedatabase.app/"
    firebase_vapid_key:str=""
    firebase_google_enabled:bool=True
    firebase_facebook_enabled:bool=False
    enforce_admin_mfa:bool=True
    app_check_enforce:bool=False
    app_check_site_key:str=""
    recaptcha_site_key:str=""
    recaptcha_secret:str=""
    recaptcha_enabled:bool=False
    recaptcha_mode:str="v2"
    parse_api_key:str=""
    parse_key_rotation_confirmed:bool=False
    catalog_reference_enabled:bool=False
    media_root:str=""
    catalog_max_pages:int=5
    support_email:str=""
    support_phone:str=""
    seller_legal_name:str=""
    seller_address:str=""
    checkout_enabled:bool=False
    cod_enabled:bool=True
    shipping_dhaka:int=60
    shipping_outside:int=120
    free_shipping_threshold:int=2500
    tax_percent:float=0
    sslcommerz_store_id:str=""
    sslcommerz_store_password:str=""
    sslcommerz_live:bool=False
    sslcommerz_live_verified:bool=False
    smtp_host:str=""
    smtp_port:int=587
    smtp_username:str=""
    smtp_password:str=""
    smtp_from:str=""
    facebook_url:str="https://www.facebook.com/glownuturebd"
    instagram_url:str="https://www.instagram.com/glownuture/reels/"
    analytics_enabled:bool=False
    journal_enabled:bool=False
    ai_enabled:bool=False
    model_config=SettingsConfigDict(env_file=".env",case_sensitive=False,extra="ignore",hide_input_in_errors=True)
    @model_validator(mode="after")
    def validate_configuration(self):
        origin=urlsplit(self.allowed_origin)
        if origin.scheme not in {"http","https"} or not origin.hostname or origin.path or origin.query or origin.fragment:
            raise ValueError("ALLOWED_ORIGIN must be an exact origin without a path or trailing slash")
        try: Fernet(self.pii_encryption_key.encode())
        except Exception: raise ValueError("Generate a valid PII_ENCRYPTION_KEY using setup_local.py") from None
        if len(self.pii_hmac_key)<32 or self.pii_hmac_key.startswith("REPLACE"):
            raise ValueError("Generate a random PII_HMAC_KEY with at least 32 characters")
        if self.app_env=="production":
            if not self.database_url.startswith("postgresql") or not self.cookie_secure or origin.scheme!="https":
                raise ValueError("Production requires PostgreSQL, HTTPS and secure cookies")
            if self.local_auth_enabled or self.seed_demo_products or self.auto_create_schema:
                raise ValueError("Development authentication, demo seeding and create_all are disabled in production")
            if not self.enforce_admin_mfa: raise ValueError("Staff MFA must be enforced in production")
        if self.sslcommerz_live and not self.sslcommerz_live_verified:
            raise ValueError("Verify the approved merchant account before enabling live payments")
        if min(self.shipping_dhaka,self.shipping_outside,self.free_shipping_threshold)<0 or not 0<=self.tax_percent<=100:
            raise ValueError("Invalid delivery or tax settings")
        if self.recaptcha_mode not in {"v2","v3"}: raise ValueError("Choose the correct reCAPTCHA key type")
        return self
@lru_cache
def get_settings()->Settings:return Settings()
