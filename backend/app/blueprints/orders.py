import uuid
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, g
from app.models import (
    SessionLocal, Order, OrderItem, OrderStatusHistory, Restaurant, 
    RestaurantTable, TableSession, MenuItem, MenuItemAddon, Recipe, 
    InventoryItem, StockMovement, AuditLog
)
from app.auth import (
    require_auth, require_role, decode_table_session_token, 
    decode_order_token, generate_order_token, get_current_user
)
from app.money import (
    calculate_gst_breakdown, paise_to_rupees, format_inr, 
    now_utc, now_ist
)
from app.services.counters import get_next_sequence
from app.services.session_service import get_or_create_active_session, compute_table_effective_status

orders_bp = Blueprint('orders', __name__, url_prefix='/api/orders')

@orders_bp.route('', methods=['GET'])
@require_auth
def list_orders():
    """
    Staff-only endpoint: list orders with filtering and pagination.
    Protects customer data leaks.
    """
    table_id = request.args.get('table_id')
    status = request.args.get('status')
    order_type = request.args.get('order_type')
    limit = min(100, int(request.args.get('limit', 50)))
    offset = int(request.args.get('offset', 0))

    db = SessionLocal()
    try:
        query = db.query(Order).order_by(Order.created_at.desc())
        if table_id:
            query = query.filter(Order.table_id == int(table_id))
        if status and status != 'ALL':
            query = query.filter(Order.status == status)
        if order_type:
            query = query.filter(Order.order_type == order_type)

        orders = query.offset(offset).limit(limit).all()
        result = []
        for o in orders:
            session_inv_id = o.session.invoice_id if o.session else None
            session_inv_num = o.session.invoice.invoice_number if (o.session and o.session.invoice) else None
            result.append({
                "id": o.id,
                "order_number": o.order_number,
                "table_id": o.table_id,
                "table_number": o.table.table_number if o.table else None,
                "table_name": o.table.name if o.table else "Takeaway",
                "section": o.table.section if o.table else "Takeaway",
                "session_id": o.session_id,
                "invoice_id": session_inv_id,
                "invoice_number": session_inv_num,
                "order_type": o.order_type,
                "source": o.source,
                "customer_name": o.customer_name,
                "customer_phone": o.customer_phone,
                "status": o.status,
                "special_instructions": o.special_instructions,
                "subtotal": paise_to_rupees(o.subtotal),
                "subtotal_paise": o.subtotal,
                "cgst_amount": paise_to_rupees(o.cgst_amount),
                "sgst_amount": paise_to_rupees(o.sgst_amount),
                "final_amount_paise": o.final_amount,
                "final_amount": paise_to_rupees(o.final_amount),
                "created_at": o.created_at.isoformat() if o.created_at else None,
                "items": [{
                    "id": it.id,
                    "item_id": it.item_id,
                    "item_name": it.item_name,
                    "price_paise": it.price,
                    "price": paise_to_rupees(it.price),
                    "quantity": it.quantity,
                    "is_veg": it.is_veg,
                    "kitchen_station": it.kitchen_station,
                    "customization": it.customization,
                    "selected_addons": it.selected_addons,
                    "total_price_paise": it.total_price,
                    "total_price": paise_to_rupees(it.total_price),
                    "item_status": it.item_status
                } for it in o.items]
            })
        return jsonify(result)
    finally:
        db.close()

@orders_bp.route('/active-session', methods=['GET'])
def get_active_dining_session():
    """
    Returns active dining session, orders, and running bill for a table or customer token.
    Allows customers to view preparation progress and running bill without losing context.
    """
    token = request.args.get('token')
    order_token = request.args.get('order_token')
    table_num = request.args.get('table')

    db = SessionLocal()
    try:
        session = None
        # 1. Order access token
        if order_token:
            payload = decode_order_token(order_token)
            if payload:
                ord_id = payload.get('order_id')
                o = db.get(Order, ord_id)
                if o and o.session:
                    session = o.session
        # 2. Table session token
        if not session and token:
            payload = decode_table_session_token(token)
            if payload:
                sess_id = payload.get('session_id')
                session = db.get(TableSession, sess_id)
        # 3. Table number fallback
        if not session and table_num:
            formatted = str(table_num).zfill(2)
            tbl = db.query(RestaurantTable).filter(RestaurantTable.table_number == formatted, RestaurantTable.is_active == True).first()
            if tbl:
                session = db.query(TableSession).filter(
                    TableSession.table_id == tbl.id,
                    TableSession.status.in_(["OPEN", "BILL_REQUESTED", "BILLED"])
                ).order_by(TableSession.opened_at.desc()).first()

        if not session:
            return jsonify({"active": False, "message": "No active dining session found."}), 200

        orders = [o for o in session.orders if o.status != "CANCELLED"]
        if not orders:
            return jsonify({"active": False, "session_id": session.id, "message": "No active orders in session."}), 200

        total_subtotal_paise = sum(o.subtotal for o in orders)
        total_final_paise = sum(o.final_amount for o in orders)
        all_served = len(orders) > 0 and all(o.status in ("SERVED", "COMPLETED") for o in orders)
        is_billed = session.status in ("BILLED", "CLOSED")
        latest_order = orders[-1]

        items_summary = []
        for o in orders:
            for it in o.items:
                if it.item_status != "CANCELLED":
                    items_summary.append({
                        "id": it.id,
                        "order_id": o.id,
                        "order_number": o.order_number,
                        "item_name": it.item_name,
                        "quantity": it.quantity,
                        "price": paise_to_rupees(it.price),
                        "total_price": paise_to_rupees(it.total_price),
                        "item_status": it.item_status
                    })

        return jsonify({
            "active": True,
            "session_id": session.id,
            "table_id": session.table_id,
            "table_number": session.table.table_number if session.table else None,
            "table_name": session.table.name if session.table else "Takeaway",
            "section": session.table.section if session.table else "Takeaway",
            "session_status": session.status,
            "all_served": all_served,
            "is_billed": is_billed,
            "invoice_id": session.invoice_id,
            "orders_count": len(orders),
            "latest_order_id": latest_order.id,
            "latest_order_number": latest_order.order_number,
            "latest_order_status": latest_order.status,
            "running_subtotal": paise_to_rupees(total_subtotal_paise),
            "running_final_amount": paise_to_rupees(total_final_paise),
            "total_final_amount": paise_to_rupees(total_final_paise),
            "items": items_summary,
            "orders": [{
                "id": o.id,
                "order_number": o.order_number,
                "status": o.status,
                "items_count": len(o.items),
                "final_amount": paise_to_rupees(o.final_amount),
                "created_at": o.created_at.isoformat() if o.created_at else None
            } for o in orders]
        })
    finally:
        db.close()

@orders_bp.route('/<int:order_id>', methods=['GET'])
def get_single_order(order_id):
    """
    Get order details.
    Accessible to authenticated staff, customer with order_token, or customer with table_session_token.
    """
    staff_user = get_current_user()
    token = request.args.get('token')

    db = SessionLocal()
    try:
        authorized = False
        if staff_user:
            authorized = True
        elif token:
            payload = decode_order_token(token)
            if payload and payload.get('order_id') == order_id:
                authorized = True
            else:
                session_payload = decode_table_session_token(token)
                if session_payload:
                    o_auth = db.get(Order, order_id)
                    if o_auth and o_auth.session_id == session_payload.get('session_id'):
                        authorized = True

        if not authorized:
            return jsonify({"error": {"code": "FORBIDDEN", "message": "Access token required to view order."}}), 403

        o = db.get(Order, order_id)
        if not o:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Order not found."}}), 404

        # Compute estimated wait time
        max_prep = max([it.item.preparation_time_mins for it in o.items if it.item] or [15])
        # Add queue factor: active orders ahead
        queue_ahead = db.query(Order).filter(Order.status.in_(["RECEIVED", "ACCEPTED", "PREPARING"]), Order.id < o.id).count()
        wait_mins = max_prep + (queue_ahead * 2)

        # Phone is hidden for privacy unless staff
        phone = o.customer_phone if staff_user else None

        return jsonify({
            "id": o.id,
            "order_number": o.order_number,
            "table_id": o.table_id,
            "table_number": o.table.table_number if o.table else None,
            "section": o.table.section if o.table else "Takeaway",
            "session_id": o.session_id,
            "order_type": o.order_type,
            "customer_name": o.customer_name,
            "customer_phone": phone,
            "status": o.status,
            "special_instructions": o.special_instructions,
            "estimated_wait_minutes": wait_mins,
            "subtotal": paise_to_rupees(o.subtotal),
            "cgst_amount": paise_to_rupees(o.cgst_amount),
            "sgst_amount": paise_to_rupees(o.sgst_amount),
            "final_amount": paise_to_rupees(o.final_amount),
            "final_amount_paise": o.final_amount,
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "items": [{
                "id": it.id,
                "item_name": it.item_name,
                "price": paise_to_rupees(it.price),
                "quantity": it.quantity,
                "is_veg": it.is_veg,
                "customization": it.customization,
                "selected_addons": it.selected_addons,
                "total_price": paise_to_rupees(it.total_price),
                "item_status": it.item_status
            } for it in o.items]
        })
    finally:
        db.close()

@orders_bp.route('', methods=['POST'])
def place_order():
    """
    Place new customer or staff order.
    CRITICAL SECURITY & DATA SAFETY:
    - Verifies Table-Session Token (or Staff Auth)
    - Server loads exact prices from DB (ignores client prices)
    - Validates availability and stock
    - Associates order with active TableSession
    """
    data = request.json or {}
    cart_items = data.get('items', [])
    if not cart_items:
        return jsonify({"error": {"code": "EMPTY_CART", "message": "Cart is empty."}}), 400

    staff_user = get_current_user()
    order_type = data.get('order_type', 'DINE_IN')
    table_token = data.get('table_session_token') or request.headers.get('X-Table-Session-Token')
    table_number = data.get('table_number')

    db = SessionLocal()
    try:
        session = None
        table = None

        if order_type == "TAKEAWAY":
            # Takeaway order
            session = TableSession(
                restaurant_id=1,
                table_id=None,
                status="OPEN",
                opened_by="STAFF" if staff_user else "CUSTOMER",
                session_token=str(uuid.uuid4()),
                opened_at=now_utc()
            )
            db.add(session)
            db.commit()
            db.refresh(session)
        else:
            # Dine-in order
            if staff_user:
                # Staff taking order manually
                if not table_number:
                    return jsonify({"error": {"code": "BAD_REQUEST", "message": "Table number required."}}), 400
                fmt = str(table_number).zfill(2)
                table = db.query(RestaurantTable).filter(RestaurantTable.table_number == fmt, RestaurantTable.is_active == True).first()
                if not table:
                    return jsonify({"error": {"code": "INVALID_TABLE", "message": "Table not found."}}), 404
                session = get_or_create_active_session(db, table, opened_by="STAFF")
            else:
                # Customer placing order via QR
                if not table_token:
                    # Dev fallback if enabled
                    if table_number:
                        fmt = str(table_number).zfill(2)
                        table = db.query(RestaurantTable).filter(RestaurantTable.table_number == fmt).first()
                        if table:
                            session = get_or_create_active_session(db, table, opened_by="CUSTOMER")
                    if not session:
                        return jsonify({"error": {"code": "UNAUTHORIZED_SESSION", "message": "Valid Table QR session token required."}}), 401
                else:
                    payload = decode_table_session_token(table_token)
                    if not payload:
                        return jsonify({"error": {"code": "EXPIRED_SESSION", "message": "Table session token expired or invalid."}}), 401
                    session = db.get(TableSession, payload.get('session_id'))
                    if not session or session.status in ["BILLED", "CLOSED"]:
                        tbl_num = payload.get('table_number') or table_number
                        if tbl_num:
                            fmt = str(tbl_num).zfill(2)
                            tbl = db.query(RestaurantTable).filter(RestaurantTable.table_number == fmt, RestaurantTable.is_active == True).first()
                            if tbl:
                                session = get_or_create_active_session(db, tbl, opened_by="CUSTOMER")
                                table = tbl
                    if not session or session.status in ["BILLED", "CLOSED"]:
                        return jsonify({"error": {"code": "SESSION_CLOSED", "message": "Table session is closed."}}), 400
                    table = session.table

        # Race-safe sequential daily order number
        today_ymd = now_ist().strftime('%Y%m%d')
        seq_num = get_next_sequence(f"ORD_{today_ymd}", db=db)
        order_number = f"EKD-{today_ymd}-{seq_num:03d}"

        rest = db.query(Restaurant).first()
        cgst_rate = rest.cgst_rate if rest else 2.5
        sgst_rate = rest.sgst_rate if rest else 2.5

        target_table_id = table.id if table else (session.table_id if session else None)

        # Build order
        order_access_token = str(uuid.uuid4())
        order = Order(
            order_number=order_number,
            restaurant_id=rest.id if rest else 1,
            table_id=target_table_id,
            session_id=session.id,
            order_type=order_type,
            source="STAFF" if staff_user else "CUSTOMER_QR",
            order_token=order_access_token,
            customer_name=data.get('customer_name') or 'Guest',
            customer_phone=data.get('customer_phone'),
            status="RECEIVED",
            special_instructions=data.get('special_instructions'),
        )
        db.add(order)
        db.commit()
        db.refresh(order)

        # Server-side price calculation
        subtotal_paise = 0
        for item_in in cart_items:
            item_id = int(item_in.get('item_id'))
            menu_item = db.query(MenuItem).filter(MenuItem.id == item_id, MenuItem.is_active == True).first()
            if not menu_item or not menu_item.is_available:
                db.rollback()
                return jsonify({"error": {"code": "ITEM_UNAVAILABLE", "message": f"Dish '{menu_item.name if menu_item else item_id}' is sold out."}}), 400

            qty = max(1, min(20, int(item_in.get('quantity', 1))))
            item_price_paise = menu_item.price

            # Calculate verified add-ons
            selected_addons = []
            addon_total_paise = 0
            for addon_in in item_in.get('selected_addons', []):
                addon_id = addon_in.get('id')
                if addon_id:
                    db_addon = db.query(MenuItemAddon).filter(MenuItemAddon.id == addon_id, MenuItemAddon.is_active == True).first()
                    if db_addon:
                        selected_addons.append({"id": db_addon.id, "name": db_addon.name, "price_paise": db_addon.price})
                        addon_total_paise += db_addon.price

            item_line_total_paise = (item_price_paise + addon_total_paise) * qty
            subtotal_paise += item_line_total_paise

            order_item = OrderItem(
                order_id=order.id,
                item_id=menu_item.id,
                item_name=menu_item.name,
                price=item_price_paise,
                quantity=qty,
                is_veg=menu_item.is_veg,
                kitchen_station=menu_item.category.kitchen_station if menu_item.category else "CURRY_TANDOOR",
                customization=item_in.get('customization'),
                selected_addons=selected_addons,
                total_price=item_line_total_paise,
                item_status="PENDING"
            )
            db.add(order_item)

        # Compute GST on order totals
        gst_res = calculate_gst_breakdown(subtotal_paise, discount_paise=0, cgst_rate=cgst_rate, sgst_rate=sgst_rate)
        order.subtotal = gst_res["subtotal_paise"]
        order.cgst_amount = gst_res["cgst_paise"]
        order.sgst_amount = gst_res["sgst_paise"]
        order.final_amount = gst_res["final_payable_paise"]

        # Audit history
        db.add(OrderStatusHistory(
            order_id=order.id,
            user_id=staff_user.id if staff_user else None,
            status="RECEIVED",
            note="Order placed"
        ))
        db.commit()

        tbl_num_str = table.table_number if table else "Takeaway"
        tbl_name_str = table.name if table else "Takeaway"

        # Emit SocketIO real-time events to staff and kitchen
        order_payload = {
            "order_id": order.id,
            "order_number": order.order_number,
            "table_number": tbl_num_str,
            "table_name": tbl_name_str,
            "customer_name": order.customer_name,
            "order_type": order.order_type,
            "final_amount": paise_to_rupees(order.final_amount),
            "final_amount_paise": order.final_amount,
            "items_count": len(order.items),
            "special_instructions": order.special_instructions,
            "created_at": order.created_at.isoformat()
        }

        from app.sockets import emit_to_room
        emit_to_room("staff", "new_order", order_payload)
        emit_to_room("kitchen", "new_order", order_payload)
        if tbl_num_str != "Takeaway":
            emit_to_room(f"table_{tbl_num_str}", "table_order_update", {
                "order_id": order.id,
                "status": "RECEIVED"
            })

        # Generate customer order token
        signed_order_token = generate_order_token(order.id, session.id)

        return jsonify({
            "message": "Order placed successfully.",
            "order_id": order.id,
            "order_number": order.order_number,
            "order_token": signed_order_token,
            "final_amount": paise_to_rupees(order.final_amount)
        }), 201
    finally:
        db.close()

@orders_bp.route('/<int:order_id>/status', methods=['PUT'])
@require_auth
def update_order_status(order_id):
    """
    Staff / Kitchen updates order lifecycle status.
    Auto-deducts inventory recipes when moving to PREPARING.
    """
    data = request.json or {}
    new_status = data.get('status')
    valid_statuses = ['RECEIVED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED']

    if new_status not in valid_statuses:
        return jsonify({"error": {"code": "INVALID_STATUS", "message": f"Status must be one of: {valid_statuses}"}}), 400

    db = SessionLocal()
    try:
        order = db.get(Order, order_id)
        if not order:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Order not found."}}), 404

        order.status = new_status

        # If moving to PREPARING: auto-deduct recipe stock
        if new_status == "PREPARING":
            for it in order.items:
                if it.item and it.item.recipes:
                    for recipe in it.item.recipes:
                        inv_item = recipe.inventory_item
                        if inv_item:
                            deduct_qty = recipe.quantity_required * it.quantity
                            inv_item.current_stock = max(0.0, inv_item.current_stock - deduct_qty)
                            db.add(StockMovement(
                                inventory_item_id=inv_item.id,
                                movement_type="USAGE",
                                quantity_change=-deduct_qty,
                                resulting_stock=inv_item.current_stock,
                                note=f"Auto recipe usage for Order {order.order_number}",
                                user_id=g.current_user.id
                            ))

        # Update all items if marked READY or SERVED
        if new_status in ["READY", "SERVED"]:
            for it in order.items:
                if it.item_status != "CANCELLED":
                    it.item_status = new_status

        db.add(OrderStatusHistory(
            order_id=order.id,
            user_id=g.current_user.id,
            status=new_status,
            note=data.get('note', f"Status updated to {new_status}")
        ))
        db.commit()

        # Emit live socket updates
        from app.sockets import emit_to_room
        status_payload = {
            "order_id": order.id,
            "order_number": order.order_number,
            "table_number": order.table.table_number if order.table else "Takeaway",
            "status": new_status
        }
        emit_to_room("staff", "order_status_changed", status_payload)
        emit_to_room("kitchen", "order_status_changed", status_payload)
        if order.table:
            emit_to_room(f"table_{order.table.table_number}", "table_order_update", {
                "order_id": order.id,
                "status": new_status
            })

        return jsonify({"message": f"Order status updated to {new_status}."})
    finally:
        db.close()

@orders_bp.route('/<int:order_id>/items/<int:item_id>/status', methods=['PUT'])
@require_auth
def update_item_status(order_id, item_id):
    """Kitchen updates item-level status (PENDING, PREPARING, READY, SERVED)."""
    data = request.json or {}
    new_status = data.get('status')
    db = SessionLocal()
    try:
        it = db.query(OrderItem).filter(OrderItem.id == item_id, OrderItem.order_id == order_id).first()
        if not it:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Item not found."}}), 404
        it.item_status = new_status

        # If all non-cancelled items are READY, mark order READY
        order = it.order
        all_ready = all(i.item_status in ["READY", "SERVED", "CANCELLED"] for i in order.items)
        if all_ready and order.status not in ["READY", "SERVED", "COMPLETED"]:
            order.status = "READY"

        db.commit()

        from app.sockets import emit_to_room
        emit_to_room("kitchen", "order_item_updated", {
            "order_id": order_id,
            "item_id": item_id,
            "item_status": new_status,
            "order_status": order.status
        })
        emit_to_room("staff", "order_item_updated", {
            "order_id": order_id,
            "item_id": item_id,
            "item_status": new_status,
            "order_status": order.status
        })

        return jsonify({"message": "Item status updated.", "order_status": order.status})
    finally:
        db.close()

@orders_bp.route('/<int:order_id>/items/<int:item_id>/cancel', methods=['POST'])
@require_auth
def cancel_order_item(order_id, item_id):
    """Cancel individual order item with reason (manager required if already cooking)."""
    data = request.json or {}
    reason = str(data.get('reason', '')).strip()
    if not reason:
        return jsonify({"error": {"code": "BAD_REQUEST", "message": "Cancellation reason required."}}), 400

    db = SessionLocal()
    try:
        it = db.query(OrderItem).filter(OrderItem.id == item_id, OrderItem.order_id == order_id).first()
        if not it:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Item not found."}}), 404

        user_role = g.current_user.role.lower()
        if it.item_status in ["PREPARING", "READY"] and user_role not in ["manager", "owner"]:
            return jsonify({"error": {"code": "FORBIDDEN", "message": "Cancelling cooking/ready item requires Manager approval."}}), 403

        it.item_status = "CANCELLED"
        it.cancel_reason = reason

        # Recalculate order subtotal
        order = it.order
        active_items = [i for i in order.items if i.item_status != "CANCELLED"]
        new_subtotal = sum(i.total_price for i in active_items)

        rest = db.query(Restaurant).first()
        gst = calculate_gst_breakdown(new_subtotal, 0, rest.cgst_rate, rest.sgst_rate)
        order.subtotal = gst["subtotal_paise"]
        order.cgst_amount = gst["cgst_paise"]
        order.sgst_amount = gst["sgst_paise"]
        order.final_amount = gst["final_payable_paise"]

        if not active_items:
            order.status = "CANCELLED"
            order.cancel_reason = "All items cancelled"

        db.add(AuditLog(
            user_id=g.current_user.id,
            action="ORDER_ITEM_CANCELLED",
            entity_type="OrderItem",
            entity_id=str(it.id),
            new_value={"item_name": it.item_name, "reason": reason}
        ))
        db.commit()

        return jsonify({"message": "Item cancelled.", "new_order_total": paise_to_rupees(order.final_amount)})
    finally:
        db.close()

@orders_bp.route('/<int:order_id>/cancel', methods=['POST'])
def cancel_order(order_id):
    """
    Cancel entire order:
    1. By staff anytime before COMPLETED.
    2. By customer ONLY while order is still in 'RECEIVED' status.
    """
    data = request.json or {}
    reason = str(data.get('reason', '')).strip() or "Cancelled by user"
    token = data.get('order_token') or request.args.get('token')
    staff_user = get_current_user()

    db = SessionLocal()
    try:
        order = db.get(Order, order_id)
        if not order:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Order not found."}}), 404

        if staff_user:
            order.status = "CANCELLED"
            order.cancelled_by = f"Staff:{staff_user.username}"
            order.cancel_reason = reason
        elif token:
            payload = decode_order_token(token)
            if not payload or payload.get('order_id') != order_id:
                return jsonify({"error": {"code": "FORBIDDEN", "message": "Invalid order token."}}), 403
            if order.status != "RECEIVED":
                return jsonify({"error": {"code": "CANNOT_CANCEL", "message": "Cannot cancel order after kitchen has accepted it."}}), 400
            order.status = "CANCELLED"
            order.cancelled_by = "Customer"
            order.cancel_reason = reason
        else:
            return jsonify({"error": {"code": "UNAUTHORIZED", "message": "Authentication required."}}), 401

        for it in order.items:
            it.item_status = "CANCELLED"

        db.add(OrderStatusHistory(
            order_id=order.id,
            user_id=staff_user.id if staff_user else None,
            status="CANCELLED",
            note=f"Order cancelled: {reason}"
        ))
        db.commit()

        from app.sockets import emit_to_room
        emit_to_room("staff", "order_status_changed", {"order_id": order.id, "status": "CANCELLED"})
        emit_to_room("kitchen", "order_status_changed", {"order_id": order.id, "status": "CANCELLED"})

        return jsonify({"message": "Order cancelled successfully."})
    finally:
        db.close()


@orders_bp.route('/<int:order_id>/receipt/html', methods=['GET'])
def print_order_thermal_receipt_html(order_id):
    """Print-ready 80mm thermal receipt HTML for an order or its dining session."""
    from flask import Response
    from app.models import Invoice
    from app.services.invoice_service import generate_thermal_receipt_html
    from app.blueprints.billing import _get_invoice_orders

    db = SessionLocal()
    try:
        order = db.get(Order, order_id)
        if not order:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Order not found."}}), 404

        rest = db.query(Restaurant).first()

        # If order's session is already invoiced, use that invoice
        if order.session and order.session.invoice_id:
            inv = db.get(Invoice, order.session.invoice_id)
            if inv:
                orders = _get_invoice_orders(inv, db)
                html = generate_thermal_receipt_html(inv, orders, rest)
                return Response(html, mimetype='text/html; charset=utf-8')

        # Otherwise generate a provisional receipt for this order
        cgst_rate = rest.cgst_rate if rest else 2.5
        sgst_rate = rest.sgst_rate if rest else 2.5
        sc_rate = rest.service_charge_rate if (rest and rest.service_charge_enabled) else 0.0
        gst = calculate_gst_breakdown(order.subtotal, 0, cgst_rate, sgst_rate, sc_rate)

        class ProvisionalInvoice:
            invoice_number = f"BILL-{order.order_number}"
            created_at = order.created_at
            table = order.table
            customer_name = order.customer_name
            customer_gstin = None
            payment_method = "PENDING"
            payment_status = order.status
            hsn_sac = "9963"
            subtotal = gst["subtotal_paise"]
            discount_amount = 0
            cgst_rate = cgst_rate
            cgst_amount = gst["cgst_paise"]
            sgst_rate = sgst_rate
            sgst_amount = gst["sgst_paise"]
            service_charge_amount = gst["service_charge_paise"]
            round_off = gst["round_off_paise"]
            final_payable = gst["final_payable_paise"]

        html = generate_thermal_receipt_html(ProvisionalInvoice(), [order], rest)
        return Response(html, mimetype='text/html; charset=utf-8')
    finally:
        db.close()


@orders_bp.route('/<int:order_id>/pdf', methods=['GET'])
def download_order_pdf(order_id):
    """Download PDF for an order (A4 or thermal)."""
    from flask import Response
    from app.models import Invoice
    from app.services.invoice_service import generate_invoice_pdf
    from app.blueprints.billing import _get_invoice_orders

    fmt = request.args.get('format', 'A4')
    as_attachment = request.args.get('download', '0') == '1'
    db = SessionLocal()
    try:
        order = db.get(Order, order_id)
        if not order:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Order not found."}}), 404

        rest = db.query(Restaurant).first()

        # If order's session is already invoiced, use that invoice
        if order.session and order.session.invoice_id:
            inv = db.get(Invoice, order.session.invoice_id)
            if inv:
                orders = _get_invoice_orders(inv, db)
                pdf_bytes = generate_invoice_pdf(inv, orders, rest, format_type=fmt)
                safe_filename = inv.invoice_number.replace('/', '_') + f"_{fmt}.pdf"
                disp_type = 'attachment' if as_attachment else 'inline'
                return Response(
                    pdf_bytes,
                    mimetype='application/pdf',
                    headers={
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': f'{disp_type}; filename="{safe_filename}"',
                        'Content-Length': str(len(pdf_bytes))
                    }
                )

        # Provisional bill PDF
        cgst_rate = rest.cgst_rate if rest else 2.5
        sgst_rate = rest.sgst_rate if rest else 2.5
        sc_rate = rest.service_charge_rate if (rest and rest.service_charge_enabled) else 0.0
        gst = calculate_gst_breakdown(order.subtotal, 0, cgst_rate, sgst_rate, sc_rate)

        class ProvisionalInvoice:
            invoice_number = f"BILL-{order.order_number}"
            created_at = order.created_at
            table = order.table
            customer_name = order.customer_name
            customer_gstin = None
            payment_method = "PENDING"
            payment_status = order.status
            hsn_sac = "9963"
            subtotal = gst["subtotal_paise"]
            discount_amount = 0
            cgst_rate = cgst_rate
            cgst_amount = gst["cgst_paise"]
            sgst_rate = sgst_rate
            sgst_amount = gst["sgst_paise"]
            service_charge_amount = gst["service_charge_paise"]
            round_off = gst["round_off_paise"]
            final_payable = gst["final_payable_paise"]

        pdf_bytes = generate_invoice_pdf(ProvisionalInvoice(), [order], rest, format_type=fmt)
        safe_filename = f"BILL_{order.order_number}_{fmt}.pdf"
        disp_type = 'attachment' if as_attachment else 'inline'
        return Response(
            pdf_bytes,
            mimetype='application/pdf',
            headers={
                'Content-Type': 'application/pdf',
                'Content-Disposition': f'{disp_type}; filename="{safe_filename}"',
                'Content-Length': str(len(pdf_bytes))
            }
        )
    finally:
        db.close()

