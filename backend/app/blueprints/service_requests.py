from flask import Blueprint, request, jsonify, g
from app.models import SessionLocal, ServiceRequest, RestaurantTable
from app.auth import require_auth
from app.money import now_utc

services_bp = Blueprint('service_requests', __name__, url_prefix='/api/service-requests')

@services_bp.route('', methods=['GET'])
@require_auth
def list_service_requests():
    """List pending service calls for staff."""
    db = SessionLocal()
    try:
        reqs = db.query(ServiceRequest).filter(ServiceRequest.status != 'RESOLVED').order_by(ServiceRequest.created_at.desc()).all()
        return jsonify([{
            "id": r.id,
            "table_id": r.table_id,
            "table_number": r.table.table_number if r.table else "",
            "table_name": r.table.name if r.table else "",
            "request_type": r.request_type,
            "status": r.status,
            "created_at": r.created_at.strftime('%I:%M %p') if r.created_at else ""
        } for r in reqs])
    finally:
        db.close()

@services_bp.route('', methods=['POST'])
def create_service_request():
    """Customer sends service request (CALL_WAITER, WATER_REQUEST, BILL_REQUEST)."""
    data = request.json or {}
    table_number = data.get('table_number')
    req_type = data.get('request_type', 'CALL_WAITER')

    if not table_number:
        return jsonify({"error": {"code": "BAD_REQUEST", "message": "Table number required."}}), 400

    db = SessionLocal()
    try:
        fmt = str(table_number).zfill(2)
        table = db.query(RestaurantTable).filter(RestaurantTable.table_number == fmt).first()
        if not table:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Table not found."}}), 404

        req = ServiceRequest(
            table_id=table.id,
            request_type=req_type,
            status="PENDING",
            created_at=now_utc()
        )
        db.add(req)
        db.commit()

        from app.sockets import emit_to_room
        emit_to_room("staff", "new_service_request", {
            "id": req.id,
            "table_number": table.table_number,
            "table_name": table.name,
            "request_type": req.request_type,
            "created_at": req.created_at.strftime('%I:%M %p')
        })

        return jsonify({"message": "Service request dispatched to staff.", "id": req.id}), 201
    finally:
        db.close()

@services_bp.route('/<int:req_id>', methods=['PUT'])
@require_auth
def resolve_service_request(req_id):
    """Staff acknowledges or resolves service request."""
    data = request.json or {}
    st = data.get('status', 'RESOLVED')
    db = SessionLocal()
    try:
        r = db.query(ServiceRequest).get(req_id)
        if not r:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Request not found."}}), 404
        r.status = st
        db.commit()
        return jsonify({"message": f"Service request {st}."})
    finally:
        db.close()
