import secrets
import string
from flask import Blueprint, request, jsonify, g
from app.models import SessionLocal, User, AuditLog
from app.auth import require_role, hash_password
from app.money import now_utc

staff_bp = Blueprint('staff', __name__, url_prefix='/api/staff')

def generate_random_password(length=10) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(secrets.choice(alphabet) for _ in range(length))

@staff_bp.route('', methods=['GET'])
@require_role("owner", "manager")
def list_staff():
    """List staff with roles and status."""
    db = SessionLocal()
    try:
        users = db.query(User).order_by(User.id).all()
        return jsonify([{
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "role": u.role,
            "phone": u.phone,
            "is_active": u.is_active,
            "must_change_password": u.must_change_password,
            "created_at": u.created_at.isoformat() if u.created_at else None
        } for u in users])
    finally:
        db.close()

@staff_bp.route('', methods=['POST'])
@require_role("owner")
def create_staff():
    """Owner creates new staff member with random initial password."""
    data = request.json or {}
    username = str(data.get('username', '')).strip().lower()
    full_name = str(data.get('full_name', '')).strip()
    role = str(data.get('role', 'waiter')).lower()
    phone = data.get('phone')

    if not username or not full_name:
        return jsonify({"error": {"code": "BAD_REQUEST", "message": "Username and full name required."}}), 400

    temp_password = generate_random_password()
    db = SessionLocal()
    try:
        if db.query(User).filter(User.username == username).first():
            return jsonify({"error": {"code": "CONFLICT", "message": "Username already exists."}}), 409

        new_user = User(
            username=username,
            password_hash=hash_password(temp_password),
            full_name=full_name,
            role=role,
            phone=phone,
            is_active=True,
            must_change_password=True,
            created_at=now_utc()
        )
        db.add(new_user)
        db.commit()

        # Audit log
        db.add(AuditLog(
            user_id=g.current_user.id,
            action="STAFF_CREATED",
            entity_type="User",
            entity_id=str(new_user.id),
            new_value={"username": username, "role": role}
        ))
        db.commit()

        return jsonify({
            "message": "Staff member created successfully.",
            "id": new_user.id,
            "temp_password": temp_password
        }), 201
    finally:
        db.close()

@staff_bp.route('/<int:user_id>', methods=['PUT'])
@require_role("owner")
def update_staff(user_id):
    """Owner updates staff details or role."""
    data = request.json or {}
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        if not user:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Staff not found."}}), 404

        if "full_name" in data: user.full_name = data["full_name"]
        if "role" in data: user.role = str(data["role"]).lower()
        if "phone" in data: user.phone = data["phone"]
        if "is_active" in data: user.is_active = bool(data["is_active"])

        db.commit()
        return jsonify({"message": "Staff details updated."})
    finally:
        db.close()

@staff_bp.route('/<int:user_id>/reset-password', methods=['POST'])
@require_role("owner")
def reset_staff_password(user_id):
    """Owner resets staff password and generates random one-time password."""
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        if not user:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Staff not found."}}), 404

        temp_password = generate_random_password()
        user.password_hash = hash_password(temp_password)
        user.must_change_password = True
        db.commit()

        return jsonify({
            "message": "Password reset successfully.",
            "temp_password": temp_password
        })
    finally:
        db.close()
