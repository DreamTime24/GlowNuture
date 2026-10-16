import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from cryptography.fernet import Fernet, InvalidToken
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

password_hash = PasswordHash((Argon2Hasher(),))

def hash_password(password: str) -> str:
    return password_hash.hash(password)

def verify_password(password: str, encoded: str) -> bool:
    try: return password_hash.verify(password, encoded)
    except Exception: return False

def new_opaque_token() -> str:
    return secrets.token_urlsafe(32)

def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

def normalize_phone(phone: str) -> str:
    number="".join(ch for ch in phone if ch.isdigit())
    return number[2:] if number.startswith("880") else number

def hmac_phone(phone: str, key: str) -> str:
    return hmac.new(key.encode("utf-8"), normalize_phone(phone).encode("utf-8"), hashlib.sha256).hexdigest()

def build_fernet(key: str) -> Fernet:
    # Fernet expects a URL-safe base64 encoded 32-byte key.
    try:
        return Fernet(key.encode("utf-8"))
    except Exception as exc:
        raise ValueError("PII_ENCRYPTION_KEY must be a valid Fernet key") from exc

def encrypt_text(value: str, key: str) -> str:
    return build_fernet(key).encrypt(value.encode("utf-8")).decode("utf-8")

def decrypt_text(value: str, key: str) -> str:
    try:
        return build_fernet(key).decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Unable to decrypt protected data") from exc

def expires_after(hours: int) -> datetime:
    return utcnow() + timedelta(hours=hours)
