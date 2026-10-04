import os
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, BigInteger, String, Text, Float, Boolean, 
    DateTime, ForeignKey, JSON, Index, UniqueConstraint
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, scoped_session
from app.config import Config
from app.money import now_utc

engine = create_engine(
    Config.DATABASE_URL, 
    connect_args={"check_same_thread": False} if Config.DATABASE_URL.startswith("sqlite") else {},
    pool_pre_ping=True
)
SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))
Base = declarative_base()

class Restaurant(Base):
    __tablename__ = "restaurants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), default="Hotel Ekdant Family Restaurant")
    tagline = Column(String(200), default="AC & Non-AC Family Dining • Authentic Hospitality")
    address = Column(Text, default="Near Shree Ganesh Mandir, Main Road, Maharashtra - 416001")
    phone = Column(String(20), default="+91 98234 56789")
    whatsapp = Column(String(20), default="+91 98234 56789")
    gstin = Column(String(25), default="27AABCE1234F1Z5")
    fssai = Column(String(30), default="11521034000189")
    opening_hours = Column(String(100), default="11:00 AM - 11:30 PM (All 7 Days)")
    cgst_rate = Column(Float, default=2.5)
    sgst_rate = Column(Float, default=2.5)
    service_charge_rate = Column(Float, default=0.0)
    service_charge_enabled = Column(Boolean, default=False)
    discount_limit_cashier = Column(Integer, default=10000)  # in paise (₹100)
    invoice_prefix = Column(String(10), default="EK")
    upi_id = Column(String(50), default="ekdant@upi")
    sound_alerts_enabled = Column(Boolean, default=True)
    takeaway_enabled = Column(Boolean, default=True)
    business_day_cutoff_hour = Column(Integer, default=4)  # 4 AM business day turnover
    created_at = Column(DateTime, default=now_utc)

    tables = relationship("RestaurantTable", back_populates="restaurant")
    categories = relationship("MenuCategory", back_populates="restaurant")
    items = relationship("MenuItem", back_populates="restaurant")
    users = relationship("User", back_populates="restaurant")
    reservations = relationship("Reservation", back_populates="restaurant")
    orders = relationship("Order", back_populates="restaurant")
    reviews = relationship("Review", back_populates="restaurant")
    sessions = relationship("TableSession", back_populates="restaurant")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), default=1)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), default="waiter")  # owner, manager, cashier, waiter, chef
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)
    must_change_password = Column(Boolean, default=False)
    created_at = Column(DateTime, default=now_utc)

    restaurant = relationship("Restaurant", back_populates="users")

class RestaurantTable(Base):
    __tablename__ = "restaurant_tables"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), default=1)
    table_number = Column(String(10), unique=True, nullable=False)  # "01" - "11"
    name = Column(String(50), nullable=False)
    section = Column(String(20), default="AC")  # "AC" or "NON_AC"
    capacity = Column(Integer, default=4)
    manual_status_override = Column(String(30), nullable=True)  # NEEDS_ATTENTION, DISABLED, or None
    qr_code_token = Column(String(100), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=now_utc)

    restaurant = relationship("Restaurant", back_populates="tables")
    orders = relationship("Order", back_populates="table")
    service_requests = relationship("ServiceRequest", back_populates="table")
    sessions = relationship("TableSession", back_populates="table")
    reservations = relationship("Reservation", back_populates="assigned_table")

class TableSession(Base):
    __tablename__ = "table_sessions"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), default=1)
    table_id = Column(Integer, ForeignKey("restaurant_tables.id"), nullable=True)  # Null for takeaway
    status = Column(String(30), default="OPEN")  # OPEN, BILL_REQUESTED, BILLED, CLOSED
    opened_by = Column(String(20), default="CUSTOMER")  # CUSTOMER, STAFF
    session_token = Column(String(120), unique=True, index=True, nullable=False)
    opened_at = Column(DateTime, default=now_utc)
    closed_at = Column(DateTime, nullable=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", use_alter=True), nullable=True)

    restaurant = relationship("Restaurant", back_populates="sessions")
    table = relationship("RestaurantTable", back_populates="sessions")
    orders = relationship("Order", back_populates="session", foreign_keys="[Order.session_id]")
    invoice = relationship("Invoice", foreign_keys=[invoice_id], post_update=True)

class MenuCategory(Base):
    __tablename__ = "menu_categories"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), default=1)
    name = Column(String(80), nullable=False)
    description = Column(Text, nullable=True)
    image_url = Column(String(255), nullable=True)
    kitchen_station = Column(String(40), default="CURRY_TANDOOR")  # CURRY_TANDOOR, RICE_BIRYANI, BEVERAGE, DESSERT
    is_veg_category = Column(Boolean, default=False)
    is_non_veg_category = Column(Boolean, default=False)
    display_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    restaurant = relationship("Restaurant", back_populates="categories")
    items = relationship("MenuItem", back_populates="category")

class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), default=1)
    category_id = Column(Integer, ForeignKey("menu_categories.id"), nullable=False)
    name = Column(String(120), nullable=False)
    marathi_name = Column(String(120), nullable=True)
    description = Column(Text, nullable=True)
    price = Column(Integer, nullable=False)  # Price in PAISE
    is_veg = Column(Boolean, default=True)
    food_type = Column(String(30), default="veg")  # veg, chicken, mutton, fish, egg
    spice_level = Column(String(20), default="Medium")
    is_available = Column(Boolean, default=True)
    is_special = Column(Boolean, default=False)
    is_featured = Column(Boolean, default=False)
    image_url = Column(String(255), nullable=True)
    preparation_time_mins = Column(Integer, default=15)
    preparation_cost = Column(Integer, default=0)  # Estimated cost/COGS per unit in PAISE (for internal reporting)
    is_active = Column(Boolean, default=True)  # Soft delete
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=now_utc)

    restaurant = relationship("Restaurant", back_populates="items")
    category = relationship("MenuCategory", back_populates="items")
    addons = relationship("MenuItemAddon", back_populates="item", cascade="all, delete-orphan")
    recipes = relationship("Recipe", back_populates="menu_item", cascade="all, delete-orphan")

class MenuItemAddon(Base):
    __tablename__ = "menu_item_addons"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=False)
    name = Column(String(80), nullable=False)
    price = Column(Integer, default=0)  # Addon price in PAISE
    is_active = Column(Boolean, default=True)

    item = relationship("MenuItem", back_populates="addons")

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(30), unique=True, index=True, nullable=False)  # EKD-YYYYMMDD-001
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), default=1)
    table_id = Column(Integer, ForeignKey("restaurant_tables.id"), nullable=True)  # Nullable for takeaway
    session_id = Column(Integer, ForeignKey("table_sessions.id"), nullable=False)
    order_type = Column(String(20), default="DINE_IN")  # DINE_IN, TAKEAWAY
    source = Column(String(20), default="CUSTOMER_QR")  # CUSTOMER_QR, STAFF
    order_token = Column(String(120), unique=True, index=True, nullable=False)
    customer_name = Column(String(80), default="Guest")
    customer_phone = Column(String(20), nullable=True)
    status = Column(String(30), default="RECEIVED")  # RECEIVED, ACCEPTED, PREPARING, READY, SERVED, COMPLETED, CANCELLED
    cancelled_by = Column(String(50), nullable=True)
    cancel_reason = Column(Text, nullable=True)
    special_instructions = Column(Text, nullable=True)
    estimated_ready_at = Column(DateTime, nullable=True)
    subtotal = Column(Integer, default=0)  # PAISE
    cgst_amount = Column(Integer, default=0)  # PAISE
    sgst_amount = Column(Integer, default=0)  # PAISE
    final_amount = Column(Integer, default=0)  # PAISE
    created_at = Column(DateTime, default=now_utc)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc)

    restaurant = relationship("Restaurant", back_populates="orders")
    table = relationship("RestaurantTable", back_populates="orders")
    session = relationship("TableSession", back_populates="orders", foreign_keys=[session_id])
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    status_history = relationship("OrderStatusHistory", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=False)
    item_name = Column(String(120), nullable=False)
    price = Column(Integer, nullable=False)  # Unit price in PAISE
    quantity = Column(Integer, default=1)
    is_veg = Column(Boolean, default=True)
    kitchen_station = Column(String(40), default="CURRY_TANDOOR")
    customization = Column(Text, nullable=True)
    selected_addons = Column(JSON, nullable=True)  # [{"name": str, "price": int}]
    total_price = Column(Integer, nullable=False)  # Total in PAISE
    item_status = Column(String(30), default="PENDING")  # PENDING, PREPARING, READY, SERVED, CANCELLED
    cancel_reason = Column(String(200), nullable=True)

    order = relationship("Order", back_populates="items")
    item = relationship("MenuItem")

class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(30), nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=now_utc)

    order = relationship("Order", back_populates="status_history")

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(40), unique=True, index=True, nullable=False)  # EK/26-27/000123
    financial_year = Column(String(10), nullable=False)  # "26-27"
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), default=1)
    session_id = Column(Integer, ForeignKey("table_sessions.id"), nullable=True)
    table_id = Column(Integer, ForeignKey("restaurant_tables.id"), nullable=True)
    customer_name = Column(String(80), default="Guest")
    customer_phone = Column(String(20), nullable=True)
    customer_gstin = Column(String(25), nullable=True)
    hsn_sac = Column(String(10), default="9963")
    subtotal = Column(Integer, default=0)  # PAISE
    discount_amount = Column(Integer, default=0)  # PAISE
    taxable_amount = Column(Integer, default=0)  # PAISE
    cgst_rate = Column(Float, default=2.5)
    cgst_amount = Column(Integer, default=0)  # PAISE
    sgst_rate = Column(Float, default=2.5)
    sgst_amount = Column(Integer, default=0)  # PAISE
    service_charge_amount = Column(Integer, default=0)  # PAISE
    round_off = Column(Integer, default=0)  # PAISE
    final_payable = Column(Integer, default=0)  # PAISE
    payment_method = Column(String(30), default="CASH")  # CASH, UPI, CARD, ONLINE
    payment_status = Column(String(30), default="PAID")  # PAID, PENDING, CANCELLED
    created_at = Column(DateTime, default=now_utc)

    table = relationship("RestaurantTable")
    credit_notes = relationship("CreditNote", back_populates="invoice")

class CreditNote(Base):
    __tablename__ = "credit_notes"

    id = Column(Integer, primary_key=True, index=True)
    credit_note_number = Column(String(40), unique=True, index=True, nullable=False)  # CN/26-27/000001
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    financial_year = Column(String(10), nullable=False)
    amount = Column(Integer, nullable=False)  # PAISE
    reason = Column(Text, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=now_utc)

    invoice = relationship("Invoice", back_populates="credit_notes")


class InternalBillNote(Base):
    """
    Internal-only financial adjustment for an invoice (manager/owner use).
    Never overwrites the original transaction; all adjustments are additive records.
    """
    __tablename__ = "internal_bill_notes"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    note_type = Column(String(30), nullable=False)  # REMARK, ADJUSTMENT, REFUND, CORRECTION
    amount_paise = Column(Integer, default=0)        # + for extra income, - for expense/refund
    reason = Column(Text, nullable=False)
    previous_value = Column(JSON, nullable=True)     # Snapshot for audit trail
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=now_utc)

    invoice = relationship("Invoice", backref="internal_notes")
    creator = relationship("User", foreign_keys=[created_by])


class PrintHistory(Base):
    """Track every bill print action to prevent accidental duplicate prints and for audit."""
    __tablename__ = "print_history"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    print_type = Column(String(30), nullable=False)  # CUSTOMER_THERMAL, CUSTOMER_A4, INTERNAL_THERMAL, INTERNAL_A4, BOTH
    printed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=now_utc)

    invoice = relationship("Invoice", backref="print_history")
    printer = relationship("User", foreign_keys=[printed_by])

class SequentialCounter(Base):
    __tablename__ = "sequential_counters"

    id = Column(Integer, primary_key=True)
    series_name = Column(String(50), unique=True, nullable=False)  # "INV_26-27", "CN_26-27", "ORD_20261004"
    last_val = Column(Integer, default=0, nullable=False)

class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)
    booking_reference = Column(String(30), unique=True, index=True, nullable=False)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), default=1)
    customer_name = Column(String(80), nullable=False)
    mobile_number = Column(String(20), nullable=False)
    reserved_for = Column(DateTime, nullable=False)  # Proper DateTime
    duration_minutes = Column(Integer, default=90)
    guests_count = Column(Integer, default=2)
    seating_preference = Column(String(20), default="AC")  # AC, NON_AC
    special_requests = Column(Text, nullable=True)
    status = Column(String(20), default="PENDING")  # PENDING, CONFIRMED, REJECTED, COMPLETED, CANCELLED, NO_SHOW
    assigned_table_id = Column(Integer, ForeignKey("restaurant_tables.id"), nullable=True)
    created_at = Column(DateTime, default=now_utc)

    restaurant = relationship("Restaurant", back_populates="reservations")
    assigned_table = relationship("RestaurantTable", back_populates="reservations")

class ServiceRequest(Base):
    __tablename__ = "service_requests"

    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(Integer, ForeignKey("restaurant_tables.id"), nullable=False)
    request_type = Column(String(30), nullable=False)  # CALL_WAITER, WATER_REQUEST, BILL_REQUEST, CLEANING
    status = Column(String(20), default="PENDING")  # PENDING, ACKNOWLEDGED, RESOLVED
    created_at = Column(DateTime, default=now_utc)

    table = relationship("RestaurantTable", back_populates="service_requests")

class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), default=1)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    customer_name = Column(String(80), default="Guest")
    rating = Column(Integer, default=5)
    food_rating = Column(Integer, default=5)
    service_rating = Column(Integer, default=5)
    cleanliness_rating = Column(Integer, default=5)
    comment = Column(Text, nullable=True)
    manager_reply = Column(Text, nullable=True)
    replied_at = Column(DateTime, nullable=True)
    is_approved = Column(Boolean, default=True)
    created_at = Column(DateTime, default=now_utc)

    restaurant = relationship("Restaurant", back_populates="reviews")

class InventoryItem(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), default=1)
    name = Column(String(100), nullable=False)
    marathi_name = Column(String(100), nullable=True)
    category = Column(String(50), default="MEAT")
    current_stock = Column(Float, default=0.0)
    unit = Column(String(20), default="kg")
    min_alert_threshold = Column(Float, default=5.0)
    last_restocked = Column(DateTime, default=now_utc)
    supplier_info = Column(String(150), nullable=True)

    movements = relationship("StockMovement", back_populates="item", cascade="all, delete-orphan")
    recipes = relationship("Recipe", back_populates="inventory_item", cascade="all, delete-orphan")

class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    inventory_item_id = Column(Integer, ForeignKey("inventory.id"), nullable=False)
    movement_type = Column(String(20), nullable=False)  # PURCHASE, AUDIT, WASTAGE, USAGE
    quantity_change = Column(Float, nullable=False)  # + or -
    resulting_stock = Column(Float, nullable=False)
    note = Column(String(255), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=now_utc)

    item = relationship("InventoryItem", back_populates="movements")

class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=False)
    inventory_item_id = Column(Integer, ForeignKey("inventory.id"), nullable=False)
    quantity_required = Column(Float, nullable=False)  # e.g., 0.25 kg chicken per Biryani

    menu_item = relationship("MenuItem", back_populates="recipes")
    inventory_item = relationship("InventoryItem", back_populates="recipes")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(60), nullable=False)  # DISCOUNT_APPLIED, ORDER_CANCELLED, PRICE_CHANGED, etc.
    entity_type = Column(String(40), nullable=False)
    entity_id = Column(String(40), nullable=True)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=now_utc)

def init_db():
    Base.metadata.create_all(bind=engine)
