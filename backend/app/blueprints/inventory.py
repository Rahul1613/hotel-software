from flask import Blueprint, request, jsonify, g
from app.models import SessionLocal, InventoryItem, StockMovement, Recipe, AuditLog
from app.auth import require_role
from app.money import now_utc

inventory_bp = Blueprint('inventory', __name__, url_prefix='/api/inventory')

@inventory_bp.route('', methods=['GET'])
@require_role("owner", "manager", "chef")
def list_inventory():
    """List inventory items with low-stock alert flag."""
    db = SessionLocal()
    try:
        items = db.query(InventoryItem).order_by(InventoryItem.category, InventoryItem.name).all()
        return jsonify([{
            "id": it.id,
            "name": it.name,
            "marathi_name": it.marathi_name,
            "category": it.category,
            "current_stock": it.current_stock,
            "unit": it.unit,
            "min_alert_threshold": it.min_alert_threshold,
            "is_low_stock": it.current_stock <= it.min_alert_threshold,
            "supplier_info": it.supplier_info,
            "last_restocked": it.last_restocked.strftime('%d %b %Y') if it.last_restocked else ""
        } for it in items])
    finally:
        db.close()

@inventory_bp.route('', methods=['POST'])
@require_role("owner", "manager")
def create_inventory_item():
    data = request.json or {}
    name = str(data.get('name', '')).strip()
    if not name:
        return jsonify({"error": {"code": "BAD_REQUEST", "message": "Item name required."}}), 400

    db = SessionLocal()
    try:
        item = InventoryItem(
            name=name,
            marathi_name=data.get('marathi_name'),
            category=data.get('category', 'MEAT'),
            current_stock=float(data.get('current_stock', 0.0)),
            unit=data.get('unit', 'kg'),
            min_alert_threshold=float(data.get('min_alert_threshold', 5.0)),
            supplier_info=data.get('supplier_info'),
            last_restocked=now_utc()
        )
        db.add(item)
        db.commit()
        return jsonify({"message": "Inventory item created.", "id": item.id}), 201
    finally:
        db.close()

@inventory_bp.route('/<int:item_id>/movement', methods=['POST'])
@require_role("owner", "manager", "chef")
def record_stock_movement(item_id):
    """
    Record an immutable stock movement: PURCHASE (restock), AUDIT, or WASTAGE.
    """
    data = request.json or {}
    m_type = data.get('movement_type', 'PURCHASE') # PURCHASE, AUDIT, WASTAGE
    qty_change = float(data.get('quantity_change', 0.0))
    note = data.get('note', '')

    db = SessionLocal()
    try:
        item = db.get(InventoryItem, item_id)
        if not item:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Item not found."}}), 404

        old_stock = item.current_stock
        if m_type == "AUDIT":
            # Exact count set
            item.current_stock = float(data.get('new_stock', old_stock))
            delta = item.current_stock - old_stock
        else:
            item.current_stock = max(0.0, item.current_stock + qty_change)
            delta = qty_change

        item.last_restocked = now_utc()

        # Add movement row
        db.add(StockMovement(
            inventory_item_id=item.id,
            movement_type=m_type,
            quantity_change=delta,
            resulting_stock=item.current_stock,
            note=note,
            user_id=g.current_user.id,
            created_at=now_utc()
        ))

        db.add(AuditLog(
            user_id=g.current_user.id,
            action=f"STOCK_{m_type}",
            entity_type="InventoryItem",
            entity_id=str(item.id),
            old_value={"stock": old_stock},
            new_value={"stock": item.current_stock}
        ))
        db.commit()

        return jsonify({
            "message": "Stock movement recorded successfully.",
            "current_stock": item.current_stock
        })
    finally:
        db.close()

@inventory_bp.route('/<int:item_id>/movements', methods=['GET'])
@require_role("owner", "manager")
def list_stock_movements(item_id):
    """View audit history of stock movements for an item."""
    db = SessionLocal()
    try:
        movements = db.query(StockMovement).filter(
            StockMovement.inventory_item_id == item_id
        ).order_by(StockMovement.created_at.desc()).limit(100).all()

        return jsonify([{
            "id": m.id,
            "movement_type": m.movement_type,
            "quantity_change": m.quantity_change,
            "resulting_stock": m.resulting_stock,
            "note": m.note,
            "created_at": m.created_at.strftime('%d-%b-%Y %I:%M %p') if m.created_at else ""
        } for m in movements])
    finally:
        db.close()
