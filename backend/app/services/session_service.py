import uuid
from datetime import datetime, timedelta
from app.models import RestaurantTable, TableSession, Reservation
from app.money import now_utc, now_ist
from app.auth import generate_table_session_token

def get_or_create_active_session(db, table: RestaurantTable, opened_by: str = "CUSTOMER") -> TableSession:
    """
    Get active open session for table, or create a new one.
    """
    session = db.query(TableSession).filter(
        TableSession.table_id == table.id,
        TableSession.status.in_(["OPEN", "BILL_REQUESTED"])
    ).first()

    if not session:
        session_token = str(uuid.uuid4())
        session = TableSession(
            restaurant_id=table.restaurant_id,
            table_id=table.id,
            status="OPEN",
            opened_by=opened_by,
            session_token=session_token,
            opened_at=now_utc()
        )
        db.add(session)
        db.flush()

    return session

def compute_table_effective_status(db, table: RestaurantTable) -> str:
    """
    Derive table status dynamically from:
    1. manual_status_override (NEEDS_ATTENTION / DISABLED)
    2. Active TableSession status
    3. Active orders within session
    4. Upcoming confirmed reservations
    """
    if table.manual_status_override:
        return table.manual_status_override

    active_session = db.query(TableSession).filter(
        TableSession.table_id == table.id,
        TableSession.status.in_(["OPEN", "BILL_REQUESTED"])
    ).first()

    if active_session:
        # Check order statuses in session
        orders = active_session.orders
        if not orders:
            return "ORDERING"
        
        statuses = [o.status for o in orders if o.status != "CANCELLED"]
        if any(s in ["RECEIVED", "ACCEPTED"] for s in statuses):
            return "ORDERING"
        if any(s == "PREPARING" for s in statuses):
            return "PREPARING"
        if any(s == "READY" for s in statuses):
            return "PREPARING"
        if any(s == "SERVED" for s in statuses):
            return "OCCUPIED"
        return "OCCUPIED"

    # Check if table is reserved within next 30 mins
    ist_now = now_ist().replace(tzinfo=None)
    res_window = ist_now + timedelta(minutes=30)
    has_reservation = db.query(Reservation).filter(
        Reservation.assigned_table_id == table.id,
        Reservation.status == "CONFIRMED",
        Reservation.reserved_for >= ist_now - timedelta(minutes=20),
        Reservation.reserved_for <= res_window
    ).first()

    if has_reservation:
        return "RESERVED"

    return "AVAILABLE"
