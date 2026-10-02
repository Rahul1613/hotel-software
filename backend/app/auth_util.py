import hashlib
import os

def hash_password(password: str) -> str:
    """Hash password using pbkdf2_hmac with sha256 and salt"""
    salt = os.urandom(16).hex()
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return f"pbkdf2:sha256:100000${salt}${key}"

def verify_password(stored_password: str, provided_password: str) -> bool:
    """Verify password hash"""
    try:
        parts = stored_password.split('$')
        if len(parts) != 3:
            return False
        algorithm, salt, key = parts
        new_key = hashlib.pbkdf2_hmac(
            'sha256',
            provided_password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        ).hex()
        return key == new_key
    except Exception:
        return False
