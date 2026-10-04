import secrets
import string
from flask import Blueprint, request, jsonify, g
from app.models import SessionLocal, User, Restaurant
from app.auth import (
    hash_password, verify_password, generate_staff_jwt, 
    require_auth, require_role, get_current_user
)

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Staff login endpoint with strict password verification and JWT token issuance.
    """
    data = request.json or {}
    username = str(data.get('username', '')).strip().lower()
    password = str(data.get('password', '')).strip()

    if not username or not password:
        return jsonify({"error": {"code": "BAD_REQUEST", "message": "Username and password required."}}), 400

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username.ilike(username), User.is_active == True).first()
        if not user or not verify_password(user.password_hash, password):
            return jsonify({"error": {"code": "INVALID_CREDENTIALS", "message": "Invalid username or password."}}), 401

        token = generate_staff_jwt(user)
        return jsonify({
            "token": token,
            "user": {
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "role": user.role,
                "phone": user.phone,
                "must_change_password": user.must_change_password
            }
        })
    finally:
        db.close()

@auth_bp.route('/me', methods=['GET'])
@require_auth
def get_me():
    """Validate token and return current authenticated staff member."""
    user = g.current_user
    return jsonify({
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "phone": user.phone,
        "must_change_password": user.must_change_password
    })

@auth_bp.route('/change-password', methods=['POST'])
@require_auth
def change_password():
    """Allow logged in staff member to change password."""
    data = request.json or {}
    old_password = data.get('old_password', '')
    new_password = data.get('new_password', '')

    if not new_password or len(new_password) < 6:
        return jsonify({"error": {"code": "WEAK_PASSWORD", "message": "New password must be at least 6 characters."}}), 400

    db = SessionLocal()
    try:
        user = db.query(User).get(g.current_user.id)
        if not verify_password(user.password_hash, old_password):
            return jsonify({"error": {"code": "INCORRECT_PASSWORD", "message": "Current password incorrect."}}), 400

        user.password_hash = hash_password(new_password)
        user.must_change_password = False
        db.commit()
        return jsonify({"message": "Password changed successfully."})
    finally:
        db.close()
