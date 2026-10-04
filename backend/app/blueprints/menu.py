import os
import uuid
from werkzeug.utils import secure_filename
from PIL import Image
from flask import Blueprint, request, jsonify, g
from app.models import SessionLocal, MenuCategory, MenuItem, MenuItemAddon, AuditLog
from app.auth import require_role
from app.money import rupees_to_paise, paise_to_rupees, now_utc
from app.config import Config

menu_bp = Blueprint('menu', __name__, url_prefix='/api')

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- CATEGORIES ---

@menu_bp.route('/categories', methods=['GET'])
def list_categories():
    """Public active categories list."""
    db = SessionLocal()
    try:
        cats = db.query(MenuCategory).filter(MenuCategory.is_active == True).order_by(MenuCategory.display_order).all()
        return jsonify([{
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "kitchen_station": c.kitchen_station,
            "is_veg_category": c.is_veg_category,
            "is_non_veg_category": c.is_non_veg_category,
            "display_order": c.display_order
        } for c in cats])
    finally:
        db.close()

@menu_bp.route('/categories', methods=['POST'])
@require_role("owner", "manager")
def create_category():
    data = request.json or {}
    name = str(data.get('name', '')).strip()
    if not name:
        return jsonify({"error": {"code": "BAD_REQUEST", "message": "Category name required."}}), 400

    db = SessionLocal()
    try:
        cat = MenuCategory(
            name=name,
            description=data.get('description'),
            kitchen_station=data.get('kitchen_station', 'CURRY_TANDOOR'),
            is_veg_category=bool(data.get('is_veg_category', False)),
            is_non_veg_category=bool(data.get('is_non_veg_category', False)),
            display_order=int(data.get('display_order', 0)),
            is_active=True
        )
        db.add(cat)
        db.commit()
        return jsonify({"message": "Category created.", "id": cat.id}), 201
    finally:
        db.close()

@menu_bp.route('/categories/<int:cat_id>', methods=['PUT'])
@require_role("owner", "manager")
def update_category(cat_id):
    data = request.json or {}
    db = SessionLocal()
    try:
        cat = db.query(MenuCategory).get(cat_id)
        if not cat:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Category not found."}}), 404

        if "name" in data: cat.name = data["name"]
        if "description" in data: cat.description = data["description"]
        if "kitchen_station" in data: cat.kitchen_station = data["kitchen_station"]
        if "is_veg_category" in data: cat.is_veg_category = bool(data["is_veg_category"])
        if "is_non_veg_category" in data: cat.is_non_veg_category = bool(data["is_non_veg_category"])
        if "display_order" in data: cat.display_order = int(data["display_order"])
        if "is_active" in data: cat.is_active = bool(data["is_active"])

        db.commit()
        return jsonify({"message": "Category updated."})
    finally:
        db.close()

@menu_bp.route('/categories/<int:cat_id>', methods=['DELETE'])
@require_role("owner")
def delete_category(cat_id):
    """Soft delete category."""
    db = SessionLocal()
    try:
        cat = db.query(MenuCategory).get(cat_id)
        if not cat:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Category not found."}}), 404
        cat.is_active = False
        db.commit()
        return jsonify({"message": "Category archived."})
    finally:
        db.close()

# --- MENU ITEMS ---

@menu_bp.route('/menu', methods=['GET'])
def list_menu():
    """List menu items with filtering and integer paise prices."""
    cat_id = request.args.get('category_id')
    veg_only = request.args.get('veg_only') == 'true'
    non_veg_only = request.args.get('non_veg_only') == 'true'
    search = request.args.get('search')
    include_unavailable = request.args.get('include_unavailable') == 'true'

    from app.auth import get_current_user
    user = get_current_user()
    can_view_costs = user is not None and user.role.lower() in ("owner", "manager")

    db = SessionLocal()
    try:
        query = db.query(MenuItem).filter(MenuItem.is_active == True)
        if not include_unavailable:
            query = query.filter(MenuItem.is_available == True)
        if cat_id:
            query = query.filter(MenuItem.category_id == int(cat_id))
        if veg_only:
            query = query.filter(MenuItem.is_veg == True)
        if non_veg_only:
            query = query.filter(MenuItem.is_veg == False)
        if search:
            query = query.filter(MenuItem.name.ilike(f"%{search}%"))

        items = query.order_by(MenuItem.sort_order, MenuItem.name).all()
        result = []
        for it in items:
            item_data = {
                "id": it.id,
                "category_id": it.category_id,
                "category_name": it.category.name if it.category else "",
                "kitchen_station": it.category.kitchen_station if it.category else "CURRY_TANDOOR",
                "name": it.name,
                "marathi_name": it.marathi_name,
                "description": it.description,
                "price": paise_to_rupees(it.price), # Returns float for client display
                "price_paise": it.price,
                "is_veg": it.is_veg,
                "food_type": it.food_type,
                "spice_level": it.spice_level,
                "is_available": it.is_available,
                "is_special": it.is_special,
                "is_featured": it.is_featured,
                "image_url": it.image_url,
                "preparation_time_mins": it.preparation_time_mins,
                "addons": [{
                    "id": a.id,
                    "name": a.name,
                    "price": paise_to_rupees(a.price),
                    "price_paise": a.price
                } for a in it.addons if a.is_active]
            }
            if can_view_costs:
                item_data["preparation_cost"] = paise_to_rupees(it.preparation_cost or 0)
            result.append(item_data)
        return jsonify(result)
    finally:
        db.close()

@menu_bp.route('/menu', methods=['POST'])
@require_role("owner", "manager")
def create_menu_item():
    data = request.json or {}
    name = str(data.get('name', '')).strip()
    price_val = data.get('price')
    category_id = data.get('category_id')

    if not name or price_val is None or not category_id:
        return jsonify({"error": {"code": "BAD_REQUEST", "message": "Name, price, and category required."}}), 400

    price_paise = rupees_to_paise(price_val)
    prep_cost_paise = rupees_to_paise(data.get('preparation_cost', 0))

    db = SessionLocal()
    try:
        item = MenuItem(
            category_id=int(category_id),
            name=name,
            marathi_name=data.get('marathi_name'),
            description=data.get('description'),
            price=price_paise,
            preparation_cost=prep_cost_paise,
            is_veg=bool(data.get('is_veg', True)),
            food_type=data.get('food_type', 'veg'),
            spice_level=data.get('spice_level', 'Medium'),
            is_available=bool(data.get('is_available', True)),
            is_special=bool(data.get('is_special', False)),
            is_featured=bool(data.get('is_featured', False)),
            image_url=data.get('image_url'),
            preparation_time_mins=int(data.get('preparation_time_mins', 15)),
            is_active=True
        )
        db.add(item)
        db.commit()

        # Audit
        db.add(AuditLog(
            user_id=g.current_user.id,
            action="MENU_ITEM_CREATED",
            entity_type="MenuItem",
            entity_id=str(item.id),
            new_value={"name": name, "price_paise": price_paise, "preparation_cost_paise": prep_cost_paise}
        ))
        db.commit()

        return jsonify({"message": "Menu item created.", "id": item.id}), 201
    finally:
        db.close()

@menu_bp.route('/menu/<int:item_id>', methods=['PUT'])
@require_role("owner", "manager")
def update_menu_item(item_id):
    data = request.json or {}
    db = SessionLocal()
    try:
        item = db.query(MenuItem).get(item_id)
        if not item:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Item not found."}}), 404

        old_state = {"price": item.price, "is_available": item.is_available}

        for k in ['name', 'marathi_name', 'description', 'category_id', 'food_type', 'spice_level', 'image_url']:
            if k in data:
                setattr(item, k, data[k])

        if 'price' in data:
            item.price = rupees_to_paise(data['price'])
        if 'preparation_cost' in data:
            item.preparation_cost = rupees_to_paise(data['preparation_cost'])
        if 'is_veg' in data: item.is_veg = bool(data['is_veg'])
        if 'is_available' in data: item.is_available = bool(data['is_available'])
        if 'is_special' in data: item.is_special = bool(data['is_special'])
        if 'is_featured' in data: item.is_featured = bool(data['is_featured'])
        if 'preparation_time_mins' in data: item.preparation_time_mins = int(data['preparation_time_mins'])

        db.commit()

        # Emit live availability change if toggled
        if 'is_available' in data or 'is_special' in data:
            from app.sockets import emit_broadcast
            emit_broadcast("item_availability_changed", {
                "item_id": item.id,
                "is_available": item.is_available,
                "is_special": item.is_special
            })

        # Audit
        db.add(AuditLog(
            user_id=g.current_user.id,
            action="MENU_ITEM_UPDATED",
            entity_type="MenuItem",
            entity_id=str(item.id),
            old_value=old_state,
            new_value={"price": item.price, "is_available": item.is_available}
        ))
        db.commit()

        return jsonify({"message": "Item updated.", "id": item.id})
    finally:
        db.close()

@menu_bp.route('/menu/<int:item_id>', methods=['DELETE'])
@require_role("owner")
def delete_menu_item(item_id):
    """Soft delete menu item."""
    db = SessionLocal()
    try:
        item = db.query(MenuItem).get(item_id)
        if not item:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Item not found."}}), 404
        item.is_active = False
        db.commit()

        # Audit
        db.add(AuditLog(
            user_id=g.current_user.id,
            action="MENU_ITEM_ARCHIVED",
            entity_type="MenuItem",
            entity_id=str(item.id),
            old_value={"name": item.name}
        ))
        db.commit()
        return jsonify({"message": "Item archived successfully."})
    finally:
        db.close()

@menu_bp.route('/menu/<int:item_id>/addons', methods=['POST'])
@require_role("owner", "manager")
def add_menu_addon(item_id):
    data = request.json or {}
    name = str(data.get('name', '')).strip()
    price_val = data.get('price', 0)

    if not name:
        return jsonify({"error": {"code": "BAD_REQUEST", "message": "Addon name required."}}), 400

    db = SessionLocal()
    try:
        addon = MenuItemAddon(
            item_id=item_id,
            name=name,
            price=rupees_to_paise(price_val),
            is_active=True
        )
        db.add(addon)
        db.commit()
        return jsonify({"message": "Addon added.", "id": addon.id}), 201
    finally:
        db.close()

@menu_bp.route('/menu/upload-image', methods=['POST'])
@require_role("owner", "manager")
def upload_menu_image():
    """Upload dish image safely with size ≤ 2MB, resizing with Pillow."""
    if 'image' not in request.files:
        return jsonify({"error": {"code": "BAD_REQUEST", "message": "No file uploaded."}}), 400
    file = request.files['image']
    if not file or file.filename == '':
        return jsonify({"error": {"code": "BAD_REQUEST", "message": "Empty file."}}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": {"code": "INVALID_FORMAT", "message": "Allowed formats: png, jpg, jpeg, webp."}}), 400

    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    filename = f"{uuid.uuid4().hex}_{secure_filename(file.filename)}"
    filepath = os.path.join(Config.UPLOAD_FOLDER, filename)

    try:
        img = Image.open(file.stream)
        # Resize to max 1200x800 while maintaining aspect ratio
        img.thumbnail((1200, 800))
        img.save(filepath, optimize=True, quality=85)

        image_url = f"/uploads/{filename}"
        return jsonify({"message": "Image uploaded.", "image_url": image_url})
    except Exception as e:
        return jsonify({"error": {"code": "IMAGE_ERROR", "message": f"Failed to process image: {str(e)}"}}), 500
