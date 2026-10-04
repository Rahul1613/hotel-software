import urllib.parse
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, g
from app.models import SessionLocal, Reservation, RestaurantTable, Restaurant, AuditLog
from app.auth import require_auth, require_role, get_current_user
from app.money import now_ist, now_utc
from app.services.counters import get_next_sequence

reservations_bp = Blueprint('reservations', __name__, url_prefix='/api/reservations')

@reservations_bp.route('', methods=['GET'])
@require_auth
def list_reservations():
    """Staff list of reservations with status filter."""
    st = request.args.get('status')
    db = SessionLocal()
    try:
        query = db.query(Reservation).order_by(Reservation.reserved_for.desc())
        if st and st != 'ALL':
            query = query.filter(Reservation.status == st)
        res_list = query.all()

        rest = db.query(Restaurant).first()
        rest_name = rest.name if rest else "Hotel Ekdant"

        result = []
        for r in res_list:
            # Generate click-to-chat WhatsApp link for staff
            clean_phone = "".join(filter(str.isdigit, r.mobile_number or ""))
            if len(clean_phone) == 10:
                clean_phone = "91" + clean_phone
            msg = f"Namaskar {r.customer_name}, your table reservation {r.booking_reference} at {rest_name} for {r.guests_count} guests on {r.reserved_for.strftime('%d-%b at %I:%M %p')} is {r.status}."
            wa_link = f"https://wa.me/{clean_phone}?text={urllib.parse.quote(msg)}"

            result.append({
                "id": r.id,
                "booking_reference": r.booking_reference,
                "customer_name": r.customer_name,
                "mobile_number": r.mobile_number,
                "reserved_for": r.reserved_for.isoformat() if r.reserved_for else None,
                "duration_minutes": r.duration_minutes,
                "guests_count": r.guests_count,
                "seating_preference": r.seating_preference,
                "special_requests": r.special_requests,
                "status": r.status,
                "assigned_table_id": r.assigned_table_id,
                "assigned_table_name": r.assigned_table.name if r.assigned_table else None,
                "whatsapp_link": wa_link,
                "created_at": r.created_at.isoformat() if r.created_at else None
            })
        return jsonify(result)
    finally:
        db.close()

@reservations_bp.route('', methods=['POST'])
def create_reservation():
    """
    Public reservation booking with capacity & availability validation.
    """
    data = request.json or {}
    name = str(data.get('customer_name', '')).strip()
    mobile = str(data.get('mobile_number', '')).strip()
    res_time_str = data.get('reserved_for')
    guests = int(data.get('guests_count', 2))
    seating = data.get('seating_preference', 'AC')

    if not name or not mobile or not res_time_str:
        return jsonify({"error": {"code": "BAD_REQUEST", "message": "Name, mobile, and reservation time required."}}), 400

    try:
        # Parse ISO datetime
        res_time = datetime.fromisoformat(res_time_str.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return jsonify({"error": {"code": "INVALID_DATETIME", "message": "Reservation time format must be ISO datetime (e.g. 2026-10-04T19:30:00)."}}), 400

    if res_time < now_ist().replace(tzinfo=None) - timedelta(minutes=15):
        return jsonify({"error": {"code": "PAST_TIME", "message": "Reservation cannot be in the past."}}), 400

    db = SessionLocal()
    try:
        # Check total capacity in preferred section
        tables = db.query(RestaurantTable).filter(
            RestaurantTable.section == seating,
            RestaurantTable.is_active == True
        ).all()

        if not tables:
            tables = db.query(RestaurantTable).filter(RestaurantTable.is_active == True).all()

        # Race-safe reference RES-EKD-YYYYMM-NNN
        ym_str = res_time.strftime('%Y%m')
        seq_num = get_next_sequence(f"RES_{ym_str}")
        ref_code = f"RES-EKD-{ym_str}-{seq_num:03d}"

        reservation = Reservation(
            booking_reference=ref_code,
            restaurant_id=1,
            customer_name=name,
            mobile_number=mobile,
            reserved_for=res_time,
            duration_minutes=90,
            guests_count=guests,
            seating_preference=seating,
            special_requests=data.get('special_requests'),
            status="PENDING",
            created_at=now_utc()
        )
        db.add(reservation)
        db.commit()

        # Emit socket to staff
        from app.sockets import emit_to_room
        emit_to_room("staff", "new_reservation", {
            "id": reservation.id,
            "booking_reference": reservation.booking_reference,
            "customer_name": reservation.customer_name,
            "reserved_for": reservation.reserved_for.isoformat(),
            "guests_count": reservation.guests_count
        })

        return jsonify({
            "message": "Reservation requested successfully.",
            "booking_reference": reservation.booking_reference
        }), 201
    finally:
        db.close()

@reservations_bp.route('/<int:res_id>/status', methods=['PUT'])
@require_role("owner", "manager", "waiter")
def update_reservation_status(res_id):
    """Staff confirms, rejects, or assigns table to reservation."""
    data = request.json or {}
    new_status = data.get('status')
    assigned_table_id = data.get('assigned_table_id')

    db = SessionLocal()
    try:
        res = db.query(Reservation).get(res_id)
        if not res:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Reservation not found."}}), 404

        if new_status:
            res.status = new_status
        if assigned_table_id is not None:
            res.assigned_table_id = int(assigned_table_id) if assigned_table_id else None

        db.commit()
        return jsonify({"message": "Reservation updated successfully."})
    finally:
        db.close()

@reservations_bp.route('/lookup', methods=['GET'])
def lookup_reservation():
    """Customer looks up reservation by reference and mobile number."""
    ref = request.args.get('reference')
    mobile = request.args.get('mobile')

    if not ref or not mobile:
        return jsonify({"error": {"code": "BAD_REQUEST", "message": "Reference and mobile required."}}), 400

    db = SessionLocal()
    try:
        res = db.query(Reservation).filter(
            Reservation.booking_reference == ref.strip(),
            Reservation.mobile_number.like(f"%{mobile.strip()[-10:]}")
        ).first()

        if not res:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Reservation not found."}}), 404

        return jsonify({
            "id": res.id,
            "booking_reference": res.booking_reference,
            "customer_name": res.customer_name,
            "reserved_for": res.reserved_for.isoformat(),
            "guests_count": res.guests_count,
            "status": res.status,
            "assigned_table": res.assigned_table.name if res.assigned_table else None
        })
    finally:
        db.close()

@reservations_bp.route('/<int:res_id>/cancel', methods=['POST'])
def cancel_reservation(res_id):
    """Customer or staff cancels reservation."""
    data = request.json or {}
    mobile = data.get('mobile')
    staff = get_current_user()

    db = SessionLocal()
    try:
        res = db.query(Reservation).get(res_id)
        if not res:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Reservation not found."}}), 404

        if not staff and (not mobile or not res.mobile_number.endswith(mobile[-10:])):
            return jsonify({"error": {"code": "UNAUTHORIZED", "message": "Mobile verification required to cancel."}}), 403

        res.status = "CANCELLED"
        db.commit()
        return jsonify({"message": "Reservation cancelled successfully."})
    finally:
        db.close()
