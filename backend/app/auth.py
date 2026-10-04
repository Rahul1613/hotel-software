from datetime import datetime, timedelta
import jwt
from functools import wraps
from flask import request, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash
from app.config import Config
from app.models import SessionLocal, User

# Role hierarchy and normalized roles:
# owner: superadmin
# manager: operations
# cashier: billing
# waiter: order taking & service
# chef: kitchen screen
ROLE_HIERARCHY = {
    "owner": ["owner", "manager", "cashier", "waiter", "chef"],
    "manager": ["manager", "cashier", "waiter", "chef"],
    "cashier": ["cashier"],
    "waiter": ["waiter"],
    "chef": ["chef"],
}

def hash_password(password: str) -> str:
    return generate_password_hash(password, method='pbkdf2:sha256')

def verify_password(password_hash: str, password: str) -> bool:
    if not password_hash or not password:
        return False
    return check_password_hash(password_hash, password)

def generate_staff_jwt(user: User) -> str:
    """Generate 12-hour signed JWT for staff user."""
    payload = {
        "sub": str(user.id),
        "user_id": user.id,
        "username": user.username,
        "role": user.role,
        "full_name": user.full_name,
        "exp": datetime.utcnow() + timedelta(hours=Config.JWT_EXPIRY_HOURS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, Config.JWT_SECRET, algorithm="HS256")

def decode_staff_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None

def generate_table_session_token(session_id: int, table_number: str) -> str:
    """Generate signed 4-hour table session token for customers."""
    payload = {
        "type": "table_session",
        "session_id": session_id,
        "table_number": table_number,
        "exp": datetime.utcnow() + timedelta(hours=Config.TABLE_TOKEN_EXPIRY_HOURS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, Config.JWT_SECRET, algorithm="HS256")

def decode_table_session_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "table_session":
            return None
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None

def generate_order_token(order_id: int, session_id: int) -> str:
    """Generate signed customer access token for specific order."""
    payload = {
        "type": "order_access",
        "order_id": order_id,
        "session_id": session_id,
        "exp": datetime.utcnow() + timedelta(days=2),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, Config.JWT_SECRET, algorithm="HS256")

def decode_order_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "order_access":
            return None
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None

def get_current_user():
    """Extract and authenticate staff user from Authorization: Bearer <token>"""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1].strip()
    payload = decode_staff_jwt(token)
    if not payload:
        return None
    
    db = SessionLocal()
    user = db.query(User).filter(User.id == payload.get("user_id"), User.is_active == True).first()
    return user

def require_auth(f):
    """Decorator ensuring valid staff JWT is present."""
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": {"code": "UNAUTHORIZED", "message": "Authentication required or token expired."}}), 401
        g.current_user = user
        return f(*args, **kwargs)
    return decorated

def require_role(*allowed_roles):
    """Decorator ensuring authenticated user has one of allowed roles or higher."""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({"error": {"code": "UNAUTHORIZED", "message": "Authentication required."}}), 401
            g.current_user = user
            user_role = user.role.lower()

            # Normalization of old names
            if user_role == "admin":
                user_role = "owner"
            elif user_role == "cook":
                user_role = "chef"

            # Check if user role matches or can act as one of allowed roles
            authorized = False
            for allowed in allowed_roles:
                norm_allowed = allowed.lower()
                if norm_allowed == "admin": norm_allowed = "owner"
                if norm_allowed == "cook": norm_allowed = "chef"

                if user_role == norm_allowed or norm_allowed in ROLE_HIERARCHY.get(user_role, []):
                    authorized = True
                    break

            if not authorized:
                return jsonify({
                    "error": {
                        "code": "FORBIDDEN",
                        "message": f"Access denied. Requires one of roles: {', '.join(allowed_roles)}."
                    }
                }), 403
            return f(*args, **kwargs)
        return decorated
    return decorator
