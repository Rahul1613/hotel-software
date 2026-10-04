import os
import sys

def normalize_database_url(url: str) -> str:
    if not url:
        return "sqlite:///hotel_ekdant.db"
    # Convert legacy postgres:// to postgresql://
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url

class Config:
    ENV = os.getenv("FLASK_ENV", "development")
    DEBUG = ENV == "development"
    TESTING = False
    
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production-min-32-chars")
    JWT_SECRET = os.getenv("JWT_SECRET", os.getenv("SECRET_KEY", "dev-jwt-secret-change-in-production-min-32-chars"))
    JWT_EXPIRY_HOURS = 12
    TABLE_TOKEN_EXPIRY_HOURS = 4

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
        if cls.ENV == "production":
            invalids = ["dev-secret-key", "secret", "ekdant", "change-in-production"]
            if any(inv in cls.SECRET_KEY.lower() for inv in invalids):
                raise RuntimeError("CRITICAL SECURITY ERROR: Production deployment requires a secure, non-default SECRET_KEY.")
            if not os.getenv("INITIAL_OWNER_PASSWORD"):
                raise RuntimeError("CRITICAL CONFIG ERROR: Production deployment requires an explicit INITIAL_OWNER_PASSWORD.")

class TestingConfig(Config):
    TESTING = True
    DEBUG = True
    DATABASE_URL = "sqlite:///:memory:"
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    INITIAL_OWNER_PASSWORD = "TestPassword123!"
    ALLOWED_ORIGINS = "*"
