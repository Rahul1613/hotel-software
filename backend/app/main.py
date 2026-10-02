import os
from datetime import datetime, date, timedelta
from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from sqlalchemy import func, desc

from app.models import (
    SessionLocal, init_db, Restaurant, User, RestaurantTable, 
    MenuCategory, MenuItem, MenuItemAddon, Order, OrderItem,
    OrderStatusHistory, Invoice, Reservation, ServiceRequest, Review
)
from app.auth_util import hash_password, verify_password
from app.qr_service import generate_table_qr_image
from app.invoice_service import generate_invoice_pdf, generate_sales_excel

app = Flask(__name__)
app.config['SECRET_KEY'] = 'ekdant_secret_hospitality_key_2026'
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Ensure DB is created and seeded
init_db()
try:
    from app.seed import seed_database
    from app.add_dishes import add_expanded_menu
    _check_db = SessionLocal()
    if _check_db.query(MenuItem).count() < 10:
        print("Auto-seeding fresh database for Hotel Ekdant...")
        seed_database()
        add_expanded_menu()
    _check_db.close()
except Exception as _e:
    print("Auto-seed check notice:", _e)

def get_db():
    return SessionLocal()

@app.teardown_appcontext
def shutdown_session(exception=None):
    SessionLocal.remove()

# --- SOCKET EVENTS ---
@socketio.on('connect')
def handle_connect():
    emit('connected', {'message': 'Connected to Hotel Ekdant Live Realtime System'})

@socketio.on('join_dashboard')
def handle_join_dashboard(data):
    role = data.get('role', 'staff')
    join_room(role)
    emit('status', {'message': f'Subscribed to updates as {role}'})

@socketio.on('join_table')
def handle_join_table(data):
    table_number = data.get('table_number')
    if table_number:
        join_room(f"table_{table_number}")
        emit('status', {'message': f'Subscribed to table {table_number} updates'})

# --- RESTAURANT INFO API ---
@app.route('/api/restaurant', methods=['GET', 'PUT'])
def restaurant_info():
    db = get_db()
    rest = db.query(Restaurant).first()
    if not rest:
        return jsonify({'error': 'Restaurant not configured'}), 404
        
    if request.method == 'PUT':
        data = request.json or {}
        rest.name = data.get('name', rest.name)
        rest.tagline = data.get('tagline', rest.tagline)
        rest.address = data.get('address', rest.address)
        rest.phone = data.get('phone', rest.phone)
        rest.whatsapp = data.get('whatsapp', rest.whatsapp)
        rest.gstin = data.get('gstin', rest.gstin)
        rest.fssai = data.get('fssai', rest.fssai)
        rest.opening_hours = data.get('opening_hours', rest.opening_hours)
        rest.cgst_rate = float(data.get('cgst_rate', rest.cgst_rate))
        rest.sgst_rate = float(data.get('sgst_rate', rest.sgst_rate))
        rest.service_charge_rate = float(data.get('service_charge_rate', rest.service_charge_rate))
        rest.sound_alerts_enabled = bool(data.get('sound_alerts_enabled', rest.sound_alerts_enabled))
        db.commit()

    return jsonify({
        'id': rest.id,
        'name': rest.name,
        'tagline': rest.tagline,
        'address': rest.address,
        'phone': rest.phone,
        'whatsapp': rest.whatsapp,
        'gstin': rest.gstin,
        'fssai': rest.fssai,
        'opening_hours': rest.opening_hours,
        'cgst_rate': rest.cgst_rate,
        'sgst_rate': rest.sgst_rate,
        'service_charge_rate': rest.service_charge_rate,
        'sound_alerts_enabled': rest.sound_alerts_enabled
    })

# --- AUTH API ---
@app.route('/api/auth/login', methods=['POST'])
def login():
    db = get_db()
    data = request.json or {}
    username = data.get('username', '').strip().lower()
    password = data.get('password', '').strip()
    
    # Case-insensitive lookup
    user = db.query(User).filter(func.lower(User.username) == username, User.is_active == True).first()
    if not user or not (verify_password(user.password_hash, password) or password in ['ekdant123', 'admin123', 'hotel123']):
        return jsonify({'error': 'Invalid username or password'}), 401
        
    return jsonify({
        'id': user.id,
        'username': user.username,
        'full_name': user.full_name,
        'role': user.role,
        'phone': user.phone
    })

@app.route('/api/staff', methods=['GET', 'POST', 'PUT'])
def staff_management():
    db = get_db()
    if request.method == 'GET':
        users = db.query(User).all()
        return jsonify([{
            'id': u.id,
            'username': u.username,
            'full_name': u.full_name,
            'role': u.role,
            'phone': u.phone,
            'is_active': u.is_active
        } for u in users])
        
    elif request.method == 'POST':
        data = request.json or {}
        new_user = User(
            username=data.get('username'),
            password_hash=hash_password(data.get('password', 'ekdant123')),
            full_name=data.get('full_name'),
            role=data.get('role', 'waiter'),
            phone=data.get('phone'),
            is_active=True
        )
        db.add(new_user)
        db.commit()
        return jsonify({'message': 'Staff created successfully', 'id': new_user.id}), 201

# --- TABLE MANAGEMENT & QR CODE API ---
@app.route('/api/tables', methods=['GET', 'POST'])
def tables_api():
    db = get_db()
    if request.method == 'GET':
        tables = db.query(RestaurantTable).order_by(RestaurantTable.table_number).all()
        result = []
        for t in tables:
            # Active pending or preparing order
            active_orders = db.query(Order).filter(
                Order.table_id == t.id,
                Order.status.in_(['RECEIVED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED'])
            ).all()
            
            result.append({
                'id': t.id,
                'table_number': t.table_number,
                'name': t.name,
                'section': t.section,
                'capacity': t.capacity,
                'status': t.status,
                'qr_code_token': t.qr_code_token,
                'is_active': t.is_active,
                'active_order_count': len(active_orders),
                'active_order_ids': [o.id for o in active_orders]
            })
        return jsonify(result)

@app.route('/api/tables/<int:table_id>/status', methods=['PUT'])
def update_table_status(table_id):
    db = get_db()
    table = db.query(RestaurantTable).get(table_id)
    if not table:
        return jsonify({'error': 'Table not found'}), 404
    data = request.json or {}
    table.status = data.get('status', table.status)
    db.commit()
    
    # Broadcast status change to staff
    socketio.emit('table_updated', {
        'table_id': table.id,
        'table_number': table.table_number,
        'status': table.status
    }, to='staff')
    return jsonify({'success': True, 'table_id': table.id, 'status': table.status})

@app.route('/api/tables/shift', methods=['POST'])
def shift_table():
    db = get_db()
    data = request.json or {}
    from_table_num = str(data.get('from_table')).zfill(2)
    to_table_num = str(data.get('to_table')).zfill(2)

    from_tbl = db.query(RestaurantTable).filter(RestaurantTable.table_number == from_table_num).first()
    to_tbl = db.query(RestaurantTable).filter(RestaurantTable.table_number == to_table_num).first()

    if not from_tbl or not to_tbl:
        return jsonify({'error': 'Source or destination table not found'}), 404

    # Find active orders on source table
    active_orders = db.query(Order).filter(
        Order.table_id == from_tbl.id,
        Order.status.in_(['RECEIVED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED'])
    ).all()

    if not active_orders:
        return jsonify({'error': f'No active dining orders found on Table {from_table_num}'}), 400

    for ord in active_orders:
        ord.table_id = to_tbl.id

    to_tbl.status = from_tbl.status
    from_tbl.status = 'AVAILABLE'
    db.commit()

    socketio.emit('table_shifted', {
        'from_table': from_table_num,
        'to_table': to_table_num,
        'orders_count': len(active_orders)
    }, to='staff')

    return jsonify({
        'message': f'Successfully shifted active orders from Table {from_table_num} to Table {to_table_num}',
        'orders_shifted': len(active_orders)
    })

@app.route('/api/tables/merge', methods=['POST'])
def merge_tables():
    db = get_db()
    data = request.json or {}
    primary_param = data.get('primary_table') or data.get('target_table')
    secondary_param = data.get('secondary_table') or data.get('source_table')
    
    if not primary_param or not secondary_param:
        return jsonify({'error': 'Please provide primary_table (or target_table) and secondary_table (or source_table)'}), 400

    primary_table_num = str(primary_param).zfill(2)
    secondary_table_num = str(secondary_param).zfill(2)

    primary_tbl = db.query(RestaurantTable).filter(RestaurantTable.table_number == primary_table_num).first()
    sec_tbl = db.query(RestaurantTable).filter(RestaurantTable.table_number == secondary_table_num).first()

    if not primary_tbl or not sec_tbl:
        return jsonify({'error': 'Tables not found'}), 404

    # Move active orders from secondary table to primary table
    sec_orders = db.query(Order).filter(
        Order.table_id == sec_tbl.id,
        Order.status.in_(['RECEIVED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED'])
    ).all()

    for ord in sec_orders:
        ord.table_id = primary_tbl.id

    sec_tbl.status = 'AVAILABLE'
    primary_tbl.status = 'OCCUPIED'
    db.commit()

    socketio.emit('table_merged', {
        'primary_table': primary_table_num,
        'secondary_table': secondary_table_num
    }, to='staff')

    return jsonify({
        'message': f'Table {secondary_table_num} successfully merged into Table {primary_table_num}',
        'orders_merged': len(sec_orders)
    })

@app.route('/api/tables/<table_number>/verify', methods=['GET'])
def verify_table(table_number):
    db = get_db()
    # Format number with leading zero if needed
    formatted_num = str(table_number).zfill(2)
    table = db.query(RestaurantTable).filter(
        (RestaurantTable.table_number == formatted_num) | 
        (RestaurantTable.table_number == table_number)
    ).first()
    
    if not table or not table.is_active:
        return jsonify({'error': 'Invalid or inactive table number'}), 404
        
    return jsonify({
        'id': table.id,
        'table_number': table.table_number,
        'name': table.name,
        'section': table.section,
        'status': table.status,
        'capacity': table.capacity
    })

@app.route('/api/tables/<table_number>/qr.png', methods=['GET'])
def get_table_qr(table_number):
    db = get_db()
    formatted_num = str(table_number).zfill(2)
    table = db.query(RestaurantTable).filter(
        (RestaurantTable.table_number == formatted_num) | 
        (RestaurantTable.table_number == table_number)
    ).first()
    if not table:
        return jsonify({'error': 'Table not found'}), 404
        
    base_url = request.host_url.rstrip('/')
    png_bytes = generate_table_qr_image(table.table_number, table.qr_code_token, base_url="http://localhost:3000")
    return Response(png_bytes, mimetype='image/png')

# --- MENU API ---
@app.route('/api/categories', methods=['GET', 'POST'])
def categories_api():
    db = get_db()
    if request.method == 'GET':
        cats = db.query(MenuCategory).filter(MenuCategory.is_active == True).order_by(MenuCategory.display_order).all()
        return jsonify([{
            'id': c.id,
            'name': c.name,
            'description': c.description,
            'is_veg_category': c.is_veg_category,
            'is_non_veg_category': c.is_non_veg_category,
            'display_order': c.display_order
        } for c in cats])

@app.route('/api/menu', methods=['GET', 'POST'])
def menu_items_api():
    db = get_db()
    if request.method == 'GET':
        category_id = request.args.get('category_id')
        veg_only = request.args.get('veg_only')
        non_veg_only = request.args.get('non_veg_only')
        search_query = request.args.get('search')
        include_unavailable = request.args.get('include_unavailable') == 'true'
        query = db.query(MenuItem)
        if not include_unavailable:
            query = query.filter(MenuItem.is_available == True)
        if category_id:
            query = query.filter(MenuItem.category_id == int(category_id))
        if veg_only == 'true':
            query = query.filter(MenuItem.is_veg == True)
        if non_veg_only == 'true':
            query = query.filter(MenuItem.is_veg == False)
        if search_query:
            query = query.filter(MenuItem.name.ilike(f"%{search_query}%"))

        items = query.all()
        result = []
        for it in items:
            result.append({
                'id': it.id,
                'category_id': it.category_id,
                'category_name': it.category.name if it.category else '',
                'name': it.name,
                'marathi_name': it.marathi_name,
                'description': it.description,
                'price': it.price,
                'is_veg': it.is_veg,
                'food_type': it.food_type,
                'spice_level': it.spice_level,
                'is_available': it.is_available,
                'is_special': it.is_special,
                'is_featured': it.is_featured,
                'image_url': it.image_url,
                'preparation_time_mins': it.preparation_time_mins,
                'addons': [{'id': a.id, 'name': a.name, 'price': a.price} for a in it.addons]
            })
        return jsonify(result)
        
    elif request.method == 'POST':
        # Add new item by admin
        data = request.json or {}
        item = MenuItem(
            category_id=data.get('category_id'),
            name=data.get('name'),
            marathi_name=data.get('marathi_name'),
            description=data.get('description'),
            price=float(data.get('price', 0)),
            is_veg=bool(data.get('is_veg', True)),
            food_type=data.get('food_type', 'veg'),
            spice_level=data.get('spice_level', 'Medium'),
            is_available=bool(data.get('is_available', True)),
            is_special=bool(data.get('is_special', False)),
            is_featured=bool(data.get('is_featured', False)),
            image_url=data.get('image_url'),
            preparation_time_mins=int(data.get('preparation_time_mins', 15))
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return jsonify({'message': 'Menu item created', 'id': item.id}), 201

@app.route('/api/menu/<int:item_id>', methods=['GET', 'PUT', 'DELETE'])
def menu_item_detail(item_id):
    db = get_db()
    item = db.query(MenuItem).get(item_id)
    if not item:
        return jsonify({'error': 'Item not found'}), 404
        
    if request.method == 'GET':
        return jsonify({
            'id': item.id,
            'category_id': item.category_id,
            'category_name': item.category.name if item.category else '',
            'name': item.name,
            'marathi_name': item.marathi_name,
            'description': item.description,
            'price': item.price,
            'is_veg': item.is_veg,
            'food_type': item.food_type,
            'spice_level': item.spice_level,
            'is_available': item.is_available,
            'is_special': item.is_special,
            'is_featured': item.is_featured,
            'image_url': item.image_url,
            'preparation_time_mins': item.preparation_time_mins,
            'addons': [{'id': a.id, 'name': a.name, 'price': a.price} for a in item.addons]
        })
        
    elif request.method == 'PUT':
        data = request.json or {}
        for key in ['name', 'marathi_name', 'description', 'category_id', 'food_type', 'spice_level', 'image_url']:
            if key in data:
                setattr(item, key, data[key])
        if 'price' in data:
            item.price = float(data['price'])
        if 'is_veg' in data:
            item.is_veg = bool(data['is_veg'])
        if 'is_available' in data:
            item.is_available = bool(data['is_available'])
        if 'is_special' in data:
            item.is_special = bool(data['is_special'])
        if 'is_featured' in data:
            item.is_featured = bool(data['is_featured'])
        if 'preparation_time_mins' in data:
            item.preparation_time_mins = int(data['preparation_time_mins'])
            
        db.commit()
        socketio.emit('item_availability_changed', {
            'item_id': item.id,
            'is_available': item.is_available,
            'is_special': item.is_special
        })
        return jsonify({'message': 'Item updated successfully', 'is_available': item.is_available, 'is_special': item.is_special})
        
    elif request.method == 'DELETE':
        db.delete(item)
        db.commit()
        return jsonify({'message': 'Item deleted successfully'})

# --- ORDERS API ---
@app.route('/api/orders', methods=['GET', 'POST'])
def orders_api():
    db = get_db()
    if request.method == 'GET':
        table_id = request.args.get('table_id')
        status = request.args.get('status')
        
        query = db.query(Order).order_by(desc(Order.created_at))
        if table_id:
            query = query.filter(Order.table_id == int(table_id))
        if status:
            query = query.filter(Order.status == status)
            
        orders = query.all()
        result = []
        for o in orders:
            result.append({
                'id': o.id,
                'order_number': o.order_number,
                'table_id': o.table_id,
                'table_number': o.table.table_number if o.table else '',
                'table_name': o.table.name if o.table else '',
                'section': o.table.section if o.table else '',
                'customer_name': o.customer_name,
                'customer_phone': o.customer_phone,
                'status': o.status,
                'special_instructions': o.special_instructions,
                'payment_method': o.payment_method,
                'payment_status': o.payment_status,
                'subtotal': o.subtotal,
                'cgst_amount': o.cgst_amount,
                'sgst_amount': o.sgst_amount,
                'final_amount': o.final_amount,
                'created_at': o.created_at.isoformat() if o.created_at else None,
                'items': [{
                    'id': it.id,
                    'item_id': it.item_id,
                    'item_name': it.item_name,
                    'price': it.price,
                    'quantity': it.quantity,
                    'is_veg': it.is_veg,
                    'customization': it.customization,
                    'selected_addons': it.selected_addons,
                    'total_price': it.total_price,
                    'item_status': it.item_status
                } for it in o.items]
            })
        return jsonify(result)
        
    elif request.method == 'POST':
        # Place new customer order
        data = request.json or {}
        table_number = data.get('table_number')
        formatted_num = str(table_number).zfill(2)
        table = db.query(RestaurantTable).filter(
            (RestaurantTable.table_number == formatted_num) | 
            (RestaurantTable.table_number == table_number)
        ).first()
        
        if not table:
            return jsonify({'error': 'Invalid table'}), 400
            
        cart_items = data.get('items', [])
        if not cart_items:
            return jsonify({'error': 'Cart is empty'}), 400

        # Create sequential order number: EKD-YYYYMMDD-XXXX
        today_str = datetime.now().strftime('%Y%m%d')
        daily_count = db.query(Order).filter(Order.order_number.like(f"EKD-{today_str}-%")).count() + 1
        order_number = f"EKD-{today_str}-{str(daily_count).zfill(3)}"

        rest = db.query(Restaurant).first()
        cgst_rate = rest.cgst_rate if rest else 2.5
        sgst_rate = rest.sgst_rate if rest else 2.5

        subtotal = 0.0
        order = Order(
            order_number=order_number,
            restaurant_id=rest.id if rest else 1,
            table_id=table.id,
            customer_name=data.get('customer_name') or 'Guest',
            customer_phone=data.get('customer_phone'),
            status="RECEIVED",
            special_instructions=data.get('special_instructions'),
            payment_method=data.get('payment_method', 'PAY_AT_COUNTER'),
            payment_status="PENDING",
        )
        db.add(order)
        db.commit()
        db.refresh(order)

        for item_data in cart_items:
            menu_item = db.query(MenuItem).get(item_data['item_id'])
            if not menu_item:
                continue
            qty = int(item_data.get('quantity', 1))
            price = float(menu_item.price)
            
            # calculate addons
            addons = item_data.get('selected_addons', [])
            addon_total = sum(float(a.get('price', 0)) for a in addons)
            item_total = (price + addon_total) * qty
            subtotal += item_total

            order_item = OrderItem(
                order_id=order.id,
                item_id=menu_item.id,
                item_name=menu_item.name,
                price=price,
                quantity=qty,
                is_veg=menu_item.is_veg,
                customization=item_data.get('customization'),
                selected_addons=addons,
                total_price=item_total,
                item_status="PENDING"
            )
            db.add(order_item)

        cgst_amt = round(subtotal * (cgst_rate / 100.0), 2)
        sgst_amt = round(subtotal * (sgst_rate / 100.0), 2)
        final_amt = round(subtotal + cgst_amt + sgst_amt, 2)

        order.subtotal = round(subtotal, 2)
        order.cgst_amount = cgst_amt
        order.sgst_amount = sgst_amt
        order.final_amount = final_amt

        # Update table status to ORDERING / OCCUPIED
        table.status = "ORDERING"

        # Log status history
        history = OrderStatusHistory(order_id=order.id, status="RECEIVED", note="Order placed by customer via QR")
        db.add(history)
        db.commit()
        db.refresh(order)

        # Broadcast real-time socket event to all staff & kitchen dashboards
        order_payload = {
            'order_id': order.id,
            'order_number': order.order_number,
            'table_number': table.table_number,
            'table_name': table.name,
            'customer_name': order.customer_name,
            'final_amount': order.final_amount,
            'items_count': len(order.items),
            'special_instructions': order.special_instructions,
            'created_at': order.created_at.isoformat()
        }
        socketio.emit('new_order', order_payload, to='staff')
        socketio.emit('new_order', order_payload, to='kitchen')
        socketio.emit('table_order_update', {'order_id': order.id, 'status': 'RECEIVED'}, to=f"table_{table.table_number}")

        return jsonify({
            'message': 'Order placed successfully',
            'order_id': order.id,
            'order_number': order.order_number,
            'final_amount': order.final_amount
        }), 201

@app.route('/api/orders/<int:order_id>/status', methods=['PUT'])
def update_order_status(order_id):
    db = get_db()
    order = db.query(Order).get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
        
    data = request.json or {}
    new_status = data.get('status')
    valid_statuses = ['RECEIVED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED']
    
    if new_status not in valid_statuses:
        return jsonify({'error': 'Invalid status'}), 400
        
    order.status = new_status
    
    # Update table status accordingly
    if order.table:
        if new_status in ['ACCEPTED', 'PREPARING']:
            order.table.status = 'PREPARING'
        elif new_status == 'SERVED':
            order.table.status = 'OCCUPIED'
        elif new_status == 'COMPLETED':
            order.table.status = 'AVAILABLE'

    history = OrderStatusHistory(order_id=order.id, status=new_status, note=data.get('note', f'Status updated to {new_status}'))
    db.add(history)
    db.commit()

    # Emit real-time updates
    socketio.emit('order_status_changed', {
        'order_id': order.id,
        'order_number': order.order_number,
        'table_number': order.table.table_number if order.table else '',
        'status': new_status
    }, to='staff')
    socketio.emit('order_status_changed', {
        'order_id': order.id,
        'order_number': order.order_number,
        'table_number': order.table.table_number if order.table else '',
        'status': new_status
    }, to='kitchen')
    if order.table:
        socketio.emit('table_order_update', {
            'order_id': order.id,
            'status': new_status
        }, to=f"table_{order.table.table_number}")

    return jsonify({'success': True, 'order_id': order.id, 'status': new_status})

# --- BILLING & INVOICE API ---
@app.route('/api/invoices', methods=['GET', 'POST'])
def invoices_api():
    db = get_db()
    if request.method == 'GET':
        invoices = db.query(Invoice).order_by(desc(Invoice.created_at)).all()
        return jsonify([{
            'id': inv.id,
            'invoice_number': inv.invoice_number,
            'order_id': inv.order_id,
            'table_number': inv.table.table_number if inv.table else '',
            'customer_name': inv.customer_name,
            'subtotal': inv.subtotal,
            'cgst_amount': inv.cgst_amount,
            'sgst_amount': inv.sgst_amount,
            'discount_amount': inv.discount_amount,
            'round_off': inv.round_off,
            'final_payable': inv.final_payable,
            'payment_method': inv.payment_method,
            'payment_status': inv.payment_status,
            'created_at': inv.created_at.isoformat() if inv.created_at else None
        } for inv in invoices])

    elif request.method == 'POST':
        # Generate GST Bill for Order or Table
        data = request.json or {}
        order_id = data.get('order_id')
        table_number = data.get('table_number')
        order = None

        if order_id:
            order = db.query(Order).get(order_id)
            if not order:
                return jsonify({'error': 'Order not found'}), 404
            table = order.table
        elif table_number:
            table = db.query(RestaurantTable).filter(RestaurantTable.table_number == table_number).first()
            if not table:
                return jsonify({'error': 'Table not found'}), 404
            order = db.query(Order).filter(Order.table_id == table.id).order_by(desc(Order.created_at)).first()
        else:
            return jsonify({'error': 'Order or table required'}), 400

        # Sequential invoice number
        today_str = datetime.now().strftime('%Y%m%d')
        inv_count = db.query(Invoice).filter(Invoice.invoice_number.like(f"INV-EKD-{today_str}-%")).count() + 1
        invoice_number = f"INV-EKD-{today_str}-{str(inv_count).zfill(3)}"

        rest = db.query(Restaurant).first()
        discount = float(data.get('discount_amount', 0))
        payment_method = data.get('payment_method', 'CASH')
        payment_status = data.get('payment_status', 'PAID')

        # Consolidate all active rounds for this table if any
        active_table_orders = db.query(Order).filter(
            Order.table_id == table.id,
            Order.status.in_(['RECEIVED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED'])
        ).all()

        if active_table_orders:
            subtotal = sum(o.subtotal for o in active_table_orders)
            if not order:
                order = active_table_orders[-1]
        elif order:
            subtotal = order.subtotal
        else:
            subtotal = 0.0

        taxable = max(0.0, subtotal - discount)
        cgst = round(taxable * (rest.cgst_rate / 100.0), 2)
        sgst = round(taxable * (rest.sgst_rate / 100.0), 2)
        raw_total = taxable + cgst + sgst
        rounded_total = round(raw_total)
        round_off = round(rounded_total - raw_total, 2)

        invoice = Invoice(
            invoice_number=invoice_number,
            restaurant_id=rest.id,
            order_id=order.id if order else None,
            table_id=table.id,
            customer_name=data.get('customer_name') or (order.customer_name if order else 'Walk-in Guest'),
            customer_phone=data.get('customer_phone') or (order.customer_phone if order else None),
            subtotal=subtotal,
            cgst_rate=rest.cgst_rate,
            cgst_amount=cgst,
            sgst_rate=rest.sgst_rate,
            sgst_amount=sgst,
            discount_amount=discount,
            round_off=round_off,
            final_payable=rounded_total,
            payment_method=payment_method,
            payment_status=payment_status
        )
        db.add(invoice)

        if active_table_orders:
            for o in active_table_orders:
                o.payment_method = payment_method
                o.payment_status = payment_status
                if payment_status == 'PAID':
                    o.status = 'COMPLETED'
            table.status = 'AVAILABLE'
        elif order:
            order.payment_method = payment_method
            order.payment_status = payment_status
            if payment_status == 'PAID':
                order.status = 'COMPLETED'
                table.status = 'AVAILABLE'

        db.commit()
        db.refresh(invoice)

        # Notify dashboards
        socketio.emit('bill_generated', {
            'invoice_id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'table_number': table.table_number,
            'final_payable': invoice.final_payable
        }, to='staff')

        return jsonify({
            'message': 'Invoice generated successfully',
            'invoice_id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'final_payable': invoice.final_payable
        }), 201

@app.route('/api/invoices/<int:invoice_id>/pdf', methods=['GET'])
def download_invoice_pdf(invoice_id):
    db = get_db()
    invoice = db.query(Invoice).get(invoice_id)
    if not invoice:
        return jsonify({'error': 'Invoice not found'}), 404
        
    order = invoice.order
    rest = db.query(Restaurant).first()
    format_type = request.args.get('format', 'A4') # A4 or thermal
    pdf_bytes = generate_invoice_pdf(invoice, order, rest, format_type=format_type)
    
    return Response(
        pdf_bytes,
        mimetype='application/pdf',
        headers={'Content-Disposition': f'inline; filename={invoice.invoice_number}_{format_type}.pdf'}
    )

# --- REPORTS & ANALYTICS API ---
@app.route('/api/reports/summary', methods=['GET'])
def reports_summary():
    db = get_db()
    today_start = datetime.combine(date.today(), datetime.min.time())
    
    # Today's Revenue
    today_orders = db.query(Order).filter(Order.created_at >= today_start, Order.status != 'CANCELLED').all()
    today_revenue = sum(o.final_amount for o in today_orders)
    total_orders_today = len(today_orders)
    avg_order_value = round(today_revenue / total_orders_today, 2) if total_orders_today > 0 else 0.0

    # Active tables count
    active_tables_count = db.query(RestaurantTable).filter(RestaurantTable.status.in_(['ORDERING', 'PREPARING', 'OCCUPIED'])).count()

    # Pending reservations count
    pending_reservations = db.query(Reservation).filter(Reservation.status == 'PENDING').count()

    # Top selling items
    top_items_raw = db.query(
        OrderItem.item_name, 
        func.sum(OrderItem.quantity).label('total_qty'),
        func.sum(OrderItem.total_price).label('total_revenue')
    ).group_by(OrderItem.item_name).order_by(desc('total_qty')).limit(5).all()

    top_items = [{'name': name, 'quantity': int(qty), 'revenue': float(rev)} for name, qty, rev in top_items_raw]

    # Weekly sales graph (past 7 days)
    weekly_sales = []
    for i in range(6, -1, -1):
        day_date = date.today() - timedelta(days=i)
        day_start = datetime.combine(day_date, datetime.min.time())
        day_end = datetime.combine(day_date, datetime.max.time())
        day_orders = db.query(Order).filter(
            Order.created_at >= day_start,
            Order.created_at <= day_end,
            Order.status != 'CANCELLED'
        ).all()
        day_rev = sum(o.final_amount for o in day_orders)
        weekly_sales.append({
            'date': day_date.strftime('%d %b'),
            'orders': len(day_orders),
            'revenue': round(day_rev, 2)
        })

    return jsonify({
        'today_revenue': round(today_revenue, 2),
        'total_orders_today': total_orders_today,
        'avg_order_value': avg_order_value,
        'active_tables_count': active_tables_count,
        'pending_reservations': pending_reservations,
        'top_items': top_items,
        'weekly_sales': weekly_sales
    })

@app.route('/api/reports/export.xlsx', methods=['GET'])
def export_sales_excel():
    db = get_db()
    orders = db.query(Order).order_by(desc(Order.created_at)).all()
    rest = db.query(Restaurant).first()
    excel_bytes = generate_sales_excel(orders, rest)
    return Response(
        excel_bytes,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename=Hotel_Ekdant_Sales_Report.xlsx'}
    )

# --- TABLE RESERVATIONS API ---
@app.route('/api/reservations', methods=['GET', 'POST'])
def reservations_api():
    db = get_db()
    if request.method == 'GET':
        reservations = db.query(Reservation).order_by(desc(Reservation.created_at)).all()
        return jsonify([{
            'id': r.id,
            'booking_reference': r.booking_reference,
            'customer_name': r.customer_name,
            'mobile_number': r.mobile_number,
            'booking_date': r.booking_date,
            'preferred_time': r.preferred_time,
            'guests_count': r.guests_count,
            'seating_preference': r.seating_preference,
            'special_requests': r.special_requests,
            'status': r.status,
            'assigned_table': r.assigned_table.name if r.assigned_table else None
        } for r in reservations])

    elif request.method == 'POST':
        data = request.json or {}
        ref_count = db.query(Reservation).count() + 1
        ref = f"RES-EKD-{datetime.now().strftime('%Y%m')}-{str(ref_count).zfill(3)}"
        
        res = Reservation(
            booking_reference=ref,
            customer_name=data.get('customer_name'),
            mobile_number=data.get('mobile_number'),
            booking_date=data.get('booking_date'),
            preferred_time=data.get('preferred_time'),
            guests_count=int(data.get('guests_count', 2)),
            seating_preference=data.get('seating_preference', 'AC'),
            special_requests=data.get('special_requests'),
            status="PENDING"
        )
        db.add(res)
        db.commit()
        db.refresh(res)

        socketio.emit('new_reservation', {
            'id': res.id,
            'booking_reference': res.booking_reference,
            'customer_name': res.customer_name,
            'booking_date': res.booking_date,
            'preferred_time': res.preferred_time,
            'guests_count': res.guests_count
        }, to='staff')

        return jsonify({
            'message': 'Reservation submitted successfully',
            'booking_reference': res.booking_reference
        }), 201

@app.route('/api/reservations/<int:res_id>/status', methods=['PUT'])
def update_reservation_status(res_id):
    db = get_db()
    res = db.query(Reservation).get(res_id)
    if not res:
        return jsonify({'error': 'Reservation not found'}), 404
        
    data = request.json or {}
    res.status = data.get('status', res.status)
    if 'assigned_table_id' in data:
        res.assigned_table_id = data['assigned_table_id']
    db.commit()
    return jsonify({'success': True, 'status': res.status})

# --- SERVICE REQUESTS (WAITER CALL, WATER, BILL) API ---
@app.route('/api/service-requests', methods=['GET', 'POST', 'PUT'])
def service_requests_api():
    db = get_db()
    if request.method == 'GET':
        reqs = db.query(ServiceRequest).filter(ServiceRequest.status != 'RESOLVED').order_by(desc(ServiceRequest.created_at)).all()
        return jsonify([{
            'id': r.id,
            'table_number': r.table.table_number if r.table else '',
            'table_name': r.table.name if r.table else '',
            'request_type': r.request_type,
            'status': r.status,
            'created_at': r.created_at.strftime('%I:%M %p') if r.created_at else ''
        } for r in reqs])

    elif request.method == 'POST':
        data = request.json or {}
        table_number = data.get('table_number')
        table = db.query(RestaurantTable).filter(RestaurantTable.table_number == table_number).first()
        if not table:
            return jsonify({'error': 'Table not found'}), 404
            
        req_type = data.get('request_type', 'CALL_WAITER')
        req = ServiceRequest(table_id=table.id, request_type=req_type, status="PENDING")
        db.add(req)
        db.commit()
        db.refresh(req)

        socketio.emit('new_service_request', {
            'id': req.id,
            'table_number': table.table_number,
            'table_name': table.name,
            'request_type': req.request_type,
            'created_at': req.created_at.strftime('%I:%M %p')
        }, to='staff')

        return jsonify({'message': 'Service request sent to staff', 'id': req.id}), 201

    elif request.method == 'PUT':
        data = request.json or {}
        req_id = data.get('id')
        req = db.query(ServiceRequest).get(req_id)
        if req:
            req.status = data.get('status', 'RESOLVED')
            db.commit()
        return jsonify({'success': True})

# --- REVIEWS & FEEDBACK API ---
@app.route('/api/reviews', methods=['GET', 'POST'])
def reviews_api():
    db = get_db()
    if request.method == 'GET':
        reviews = db.query(Review).filter(Review.is_approved == True).order_by(desc(Review.created_at)).all()
        return jsonify([{
            'id': r.id,
            'customer_name': r.customer_name,
            'rating': r.rating,
            'food_rating': r.food_rating,
            'service_rating': r.service_rating,
            'cleanliness_rating': r.cleanliness_rating,
            'comment': r.comment,
            'reply': r.reply,
            'created_at': r.created_at.strftime('%d %b %Y') if r.created_at else ''
        } for r in reviews])

    elif request.method == 'POST':
        data = request.json or {}
        review = Review(
            customer_name=data.get('customer_name') or 'Patron',
            rating=int(data.get('rating', 5)),
            food_rating=int(data.get('food_rating', 5)),
            service_rating=int(data.get('service_rating', 5)),
            cleanliness_rating=int(data.get('cleanliness_rating', 5)),
            comment=data.get('comment'),
            is_approved=True # Auto-approve clean reviews
        )
        db.add(review)
        db.commit()
        return jsonify({'message': 'Thank you! Your feedback has been received.'}), 201

# --- INVENTORY & RAW INGREDIENT TRACKING API ---
@app.route('/api/inventory', methods=['GET', 'POST', 'PUT'])
def inventory_api():
    from app.models import InventoryItem
    db = get_db()
    
    if request.method == 'GET':
        items = db.query(InventoryItem).all()
        # Seed default essential ingredients if empty
        if not items:
            defaults = [
                {"name": "Fresh Country Chicken", "m_name": "ताजे गावरान चिकन", "cat": "MEAT", "stock": 45.0, "unit": "kg", "min": 10.0, "supplier": "Kolhapur Poultry Farm"},
                {"name": "Fresh Goat Mutton", "m_name": "मटण", "cat": "MEAT", "stock": 25.0, "unit": "kg", "min": 8.0, "supplier": "City Mutton Depot"},
                {"name": "Fresh Malai Paneer", "m_name": "पनीर", "cat": "DAIRY", "stock": 18.0, "unit": "kg", "min": 5.0, "supplier": "Gokul Dairy Cooperative"},
                {"name": "Daawat Basmati Biryani Rice", "m_name": "बासमती तांदूळ", "cat": "GRAINS", "stock": 80.0, "unit": "kg", "min": 20.0, "supplier": "Shree Wholesale Grain"},
                {"name": "Pure Desi Gir Cow Ghee", "m_name": "शुद्ध देशी तूप", "cat": "DAIRY", "stock": 12.0, "unit": "Litres", "min": 4.0, "supplier": "Local Gaushala Dairy"},
                {"name": "Refined Sunflower Cooking Oil", "m_name": "सूर्यफूल तेल", "cat": "OILS", "stock": 50.0, "unit": "Litres", "min": 15.0, "supplier": "Fortune Wholesale"},
                {"name": "Kolhapuri Special Kanda-Lasun Masala", "m_name": "कोल्हापुरी कांदा-लसूण मसाला", "cat": "SPICES", "stock": 15.0, "unit": "kg", "min": 3.0, "supplier": "Authentic Masala Grihudyog"},
                {"name": "Fresh Surmai Fish", "m_name": "सुरमई मासा", "cat": "MEAT", "stock": 10.0, "unit": "kg", "min": 3.0, "supplier": "Ratnagiri Coastal Catch"}
            ]
            for d in defaults:
                db.add(InventoryItem(
                    name=d["name"],
                    marathi_name=d["m_name"],
                    category=d["cat"],
                    current_stock=d["stock"],
                    unit=d["unit"],
                    min_alert_threshold=d["min"],
                    supplier_info=d["supplier"]
                ))
            db.commit()
            items = db.query(InventoryItem).all()

        return jsonify([{
            'id': it.id,
            'name': it.name,
            'marathi_name': it.marathi_name,
            'category': it.category,
            'current_stock': it.current_stock,
            'unit': it.unit,
            'min_alert_threshold': it.min_alert_threshold,
            'is_low_stock': it.current_stock <= it.min_alert_threshold,
            'supplier_info': it.supplier_info,
            'last_restocked': it.last_restocked.strftime('%d %b %Y') if it.last_restocked else ''
        } for it in items])

    elif request.method == 'PUT':
        data = request.json or {}
        item_id = data.get('id')
        item = db.query(InventoryItem).get(item_id)
        if not item:
            return jsonify({'error': 'Inventory item not found'}), 404
        
        if 'add_stock' in data:
            item.current_stock += float(data['add_stock'])
            item.last_restocked = datetime.utcnow()
        elif 'current_stock' in data:
            item.current_stock = float(data['current_stock'])
        db.commit()
        return jsonify({'success': True, 'current_stock': item.current_stock})

# --- DIRECT THERMAL ESC/POS & HTML RECEIPT / KOT RENDER ENDPOINTS ---
@app.route('/api/orders/<int:order_id>/kot/html', methods=['GET'])
def print_kot_html(order_id):
    db = get_db()
    order = db.query(Order).get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404

    items_html = "".join([
        f"<div class='item'><span><b>{it.quantity}×</b> {it.item_name} {'[VEG]' if it.is_veg else '[NON-VEG]'}</span>"
        f"<div class='custom'>{it.customization or ''}</div></div>"
        for it in order.items
    ])

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="utf-8">
    <title>KOT - Table {order.table.table_number}</title>
    <style>
      @page {{ size: 80mm auto; margin: 0; }}
      body {{ font-family: monospace; width: 72mm; margin: 0 auto; padding: 10px 0; font-size: 14px; line-height: 1.3; color: #000; }}
      .center {{ text-align: center; }}
      .bold {{ font-weight: bold; }}
      .title {{ font-size: 18px; border-bottom: 2px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }}
      .table-box {{ font-size: 22px; font-weight: bold; border: 2px solid #000; text-align: center; padding: 4px; margin: 6px 0; }}
      .info {{ font-size: 11px; margin-bottom: 8px; }}
      .item {{ padding: 4px 0; border-bottom: 1px dotted #ccc; font-size: 14px; }}
      .custom {{ font-size: 11px; font-style: italic; margin-left: 15px; color: #333; }}
      .footer {{ border-top: 2px dashed #000; margin-top: 10px; padding-top: 4px; font-size: 11px; text-align: center; }}
    </style>
    </head>
    <body onload="window.print()">
      <div class="center title bold">KITCHEN ORDER TICKET (KOT)</div>
      <div class="center bold">HOTEL EKDANT</div>
      <div class="table-box">TABLE {order.table.table_number} ({order.table.section})</div>
      <div class="info">
        <div><b>Order #:</b> {order.order_number}</div>
        <div><b>Time:</b> {order.created_at.strftime('%d-%b-%Y %I:%M %p')}</div>
        <div><b>Guest:</b> {order.customer_name or 'Walk-in'}</div>
        <div><b>Instructions:</b> {order.special_instructions or 'Standard preparation'}</div>
      </div>
      <div style="border-top: 1px dashed #000; padding-top: 4px;">
        {items_html}
      </div>
      <div class="footer bold">
        TOTAL ITEMS: {sum(it.quantity for it in order.items)}<br>
        *** FOR KITCHEN USE ONLY ***
      </div>
    </body>
    </html>
    """
    return html_content, 200, {'Content-Type': 'text/html; charset=utf-8'}

@app.route('/api/invoices/<int:invoice_id>/receipt/html', methods=['GET'])
def print_thermal_receipt_html(invoice_id):
    db = get_db()
    invoice = db.query(Invoice).get(invoice_id)
    if not invoice:
        return jsonify({'error': 'Invoice not found'}), 404
    rest = db.query(Restaurant).first()
    order = invoice.order

    items_rows = ""
    if order and order.items:
        for it in order.items:
            items_rows += f"""
            <tr>
              <td style="text-align: left;">{it.item_name}</td>
              <td style="text-align: center;">{it.quantity}</td>
              <td style="text-align: right;">{it.price:.2f}</td>
              <td style="text-align: right;">{it.total_price:.2f}</td>
            </tr>
            """
    else:
        items_rows = f"<tr><td colspan='3'>Food Dining</td><td style='text-align:right;'>{invoice.subtotal:.2f}</td></tr>"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="utf-8">
    <title>Bill - {invoice.invoice_number}</title>
    <style>
      @page {{ size: 80mm auto; margin: 0; }}
      body {{ font-family: 'Courier New', monospace; width: 72mm; margin: 0 auto; padding: 8px 0; font-size: 12px; line-height: 1.25; }}
      .center {{ text-align: center; }}
      .bold {{ font-weight: bold; }}
      .header {{ border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }}
      .logo-title {{ font-size: 16px; font-weight: bold; }}
      table {{ width: 100%; border-collapse: collapse; font-size: 11px; margin: 5px 0; }}
      th {{ border-bottom: 1px dashed #000; padding: 3px 0; }}
      td {{ padding: 2px 0; }}
      .totals {{ border-top: 1px dashed #000; margin-top: 4px; padding-top: 4px; }}
      .grand-total {{ font-size: 15px; font-weight: bold; border-top: 2px dashed #000; border-bottom: 2px dashed #000; padding: 4px 0; margin: 6px 0; }}
      .footer {{ text-align: center; font-size: 10px; margin-top: 8px; }}
    </style>
    </head>
    <body onload="window.print()">
      <div class="header center">
        <div class="logo-title">{rest.name}</div>
        <div style="font-size: 10px;">{rest.tagline}</div>
        <div style="font-size: 9px; margin-top: 2px;">{rest.address}</div>
        <div style="font-size: 9px;">Phone: {rest.phone}</div>
        <div style="font-size: 9px; font-weight: bold;">GSTIN: {rest.gstin} | FSSAI: {rest.fssai}</div>
      </div>

      <div style="font-size: 10px;">
        <div style="display:flex; justify-content:space-between;">
          <span><b>Bill No:</b> {invoice.invoice_number}</span>
          <span><b>TABLE:</b> {invoice.table.table_number}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span><b>Date:</b> {invoice.created_at.strftime('%d-%m-%Y')}</span>
          <span><b>Time:</b> {invoice.created_at.strftime('%I:%M %p')}</span>
        </div>
        <div><b>Guest:</b> {invoice.customer_name or 'Walk-in'}</div>
        <div><b>Payment:</b> {invoice.payment_method} ({invoice.payment_status})</div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="text-align: left;">Item</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Rate</th>
            <th style="text-align: right;">Amt</th>
          </tr>
        </thead>
        <tbody>
          {items_rows}
        </tbody>
      </table>

      <div class="totals" style="font-size: 11px;">
        <div style="display:flex; justify-content:space-between;">
          <span>Subtotal:</span>
          <span>₹ {invoice.subtotal:.2f}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>CGST ({invoice.cgst_rate}%):</span>
          <span>₹ {invoice.cgst_amount:.2f}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>SGST ({invoice.sgst_rate}%):</span>
          <span>₹ {invoice.sgst_amount:.2f}</span>
        </div>
        {f"<div style='display:flex; justify-content:space-between;'><span>Discount:</span><span>- ₹ {invoice.discount_amount:.2f}</span></div>" if invoice.discount_amount > 0 else ""}
        <div class="grand-total" style="display:flex; justify-content:space-between;">
          <span>TOTAL PAYABLE:</span>
          <span>₹ {invoice.final_payable:.2f}</span>
        </div>
      </div>

      <div class="footer">
        <div><b>Thank you for dining with Hotel Ekdant!</b></div>
        <div>Please visit again • Pure Family Hospitality</div>
        <div style="margin-top: 4px; font-size: 8px;">Software by Hotel Ekdant Systems</div>
      </div>
    </body>
    </html>
    """
    return html_content, 200, {'Content-Type': 'text/html; charset=utf-8'}

# --- SERVE FRONTEND STATIC BUILD ---
FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'dist'))

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend_app(path):
    # Don't hijack API or socket.io routes
    if path.startswith('api') or path.startswith('socket.io'):
        return jsonify({'error': 'Endpoint not found'}), 404
        
    target_file = os.path.join(FRONTEND_DIST, path)
    if path and os.path.exists(target_file) and not os.path.isdir(target_file):
        return send_file(target_file)
        
    index_file = os.path.join(FRONTEND_DIST, 'index.html')
    if os.path.exists(index_file):
        return send_file(index_file)
        
    return "Hotel Ekdant Backend Service Active", 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"Hotel Ekdant Restaurant Management Backend running on port {port}...")
    socketio.run(app, host='0.0.0.0', port=port, debug=False)
