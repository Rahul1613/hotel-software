import os
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, String, Text, Float, Boolean, 
    DateTime, ForeignKey, Enum as SQLEnum, JSON
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, scoped_session

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///hotel_ekdant.db")

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)
SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))
Base = declarative_base()


class Restaurant(Base):
    __tablename__ = "restaurants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), default="Hotel Ekdant Family Restaurant")
    tagline = Column(String(200), default="AC & Non-AC Family Dining • 23 Years of Authentic Hospitality")
    address = Column(Text, default="Near Shree Ganesh Mandir, Main Road, Maharashtra - 416001")
    phone = Column(String(20), default="+91 98234 56789")
    whatsapp = Column(String(20), default="+91 98234 56789")
    gstin = Column(String(25), default="27AABCE1234F1Z5")
    fssai = Column(String(30), default="11521034000189")
    opening_hours = Column(String(100), default="11:00 AM - 11:30 PM (All 7 Days)")
    cgst_rate = Column(Float, default=2.5)  # 2.5% CGST
    sgst_rate = Column(Float, default=2.5)  # 2.5% SGST (Total 5% GST on Restaurant)
    service_charge_rate = Column(Float, default=0.0)
    sound_alerts_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    tables = relationship("RestaurantTable", back_populates="restaurant")
    categories = relationship("MenuCategory", back_populates="restaurant")
    items = relationship("MenuItem", back_populates="restaurant")
    users = relationship("User", back_populates="restaurant")
    reservations = relationship("Reservation", back_populates="restaurant")
    orders = relationship("Order", back_populates="restaurant")
    reviews = relationship("Review", back_populates="restaurant")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), default=1)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), default="waiter")  # owner, manager, waiter, chef, cook
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    restaurant = relationship("Restaurant", back_populates="users")


class RestaurantTable(Base):
    __tablename__ = "restaurant_tables"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), default=1)
    table_number = Column(String(10), unique=True, nullable=False)  # "01" - "11"
    name = Column(String(50), nullable=False)  # "Table 01"
    section = Column(String(20), default="AC")  # "AC" or "NON_AC"
    capacity = Column(Integer, default=4)
    status = Column(String(30), default="AVAILABLE")  # AVAILABLE, OCCUPIED, ORDERING, PREPARING, RESERVED, NEEDS_ATTENTION
    qr_code_token = Column(String(100), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    restaurant = relationship("Restaurant", back_populates="tables")
    orders = relationship("Order", back_populates="table")
    service_requests = relationship("ServiceRequest", back_populates="table")


class MenuCategory(Base):
    __tablename__ = "menu_categories"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), default=1)
    name = Column(String(80), nullable=False)
    description = Column(Text, nullable=True)
    image_url = Column(String(255), nullable=True)
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
    price = Column(Float, nullable=False)
    is_veg = Column(Boolean, default=True)
    food_type = Column(String(30), default="veg")  # veg, chicken, mutton, fish, egg
    spice_level = Column(String(20), default="Medium")  # Mild, Medium, Spicy, Kolhapuri Tikhat
    is_available = Column(Boolean, default=True)
    is_special = Column(Boolean, default=False)
    is_featured = Column(Boolean, default=False)
    image_url = Column(String(255), nullable=True)
    preparation_time_mins = Column(Integer, default=15)
    created_at = Column(DateTime, default=datetime.utcnow)

    restaurant = relationship("Restaurant", back_populates="items")
    category = relationship("MenuCategory", back_populates="items")
    addons = relationship("MenuItemAddon", back_populates="item", cascade="all, delete-orphan")


class MenuItemAddon(Base):
    __tablename__ = "menu_item_addons"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=False)
    name = Column(String(80), nullable=False)
    price = Column(Float, default=0.0)

    item = relationship("MenuItem", back_populates="addons")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(30), unique=True, index=True, nullable=False)  # EKD-20261002-001
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), default=1)
    table_id = Column(Integer, ForeignKey("restaurant_tables.id"), nullable=False)
    customer_name = Column(String(80), default="Guest")
    customer_phone = Column(String(20), nullable=True)
    status = Column(String(30), default="RECEIVED")  # RECEIVED, ACCEPTED, PREPARING, READY, SERVED, COMPLETED, CANCELLED
    special_instructions = Column(Text, nullable=True)
    payment_method = Column(String(30), default="PAY_AT_COUNTER")  # PAY_AT_COUNTER, CASH, UPI, ONLINE
    payment_status = Column(String(30), default="PENDING")  # PENDING, PAID, REFUNDED
    subtotal = Column(Float, default=0.0)
    cgst_amount = Column(Float, default=0.0)
    sgst_amount = Column(Float, default=0.0)
    discount_amount = Column(Float, default=0.0)
    final_amount = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    restaurant = relationship("Restaurant", back_populates="orders")
    table = relationship("RestaurantTable", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    status_history = relationship("OrderStatusHistory", back_populates="order", cascade="all, delete-orphan")
    invoice = relationship("Invoice", uselist=False, back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=False)
    item_name = Column(String(120), nullable=False)
    price = Column(Float, nullable=False)
    quantity = Column(Integer, default=1)
    is_veg = Column(Boolean, default=True)
    customization = Column(Text, nullable=True)
    selected_addons = Column(JSON, nullable=True)  # list of {"name": str, "price": float}
    total_price = Column(Float, nullable=False)
    item_status = Column(String(30), default="PENDING")  # PENDING, PREPARING, READY, SERVED

    order = relationship("Order", back_populates="items")
    item = relationship("MenuItem")


class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    status = Column(String(30), nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="status_history")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(40), unique=True, index=True, nullable=False)  # INV-EKD-20261002-001
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), default=1)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    table_id = Column(Integer, ForeignKey("restaurant_tables.id"), nullable=False)
    customer_name = Column(String(80), default="Guest")
    customer_phone = Column(String(20), nullable=True)
    subtotal = Column(Float, default=0.0)
    cgst_rate = Column(Float, default=2.5)
    cgst_amount = Column(Float, default=0.0)
    sgst_rate = Column(Float, default=2.5)
    sgst_amount = Column(Float, default=0.0)
    discount_amount = Column(Float, default=0.0)
    round_off = Column(Float, default=0.0)
    final_payable = Column(Float, default=0.0)
    payment_method = Column(String(30), default="CASH")  # CASH, UPI, CARD, ONLINE
    payment_status = Column(String(30), default="PAID")  # PAID, PENDING, CANCELLED
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="invoice")
    table = relationship("RestaurantTable")


class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)
    booking_reference = Column(String(30), unique=True, index=True, nullable=False)  # RES-EKD-20261002-001
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), default=1)
    customer_name = Column(String(80), nullable=False)
    mobile_number = Column(String(20), nullable=False)
    booking_date = Column(String(20), nullable=False)  # YYYY-MM-DD
    preferred_time = Column(String(20), nullable=False)  # "07:30 PM"
    guests_count = Column(Integer, default=2)
    seating_preference = Column(String(20), default="AC")  # "AC" or "NON_AC"
    special_requests = Column(Text, nullable=True)
    status = Column(String(20), default="PENDING")  # PENDING, CONFIRMED, REJECTED, COMPLETED, CANCELLED
    assigned_table_id = Column(Integer, ForeignKey("restaurant_tables.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    restaurant = relationship("Restaurant", back_populates="reservations")
    assigned_table = relationship("RestaurantTable")


class ServiceRequest(Base):
    __tablename__ = "service_requests"

    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(Integer, ForeignKey("restaurant_tables.id"), nullable=False)
    request_type = Column(String(30), nullable=False)  # CALL_WAITER, WATER_REQUEST, BILL_REQUEST, CLEANING
    status = Column(String(20), default="PENDING")  # PENDING, ACKNOWLEDGED, RESOLVED
    created_at = Column(DateTime, default=datetime.utcnow)

    table = relationship("RestaurantTable", back_populates="service_requests")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), default=1)
    customer_name = Column(String(80), default="Guest")
    rating = Column(Integer, default=5)  # 1-5 overall
    food_rating = Column(Integer, default=5)
    service_rating = Column(Integer, default=5)
    cleanliness_rating = Column(Integer, default=5)
    comment = Column(Text, nullable=True)
    reply = Column(Text, nullable=True)
    is_approved = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    restaurant = relationship("Restaurant", back_populates="reviews")


class InventoryItem(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), default=1)
    name = Column(String(100), nullable=False)
    marathi_name = Column(String(100), nullable=True)
    category = Column(String(50), default="MEAT")  # MEAT, DAIRY, GRAINS, OILS, SPICES, VEGETABLES
    current_stock = Column(Float, default=0.0)
    unit = Column(String(20), default="kg")  # kg, Litres, Bags, Packets
    min_alert_threshold = Column(Float, default=5.0)
    last_restocked = Column(DateTime, default=datetime.utcnow)
    supplier_info = Column(String(150), nullable=True)


def init_db():
    Base.metadata.create_all(bind=engine)
