from datetime import datetime, date, timedelta
from flask import Blueprint, request, jsonify, g, Response
from sqlalchemy import func, desc
from app.models import (
    SessionLocal, Order, OrderItem, Invoice, RestaurantTable, 
    Reservation, Restaurant, AuditLog
)
from app.auth import require_role
from app.money import paise_to_rupees, now_ist, ist_to_utc_range
from app.services.invoice_service import generate_sales_excel

reports_bp = Blueprint('reports', __name__, url_prefix='/api/reports')

@reports_bp.route('/summary', methods=['GET'])
@require_role("owner", "manager")
def get_reports_summary():
    """
    Analytics summary based on actual PAID invoices and Orders.
    """
    db = SessionLocal()
    try:
        ist_now = now_ist()
        today_utc_start, today_utc_end = ist_to_utc_range(ist_now.date())

        # Today's paid invoices
        today_invoices = db.query(Invoice).filter(
            Invoice.created_at >= today_utc_start,
            Invoice.created_at <= today_utc_end,
            Invoice.payment_status == 'PAID'
        ).all()

        today_revenue_paise = sum(inv.final_payable for inv in today_invoices)
        total_orders_today = len(today_invoices)
        avg_order_value = paise_to_rupees(round(today_revenue_paise / total_orders_today)) if total_orders_today > 0 else 0.0

        # Active tables count
        active_tables_count = db.query(RestaurantTable).filter(
            RestaurantTable.is_active == True
        ).count()

        pending_reservations = db.query(Reservation).filter(Reservation.status == 'PENDING').count()

        # Top 5 items today
        top_items_raw = db.query(
            OrderItem.item_name,
            func.sum(OrderItem.quantity).label('total_qty'),
            func.sum(OrderItem.total_price).label('total_rev_paise')
        ).join(Order).filter(
            Order.created_at >= today_utc_start,
            Order.created_at <= today_utc_end,
            Order.status != 'CANCELLED'
        ).group_by(OrderItem.item_name).order_by(desc('total_qty')).limit(5).all()

        top_items = [{
            "name": name,
            "quantity": int(qty or 0),
            "revenue": paise_to_rupees(rev or 0)
        } for name, qty, rev in top_items_raw]

        # Weekly sales (last 7 days)
        weekly_sales = []
        for i in range(6, -1, -1):
            day_date = ist_now.date() - timedelta(days=i)
            day_utc_start, day_utc_end = ist_to_utc_range(day_date)

            day_invoices = db.query(Invoice).filter(
                Invoice.created_at >= day_utc_start,
                Invoice.created_at <= day_utc_end,
                Invoice.payment_status == 'PAID'
            ).all()

            day_rev_paise = sum(inv.final_payable for inv in day_invoices)
            weekly_sales.append({
                "date": day_date.strftime('%d %b'),
                "orders": len(day_invoices),
                "revenue": paise_to_rupees(day_rev_paise)
            })

        return jsonify({
            "today_revenue": paise_to_rupees(today_revenue_paise),
            "total_orders_today": total_orders_today,
            "avg_order_value": avg_order_value,
            "active_tables_count": active_tables_count,
            "pending_reservations": pending_reservations,
            "top_items": top_items,
            "weekly_sales": weekly_sales
        })
    finally:
        db.close()

@reports_bp.route('/export.xlsx', methods=['GET'])
@require_role("owner", "manager")
def export_sales_excel_view():
    """Download multi-sheet Excel sales & GST report."""
    db = SessionLocal()
    try:
        invoices = db.query(Invoice).order_by(Invoice.created_at.desc()).all()
        orders = db.query(Order).order_by(Order.created_at.desc()).all()
        rest = db.query(Restaurant).first()

        excel_bytes = generate_sales_excel(orders, invoices, rest)
        return Response(
            excel_bytes,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={'Content-Disposition': 'attachment; filename=Hotel_Ekdant_Sales_Report.xlsx'}
        )
    finally:
        db.close()

@reports_bp.route('/audit-logs', methods=['GET'])
@require_role("owner")
def list_audit_logs():
    """Owner viewer for critical audit trail events."""
    limit = min(100, int(request.args.get('limit', 50)))
    db = SessionLocal()
    try:
        logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
        return jsonify([{
            "id": l.id,
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "old_value": l.old_value,
            "new_value": l.new_value,
            "created_at": l.created_at.strftime('%d-%b-%Y %I:%M %p') if l.created_at else ""
        } for l in logs])
    finally:
        db.close()
