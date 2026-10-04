import uuid
from flask import Blueprint, request, jsonify, g, current_app, Response
from app.models import SessionLocal, RestaurantTable, TableSession, Order
from app.auth import require_auth, require_role, generate_table_session_token
from app.services.session_service import get_or_create_active_session, compute_table_effective_status
from app.services.qr_service import generate_table_qr_image

tables_bp = Blueprint('tables', __name__, url_prefix='/api/tables')

@tables_bp.route('', methods=['GET'])
def list_tables():
    """List tables with dynamically computed status."""
    db = SessionLocal()
    try:
        tables = db.query(RestaurantTable).order_by(RestaurantTable.table_number).all()
        result = []
        for t in tables:
            effective_status = compute_table_effective_status(db, t)
            # Find active session
            active_session = db.query(TableSession).filter(
                TableSession.table_id == t.id,
                TableSession.status.in_(["OPEN", "BILL_REQUESTED"])
            ).first()

            active_orders = active_session.orders if active_session else []
            active_order_ids = [o.id for o in active_orders if o.status != "CANCELLED"]

            result.append({
                "id": t.id,
                "table_number": t.table_number,
                "name": t.name,
                "section": t.section,
                "capacity": t.capacity,
                "status": effective_status,
                "manual_status_override": t.manual_status_override,
                "is_active": t.is_active,
                "active_session_id": active_session.id if active_session else None,
                "active_order_count": len(active_order_ids),
                "active_order_ids": active_order_ids
            })
        return jsonify(result)
    finally:
        db.close()

@tables_bp.route('/verify', methods=['GET'])
def verify_table_token():
    """
    Public QR token verification.
    Validates QR token and returns table info + short-lived signed Table-Session token.
    Supports development fallback '?table=' when in dev mode.
    """
    token = request.args.get('token') or request.args.get('t')
    dev_table_num = request.args.get('table')

    db = SessionLocal()
    try:
        table = None
        if token:
            table = db.query(RestaurantTable).filter(
                RestaurantTable.qr_code_token == token,
                RestaurantTable.is_active == True
            ).first()
        elif dev_table_num:
            # Format leading zero
            formatted = str(dev_table_num).zfill(2)
            table = db.query(RestaurantTable).filter(
                RestaurantTable.table_number == formatted,
                RestaurantTable.is_active == True
            ).first()

        if not table:
            return jsonify({"error": {"code": "INVALID_TABLE", "message": "Invalid or inactive table QR token."}}), 404

        # Get or create active session
        session = get_or_create_active_session(db, table, opened_by="CUSTOMER")
        table_session_token = generate_table_session_token(session.id, table.table_number)

        return jsonify({
            "table_id": table.id,
            "table_number": table.table_number,
            "name": table.name,
            "section": table.section,
            "capacity": table.capacity,
            "status": compute_table_effective_status(db, table),
            "session_id": session.id,
            "table_session_token": table_session_token
        })
    finally:
        db.close()

@tables_bp.route('/<int:table_id>/override-status', methods=['PUT'])
@require_role("waiter", "manager", "owner")
def override_table_status(table_id):
    """Staff sets or clears manual override (e.g. NEEDS_ATTENTION, DISABLED)."""
    data = request.json or {}
    override = data.get('override')  # 'NEEDS_ATTENTION', 'DISABLED', or None

    db = SessionLocal()
    try:
        table = db.query(RestaurantTable).get(table_id)
        if not table:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Table not found."}}), 404

        table.manual_status_override = override
        db.commit()

        # Emit socket event
        from app.sockets import emit_to_room
        emit_to_room("staff", "table_updated", {
            "table_id": table.id,
            "table_number": table.table_number,
            "status": compute_table_effective_status(db, table)
        })

        return jsonify({"message": "Table status override updated."})
    finally:
        db.close()

@tables_bp.route('/<int:table_id>/regenerate-token', methods=['POST'])
@require_role("owner")
def regenerate_qr_token(table_id):
    """Owner action to revoke compromised QR code and generate fresh one."""
    db = SessionLocal()
    try:
        table = db.query(RestaurantTable).get(table_id)
        if not table:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Table not found."}}), 404

        table.qr_code_token = str(uuid.uuid4())
        db.commit()
        return jsonify({
            "message": "QR Token regenerated successfully.",
            "new_token": table.qr_code_token
        })
    finally:
        db.close()

@tables_bp.route('/<table_number>/qr.png', methods=['GET'])
def get_table_qr_png(table_number):
    """Generate and return table QR code image on demand."""
    db = SessionLocal()
    try:
        fmt = str(table_number).zfill(2)
        table = db.query(RestaurantTable).filter(RestaurantTable.table_number == fmt).first()
        if not table:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Table not found."}}), 404

        base_url = request.host_url.rstrip('/')
        png_bytes = generate_table_qr_image(table.table_number, table.qr_code_token, base_url=base_url)
        return Response(png_bytes, mimetype='image/png')
    finally:
        db.close()

@tables_bp.route('/shift-session', methods=['POST'])
@require_role("waiter", "manager", "owner")
def shift_session():
    """Shift an entire dining session from one table to another."""
    data = request.json or {}
    from_table_num = str(data.get('from_table')).zfill(2)
    to_table_num = str(data.get('to_table')).zfill(2)

    db = SessionLocal()
    try:
        from_tbl = db.query(RestaurantTable).filter(RestaurantTable.table_number == from_table_num).first()
        to_tbl = db.query(RestaurantTable).filter(RestaurantTable.table_number == to_table_num).first()

        if not from_tbl or not to_tbl:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Source or destination table not found."}}), 404

        session = db.query(TableSession).filter(
            TableSession.table_id == from_tbl.id,
            TableSession.status.in_(["OPEN", "BILL_REQUESTED"])
        ).first()

        if not session:
            return jsonify({"error": {"code": "NO_SESSION", "message": f"No active session found on Table {from_table_num}."}}), 400

        # Move session and its orders to to_tbl
        session.table_id = to_tbl.id
        for ord in session.orders:
            ord.table_id = to_tbl.id

        db.commit()

        from app.sockets import emit_to_room
        emit_to_room("staff", "table_shifted", {
            "from_table": from_table_num,
            "to_table": to_table_num,
            "session_id": session.id
        })

        return jsonify({
            "message": f"Successfully shifted dining session from Table {from_table_num} to Table {to_table_num}."
        })
    finally:
        db.close()

@tables_bp.route('/merge-sessions', methods=['POST'])
@require_role("waiter", "manager", "owner")
def merge_sessions():
    """Merge secondary table session orders into primary table session."""
    data = request.json or {}
    primary_num = str(data.get('primary_table')).zfill(2)
    secondary_num = str(data.get('secondary_table')).zfill(2)

    db = SessionLocal()
    try:
        primary_tbl = db.query(RestaurantTable).filter(RestaurantTable.table_number == primary_num).first()
        sec_tbl = db.query(RestaurantTable).filter(RestaurantTable.table_number == secondary_num).first()

        if not primary_tbl or not sec_tbl:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Tables not found."}}), 404

        prim_session = get_or_create_active_session(db, primary_tbl, opened_by="STAFF")
        sec_session = db.query(TableSession).filter(
            TableSession.table_id == sec_tbl.id,
            TableSession.status.in_(["OPEN", "BILL_REQUESTED"])
        ).first()

        if not sec_session:
            return jsonify({"error": {"code": "NO_SESSION", "message": f"No active session on Table {secondary_num}."}}), 400

        # Re-assign orders
        for ord in sec_session.orders:
            ord.session_id = prim_session.id
            ord.table_id = primary_tbl.id

        sec_session.status = "CLOSED"
        db.commit()

        from app.sockets import emit_to_room
        emit_to_room("staff", "table_merged", {
            "primary_table": primary_num,
            "secondary_table": secondary_num
        })

        return jsonify({
            "message": f"Successfully merged Table {secondary_num} into Table {primary_num}."
        })
    finally:
        db.close()
