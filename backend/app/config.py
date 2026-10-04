import os
import sys

import secrets

def normalize_database_url(url: str) -> str:
    if not url:
        return "sqlite:///hotel_ekdant.db"
    # Convert legacy postgres:// to postgresql://
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url

def _resolve_secret_key() -> str:
    env_secret = os.getenv("SECRET_KEY")
    if env_secret:
        is_dev = False
        for inv in ["dev-secret-key", "change-in-production"]:
            if inv in env_secret.lower():
                is_dev = True
                break
        if not is_dev:
            return env_secret
    
    # Store persistent secret key file so restarts never logout existing users
    key_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".app_secret.key")
    try:
        if os.path.exists(key_file):
            with open(key_file, "r") as f:
                saved = f.read().strip()
                if len(saved) >= 32:
                    return saved
        new_key = secrets.token_hex(32)
        with open(key_file, "w") as f:
            f.write(new_key)
        return new_key
    except Exception:
        return "ekdant-stable-persistent-jwt-key-2026-production-hotel"

class Config:
    ENV = os.getenv("FLASK_ENV", "development")
    DEBUG = ENV == "development"
    TESTING = False
    
    SECRET_KEY = _resolve_secret_key()
    JWT_SECRET = os.getenv("JWT_SECRET") or SECRET_KEY
    JWT_EXPIRY_HOURS = 720  # 30 days so staff never get logged out during operations
    TABLE_TOKEN_EXPIRY_HOURS = 24

    DATABASE_URL = normalize_database_url(os.getenv("DATABASE_URL", "sqlite:///hotel_ekdant.db"))
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    REDIS_URL = os.getenv("REDIS_URL", None)
    PORT = int(os.getenv("PORT", 5001))
    
    raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
    ALLOWED_ORIGINS = [o.strip() for o in raw_origins.split(",") if o.strip()] if raw_origins != "*" else "*"

    INITIAL_OWNER_PASSWORD = os.getenv("INITIAL_OWNER_PASSWORD", "EkdantOwner@2026")
    UPLOAD_FOLDER = os.path.abspath(os.getenv("UPLOAD_FOLDER", os.path.join(os.path.dirname(__file__), "uploads")))
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max request payload
    
    TIMEZONE = os.getenv("TZ", "Asia/Kolkata")
    SENTRY_DSN = os.getenv("SENTRY_DSN", None)

    @classmethod
    def validate(cls):
        if not cls.SECRET_KEY:
            cls.SECRET_KEY = secrets.token_hex(32)
        if not cls.JWT_SECRET:
            cls.JWT_SECRET = cls.SECRET_KEY

class TestingConfig(Config):
    TESTING = True
    DEBUG = True
    DATABASE_URL = "sqlite:///:memory:"
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    INITIAL_OWNER_PASSWORD = "TestPassword123!"
    ALLOWED_ORIGINS = "*"
