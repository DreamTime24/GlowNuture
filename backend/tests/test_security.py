from app.core.security import hash_password, verify_password, hmac_phone

def test_password_roundtrip():
    encoded = hash_password("A-strong-demo-password-123!")
    assert encoded != "A-strong-demo-password-123!"
    assert verify_password("A-strong-demo-password-123!", encoded)
    assert not verify_password("wrong-password", encoded)

def test_phone_hmac_is_stable():
    secret = "secret-test-key"
    assert hmac_phone("01700000000", secret) == hmac_phone("+8801700000000", secret)
