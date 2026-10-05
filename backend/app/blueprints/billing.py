from flask import Blueprint, request, jsonify, g, Response
from app.models import (
    SessionLocal, Invoice, CreditNote, Order, RestaurantTable, 
    TableSession, Restaurant, AuditLog, InternalBillNote, PrintHistory, MenuItem
)
from app.auth import require_auth, require_role, decode_table_session_token
from app.money import (
    calculate_gst_breakdown, get_financial_year, rupees_to_paise, 
    paise_to_rupees, format_inr, now_utc
)
from app.services.counters import get_next_sequence
from app.services.invoice_service import (
    generate_invoice_pdf, generate_thermal_receipt_html,
    generate_internal_bill_html, generate_dual_receipt_html
)

billing_bp = Blueprint('billing', __name__, url_prefix='/api')

@billing_bp.route('/invoices', methods=['GET'])
@require_auth
def list_invoices():
    """Staff list of all generated invoices."""
    limit = min(100, int(request.args.get('limit', 50)))
    offset = int(request.args.get('offset', 0))

    db = SessionLocal()
    try:
        invoices = db.query(Invoice).order_by(Invoice.created_at.desc()).offset(offset).limit(limit).all()
        return jsonify([{
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "financial_year": inv.financial_year,
            "table_number": inv.table.table_number if inv.table else "Takeaway",
            "customer_name": inv.customer_name,
            "subtotal": paise_to_rupees(inv.subtotal),
            "discount_amount": paise_to_rupees(inv.discount_amount),
            "taxable_amount": paise_to_rupees(inv.taxable_amount),
            "cgst_amount": paise_to_rupees(inv.cgst_amount),
            "sgst_amount": paise_to_rupees(inv.sgst_amount),
            "round_off": paise_to_rupees(inv.round_off),
            "final_payable": paise_to_rupees(inv.final_payable),
            "final_payable_paise": inv.final_payable,
            "payment_method": inv.payment_method,
            "payment_status": inv.payment_status,
            "created_at": inv.created_at.isoformat() if inv.created_at else None
        } for inv in invoices])
    finally:
        db.close()

@billing_bp.route('/sessions/<int:session_id>/bill-summary', methods=['GET'])
def get_session_bill_summary(session_id):
    """
    Get consolidated bill summary for an active sitting/session.
    Can be called by staff or customer with table session token.
    Consolidates ALL non-cancelled orders of this sitting into ONE bill.
    """
    db = SessionLocal()
    try:
        session = db.get(TableSession, session_id)
        if not session:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Session not found."}}), 404

        active_orders = [o for o in session.orders if o.status != "CANCELLED"]
        total_subtotal_paise = sum(o.subtotal for o in active_orders)

        rest = db.query(Restaurant).first()
        cgst_rate = rest.cgst_rate if rest else 2.5
        sgst_rate = rest.sgst_rate if rest else 2.5
        sc_rate = rest.service_charge_rate if (rest and rest.service_charge_enabled) else 0.0

        gst = calculate_gst_breakdown(total_subtotal_paise, 0, cgst_rate, sgst_rate, sc_rate)

        # Collect items
        all_items = []
        for o in active_orders:
            for it in o.items:
                if it.item_status != "CANCELLED":
                    all_items.append({
                        "id": it.id,
                        "order_number": o.order_number,
                        "item_name": it.item_name,
                        "price": paise_to_rupees(it.price),
                        "quantity": it.quantity,
                        "is_veg": it.is_veg,
                        "total_price": paise_to_rupees(it.total_price),
                        "item_status": it.item_status
                    })

        return jsonify({
            "session_id": session.id,
            "table_number": session.table.table_number if session.table else "Takeaway",
            "orders_count": len(active_orders),
            "subtotal": paise_to_rupees(gst["subtotal_paise"]),
            "cgst_amount": paise_to_rupees(gst["cgst_paise"]),
            "sgst_amount": paise_to_rupees(gst["sgst_paise"]),
            "service_charge_amount": paise_to_rupees(gst["service_charge_paise"]),
            "round_off": paise_to_rupees(gst["round_off_paise"]),
            "final_payable": paise_to_rupees(gst["final_payable_paise"]),
            "items": all_items
        })
    finally:
        db.close()

@billing_bp.route('/invoices', methods=['POST'])
@require_auth
def generate_invoice():
    """
    Generate unified GST Invoice for a table sitting (TableSession) or specific order.
    Consolidates ALL non-cancelled orders of the session into ONE invoice.
    Applies discount with cashier threshold check (default ₹100 max for cashier without manager).
    Sequential financial year numbering: EK/26-27/000123.
    """
    data = request.json or {}
    session_id = data.get('session_id')
    order_id = data.get('order_id')
    discount_val = data.get('discount_amount', 0)
    discount_paise = rupees_to_paise(discount_val)
    payment_method = data.get('payment_method', 'CASH')
    payment_status = data.get('payment_status', 'PAID')
    customer_gstin = data.get('customer_gstin')

    db = SessionLocal()
    try:
        session = None
        if session_id:
            session = db.get(TableSession, session_id)
        elif order_id:
            order = db.get(Order, order_id)
            if order:
                session = order.session

        if not session:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Dining session not found."}}), 404

        # If already billed, return existing invoice
        if session.invoice_id:
            existing = db.get(Invoice, session.invoice_id)
            if existing:
                return jsonify({
                    "message": "Session already invoiced.",
                    "invoice_id": existing.id,
                    "invoice_number": existing.invoice_number,
                    "final_payable": paise_to_rupees(existing.final_payable)
                })

        active_orders = [o for o in session.orders if o.status != "CANCELLED"]
        if not active_orders:
            return jsonify({"error": {"code": "NO_ORDERS", "message": "No active orders found in session to bill."}}), 400

        total_subtotal_paise = sum(o.subtotal for o in active_orders)

        rest = db.query(Restaurant).first()
        cgst_rate = rest.cgst_rate if rest else 2.5
        sgst_rate = rest.sgst_rate if rest else 2.5
        sc_rate = rest.service_charge_rate if (rest and rest.service_charge_enabled) else 0.0
        cashier_limit = rest.discount_limit_cashier if rest else 10000

        # Cashier discount permission check
        user_role = g.current_user.role.lower()
        if user_role == "cashier" and discount_paise > cashier_limit:
            return jsonify({
                "error": {
                    "code": "DISCOUNT_LIMIT_EXCEEDED",
                    "message": f"Cashiers can only authorize discounts up to {format_inr(cashier_limit)}. Manager approval required."
                }
            }), 403

        # Compute GST breakdown
        gst = calculate_gst_breakdown(
            subtotal_paise=total_subtotal_paise,
            discount_paise=discount_paise,
            cgst_rate=cgst_rate,
            sgst_rate=sgst_rate,
            service_charge_rate=sc_rate
        )

        # Sequential FY invoice number: EK/26-27/000123
        fy_str = get_financial_year()
        prefix = rest.invoice_prefix if rest else "EK"
        seq_num = get_next_sequence(f"INV_{fy_str}", db=db)
        invoice_number = f"{prefix}/{fy_str}/{seq_num:06d}"

        first_order = active_orders[0]
        invoice = Invoice(
            invoice_number=invoice_number,
            financial_year=fy_str,
            restaurant_id=rest.id if rest else 1,
            session_id=session.id,
            table_id=session.table_id,
            customer_name=data.get('customer_name') or first_order.customer_name or 'Guest',
            customer_phone=data.get('customer_phone') or first_order.customer_phone,
            customer_gstin=customer_gstin,
            hsn_sac="9963",
            subtotal=gst["subtotal_paise"],
            discount_amount=gst["discount_paise"],
            taxable_amount=gst["taxable_paise"],
            cgst_rate=cgst_rate,
            cgst_amount=gst["cgst_paise"],
            sgst_rate=sgst_rate,
            sgst_amount=gst["sgst_paise"],
            service_charge_amount=gst["service_charge_paise"],
            round_off=gst["round_off_paise"],
            final_payable=gst["final_payable_paise"],
            payment_method=payment_method,
            payment_status=payment_status,
            created_at=now_utc()
        )
        db.add(invoice)
        db.commit()
        db.refresh(invoice)

        # Link session and mark closed if paid
        session.invoice_id = invoice.id
        if payment_status == "PAID":
            session.status = "CLOSED"
            session.closed_at = now_utc()
            for o in active_orders:
                o.status = "COMPLETED"
        else:
            session.status = "BILLED"

        # Audit
        db.add(AuditLog(
            user_id=g.current_user.id,
            action="INVOICE_GENERATED",
            entity_type="Invoice",
            entity_id=str(invoice.id),
            new_value={"invoice_number": invoice_number, "final_payable_paise": invoice.final_payable}
        ))
        db.commit()

        # Emit live bill event
        from app.sockets import emit_to_room
        emit_to_room("staff", "bill_generated", {
            "invoice_id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "table_number": session.table.table_number if session.table else "Takeaway",
            "final_payable": paise_to_rupees(invoice.final_payable)
        })

        return jsonify({
            "message": "Invoice generated successfully.",
            "invoice_id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "final_payable": paise_to_rupees(invoice.final_payable)
        }), 201
    finally:
        db.close()

@billing_bp.route('/invoices/<int:invoice_id>/cancel', methods=['POST'])
@require_role("owner", "manager")
def cancel_invoice_and_issue_credit_note(invoice_id):
    """
    Cancel paid invoice by issuing a Credit Note (required for GST compliance).
    Never deletes the original invoice.
    """
    data = request.json or {}
    reason = str(data.get('reason', '')).strip()
    if not reason:
        return jsonify({"error": {"code": "BAD_REQUEST", "message": "Cancellation reason required."}}), 400

    db = SessionLocal()
    try:
        inv = db.get(Invoice, invoice_id)
        if not inv:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Invoice not found."}}), 404

        if inv.payment_status == "CANCELLED":
            return jsonify({"error": {"code": "ALREADY_CANCELLED", "message": "Invoice is already cancelled."}}), 400

        fy_str = inv.financial_year
        cn_seq = get_next_sequence(f"CN_{fy_str}", db=db)
        cn_number = f"CN/{fy_str}/{cn_seq:06d}"

        credit_note = CreditNote(
            credit_note_number=cn_number,
            invoice_id=inv.id,
            financial_year=fy_str,
            amount=inv.final_payable,
            reason=reason,
            created_by=g.current_user.id,
            created_at=now_utc()
        )
        db.add(credit_note)
        inv.payment_status = "CANCELLED"

        # Reopen or update session
        if inv.session_id:
            sess = db.get(TableSession, inv.session_id)
            if sess:
                sess.status = "OPEN"
                sess.invoice_id = None

        db.add(AuditLog(
            user_id=g.current_user.id,
            action="CREDIT_NOTE_ISSUED",
            entity_type="CreditNote",
            entity_id=cn_number,
            new_value={"invoice_number": inv.invoice_number, "reason": reason}
        ))
        db.commit()

        return jsonify({
            "message": "Invoice cancelled and Credit Note issued.",
            "credit_note_number": cn_number
        })
    finally:
        db.close()

def _get_invoice_orders(inv, db):
    """Return all non-cancelled orders for an invoice, resolving via session or table."""
    if inv.session_id:
        session = db.get(TableSession, inv.session_id)
        if session and session.orders:
            active = [o for o in session.orders if o.status != "CANCELLED"]
            if active:
                return active
        # Fallback direct query on Order table
        sess_orders = db.query(Order).filter(Order.session_id == inv.session_id, Order.status != "CANCELLED").all()
        if sess_orders:
            return sess_orders
    if inv.table_id:
        table = db.get(RestaurantTable, inv.table_id)
        if table and table.orders:
            return [o for o in table.orders if o.status != "CANCELLED"]
    return []


# --- PRINTING ENDPOINTS ---

@billing_bp.route('/invoices/<int:invoice_id>/pdf', methods=['GET'])
def download_invoice_pdf_view(invoice_id):
    """Download ReportLab PDF invoice (A4 or thermal)."""
    fmt = request.args.get('format', 'A4')
    as_attachment = request.args.get('download', '0') == '1'
    db = SessionLocal()
    try:
        inv = db.get(Invoice, invoice_id)
        if not inv:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Invoice not found."}}), 404

        orders = _get_invoice_orders(inv, db)
        rest = db.query(Restaurant).first()
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
    finally:
        db.close()

@billing_bp.route('/invoices/<int:invoice_id>/receipt/html', methods=['GET'])
def print_thermal_receipt_html_view(invoice_id):
    """Print-ready 80mm thermal receipt HTML with UPI QR code."""
    db = SessionLocal()
    try:
        inv = db.get(Invoice, invoice_id)
        if not inv:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Invoice not found."}}), 404

        orders = _get_invoice_orders(inv, db)
        rest = db.query(Restaurant).first()
        html = generate_thermal_receipt_html(inv, orders, rest)
        return Response(html, mimetype='text/html; charset=utf-8')
    finally:
        db.close()

@billing_bp.route('/orders/<int:order_id>/kot/html', methods=['GET'])
def print_kot_html_view(order_id):
    """Print 80mm Kitchen Order Ticket (KOT) optionally filtered by station."""
    station = request.args.get('station', 'ALL')
    db = SessionLocal()
    try:
        order = db.get(Order, order_id)
        if not order:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Order not found."}}), 404

        from app.services.invoice_service import generate_kot_html
        html = generate_kot_html(order, kitchen_station=station)
        return Response(html, mimetype='text/html; charset=utf-8')
    finally:
        db.close()


# ===========================================================================
# DUAL BILLING — NEW ENDPOINTS
# ===========================================================================


@billing_bp.route('/invoices/<int:invoice_id>/internal', methods=['GET'])
@require_role("owner", "manager")
def get_internal_bill_data(invoice_id):
    """Returns internal financial breakdown for an invoice. Owner/Manager only."""
    db = SessionLocal()
    try:
        inv = db.get(Invoice, invoice_id)
        if not inv:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Invoice not found."}}), 404

        orders = _get_invoice_orders(inv, db)

        items_breakdown = []
        total_selling_paise = 0
        total_cost_paise = 0

        for o in orders:
            for it in o.items:
                if it.item_status != "CANCELLED":
                    selling = it.total_price
                    unit_cost = 0
                    if it.item and it.item.preparation_cost:
                        unit_cost = it.item.preparation_cost
                    cost_total = unit_cost * it.quantity
                    profit = selling - cost_total
                    total_selling_paise += selling
                    total_cost_paise += cost_total
                    items_breakdown.append({
                        "item_name": it.item_name,
                        "quantity": it.quantity,
                        "selling_price_unit": paise_to_rupees(it.price),
                        "selling_total": paise_to_rupees(selling),
                        "cost_price_unit": paise_to_rupees(unit_cost),
                        "cost_total": paise_to_rupees(cost_total),
                        "gross_profit": paise_to_rupees(profit),
                        "margin_pct": round((profit / selling * 100) if selling > 0 else 0.0, 1),
                    })

        gross_profit = total_selling_paise - total_cost_paise
        profit_margin_pct = round((gross_profit / total_selling_paise * 100) if total_selling_paise > 0 else 0.0, 1)

        notes = db.query(InternalBillNote).filter(InternalBillNote.invoice_id == invoice_id).all()
        net_adjustment_paise = sum(n.amount_paise for n in notes)
        net_profit = gross_profit + net_adjustment_paise

        prints = db.query(PrintHistory).filter(PrintHistory.invoice_id == invoice_id).order_by(PrintHistory.created_at).all()

        return jsonify({
            "invoice_number": inv.invoice_number,
            "table_number": inv.table.table_number if inv.table else "Takeaway",
            "customer_name": inv.customer_name,
            "date": inv.created_at.isoformat() if inv.created_at else None,
            "payment_method": inv.payment_method,
            "payment_status": inv.payment_status,
            "subtotal": paise_to_rupees(inv.subtotal),
            "discount_amount": paise_to_rupees(inv.discount_amount),
            "cgst_amount": paise_to_rupees(inv.cgst_amount),
            "sgst_amount": paise_to_rupees(inv.sgst_amount),
            "final_payable": paise_to_rupees(inv.final_payable),
            "total_food_cost": paise_to_rupees(total_cost_paise),
            "gross_profit": paise_to_rupees(gross_profit),
            "profit_margin_pct": profit_margin_pct,
            "net_adjustments": paise_to_rupees(net_adjustment_paise),
            "net_profit": paise_to_rupees(net_profit),
            "items": items_breakdown,
            "adjustments": [
                {
                    "id": n.id,
                    "note_type": n.note_type,
                    "amount": paise_to_rupees(n.amount_paise),
                    "reason": n.reason,
                    "created_by": n.creator.full_name if n.creator else "Unknown",
                    "created_at": n.created_at.isoformat() if n.created_at else None,
                }
                for n in notes
            ],
            "print_history": [
                {
                    "print_type": p.print_type,
                    "printed_by": p.printer.full_name if p.printer else "Unknown",
                    "created_at": p.created_at.isoformat() if p.created_at else None,
                }
                for p in prints
            ],
        })
    finally:
        db.close()


@billing_bp.route('/invoices/<int:invoice_id>/adjustment', methods=['POST'])
@require_role("owner", "manager")
def add_internal_adjustment(invoice_id):
    """Record an internal financial adjustment/remark. Append-only; original transaction unchanged."""
    data = request.json or {}
    note_type = str(data.get("note_type", "REMARK")).upper().strip()
    amount_rupees = float(data.get("amount", 0))
    reason = str(data.get("reason", "")).strip()

    if not reason:
        return jsonify({"error": {"code": "BAD_REQUEST", "message": "Reason is required."}}), 400
    if note_type not in ("REMARK", "ADJUSTMENT", "REFUND", "CORRECTION"):
        note_type = "REMARK"

    amount_paise = rupees_to_paise(amount_rupees)

    db = SessionLocal()
    try:
        inv = db.get(Invoice, invoice_id)
        if not inv:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Invoice not found."}}), 404

        existing_notes = db.query(InternalBillNote).filter(InternalBillNote.invoice_id == invoice_id).all()
        prev_total = sum(n.amount_paise for n in existing_notes)

        note = InternalBillNote(
            invoice_id=invoice_id,
            note_type=note_type,
            amount_paise=amount_paise,
            reason=reason,
            previous_value={"prev_total_adjustments_paise": prev_total},
            created_by=g.current_user.id,
            created_at=now_utc()
        )
        db.add(note)
        db.add(AuditLog(
            user_id=g.current_user.id,
            action="INTERNAL_ADJUSTMENT",
            entity_type="Invoice",
            entity_id=str(invoice_id),
            old_value={"total_adjustments_paise": prev_total},
            new_value={"note_type": note_type, "amount_paise": amount_paise, "reason": reason},
            ip_address=request.remote_addr
        ))
        db.commit()
        db.refresh(note)

        return jsonify({
            "message": "Internal adjustment recorded.",
            "id": note.id,
            "note_type": note.note_type,
            "amount": paise_to_rupees(note.amount_paise),
            "reason": note.reason
        }), 201
    finally:
        db.close()


@billing_bp.route('/invoices/<int:invoice_id>/internal-receipt/html', methods=['GET'])
@require_role("owner", "manager")
def print_internal_receipt_html(invoice_id):
    """Internal management thermal receipt HTML (owner/manager only)."""
    db = SessionLocal()
    try:
        inv = db.get(Invoice, invoice_id)
        if not inv:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Invoice not found."}}), 404

        orders = _get_invoice_orders(inv, db)
        rest = db.query(Restaurant).first()
        notes = db.query(InternalBillNote).filter(InternalBillNote.invoice_id == invoice_id).all()

        db.add(PrintHistory(
            invoice_id=invoice_id,
            print_type="INTERNAL_THERMAL",
            printed_by=g.current_user.id,
            ip_address=request.remote_addr,
            created_at=now_utc()
        ))
        db.commit()

        html = generate_internal_bill_html(inv, orders, rest, internal_notes=notes)
        return Response(html, mimetype='text/html; charset=utf-8')
    finally:
        db.close()


@billing_bp.route('/invoices/<int:invoice_id>/both-receipts/html', methods=['GET'])
@require_role("owner", "manager")
def print_both_receipts_html(invoice_id):
    """Both customer + internal receipts in one print-ready HTML page (owner/manager only)."""
    db = SessionLocal()
    try:
        inv = db.get(Invoice, invoice_id)
        if not inv:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Invoice not found."}}), 404

        orders = _get_invoice_orders(inv, db)
        rest = db.query(Restaurant).first()
        notes = db.query(InternalBillNote).filter(InternalBillNote.invoice_id == invoice_id).all()

        db.add(PrintHistory(
            invoice_id=invoice_id,
            print_type="BOTH",
            printed_by=g.current_user.id,
            ip_address=request.remote_addr,
            created_at=now_utc()
        ))
        db.commit()

        html = generate_dual_receipt_html(inv, orders, rest, internal_notes=notes)
        return Response(html, mimetype='text/html; charset=utf-8')
    finally:
        db.close()


@billing_bp.route('/reports/internal-financial', methods=['GET'])
@require_role("owner", "manager")
def internal_financial_report():
    """Internal P&L dashboard: revenue, food cost, gross profit, tax, discounts by period."""
    from datetime import datetime, timedelta

    db = SessionLocal()
    try:
        period = request.args.get('period', 'month')
        date_from_str = request.args.get('from')
        date_to_str = request.args.get('to')

        now = now_utc()
        if date_from_str:
            try:
                date_from = datetime.fromisoformat(date_from_str)
            except ValueError:
                date_from = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            if period == 'today':
                date_from = now.replace(hour=0, minute=0, second=0, microsecond=0)
            elif period == 'week':
                date_from = now - timedelta(days=7)
            elif period == 'year':
                date_from = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            else:
                date_from = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        date_to = datetime.fromisoformat(date_to_str) if date_to_str else now

        invoices = db.query(Invoice).filter(
            Invoice.created_at >= date_from,
            Invoice.created_at <= date_to,
            Invoice.payment_status != "CANCELLED"
        ).order_by(Invoice.created_at.asc()).all()

        total_revenue_paise = sum(inv.final_payable for inv in invoices)
        total_discount_paise = sum(inv.discount_amount for inv in invoices)
        total_cgst_paise = sum(inv.cgst_amount for inv in invoices)
        total_sgst_paise = sum(inv.sgst_amount for inv in invoices)

        total_cost_paise = 0
        total_selling_paise = 0
        for inv in invoices:
            for o in _get_invoice_orders(inv, db):
                for it in o.items:
                    if it.item_status != "CANCELLED":
                        selling = it.total_price
                        unit_cost = it.item.preparation_cost if (it.item and it.item.preparation_cost) else 0
                        total_selling_paise += selling
                        total_cost_paise += unit_cost * it.quantity

        gross_profit = total_selling_paise - total_cost_paise
        profit_margin_pct = round((gross_profit / total_selling_paise * 100) if total_selling_paise > 0 else 0.0, 1)

        inv_ids = [inv.id for inv in invoices]
        adj_total_paise = 0
        if inv_ids:
            notes = db.query(InternalBillNote).filter(InternalBillNote.invoice_id.in_(inv_ids)).all()
            adj_total_paise = sum(n.amount_paise for n in notes)

        payment_breakdown = {}
        for inv in invoices:
            pm = inv.payment_method
            payment_breakdown[pm] = payment_breakdown.get(pm, 0) + paise_to_rupees(inv.final_payable)

        return jsonify({
            "period": period,
            "from": date_from.isoformat(),
            "to": date_to.isoformat(),
            "invoices_count": len(invoices),
            "total_revenue": paise_to_rupees(total_revenue_paise),
            "total_discount_given": paise_to_rupees(total_discount_paise),
            "total_cgst": paise_to_rupees(total_cgst_paise),
            "total_sgst": paise_to_rupees(total_sgst_paise),
            "total_tax": paise_to_rupees(total_cgst_paise + total_sgst_paise),
            "total_food_cost": paise_to_rupees(total_cost_paise),
            "gross_profit": paise_to_rupees(gross_profit),
            "profit_margin_pct": profit_margin_pct,
            "net_adjustments": paise_to_rupees(adj_total_paise),
            "net_profit": paise_to_rupees(gross_profit + adj_total_paise),
            "payment_breakdown": payment_breakdown,
        })
    finally:
        db.close()
