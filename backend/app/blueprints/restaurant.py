from flask import Blueprint, request, jsonify, g
from app.models import SessionLocal, Restaurant
from app.auth import require_role

restaurant_bp = Blueprint('restaurant', __name__, url_prefix='/api/restaurant')

@restaurant_bp.route('', methods=['GET'])
def get_restaurant_info():
    """Public read of restaurant details and branding."""
    db = SessionLocal()
    try:
        rest = db.query(Restaurant).first()
        if not rest:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Restaurant not found"}}), 404
        return jsonify({
            "id": rest.id,
            "name": rest.name,
            "tagline": rest.tagline,
            "address": rest.address,
            "phone": rest.phone,
            "whatsapp": rest.whatsapp,
            "gstin": rest.gstin,
            "fssai": rest.fssai,
            "opening_hours": rest.opening_hours,
            "cgst_rate": rest.cgst_rate,
            "sgst_rate": rest.sgst_rate,
            "service_charge_rate": rest.service_charge_rate,
            "service_charge_enabled": rest.service_charge_enabled,
            "discount_limit_cashier": rest.discount_limit_cashier,
            "invoice_prefix": rest.invoice_prefix,
            "upi_id": rest.upi_id,
            "sound_alerts_enabled": rest.sound_alerts_enabled,
            "takeaway_enabled": rest.takeaway_enabled,
        })
    finally:
        db.close()

@restaurant_bp.route('', methods=['PUT'])
@require_role("owner")
def update_restaurant_info():
    """Owner-only update of restaurant information, GST and legal settings."""
    data = request.json or {}
    db = SessionLocal()
    try:
        rest = db.query(Restaurant).first()
        if not rest:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Restaurant not found"}}), 404

        fields = [
            "name", "tagline", "address", "phone", "whatsapp", "gstin", "fssai", 
            "opening_hours", "invoice_prefix", "upi_id"
        ]
        for f in fields:
            if f in data:
                setattr(rest, f, data[f])

        if "cgst_rate" in data: rest.cgst_rate = float(data["cgst_rate"])
        if "sgst_rate" in data: rest.sgst_rate = float(data["sgst_rate"])
        if "service_charge_rate" in data: rest.service_charge_rate = float(data["service_charge_rate"])
        if "service_charge_enabled" in data: rest.service_charge_enabled = bool(data["service_charge_enabled"])
        if "sound_alerts_enabled" in data: rest.sound_alerts_enabled = bool(data["sound_alerts_enabled"])
        if "takeaway_enabled" in data: rest.takeaway_enabled = bool(data["takeaway_enabled"])
        if "discount_limit_cashier" in data: rest.discount_limit_cashier = int(data["discount_limit_cashier"])

        db.commit()
        return jsonify({"message": "Restaurant settings updated successfully."})
    finally:
        db.close()
