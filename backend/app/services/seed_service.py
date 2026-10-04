import uuid
from app.models import SessionLocal, Restaurant, User, RestaurantTable, MenuCategory, MenuItem, InventoryItem
from app.auth import hash_password
from app.money import rupees_to_paise, now_utc
from app.config import Config

def seed_database(force: bool = False):
    """
    Idempotent database seeding for Hotel Ekdant.
    Never duplicates or resurrects deleted data.
    Uses INITIAL_OWNER_PASSWORD env variable.
    """
    db = SessionLocal()
    try:
        # 1. Restaurant row
        rest = db.query(Restaurant).first()
        if not rest:
            print("Seeding Restaurant info...")
            rest = Restaurant(
                name="Hotel Ekdant Family Restaurant",
                tagline="AC & Non-AC Family Dining • Authentic Hospitality",
                address="Near Shree Ganesh Mandir, Main Road, Maharashtra - 416001",
                phone="+91 98234 56789",
                whatsapp="+91 98234 56789",
                gstin="27AABCE1234F1Z5", # Legal format placeholder
                fssai="11521034000189",
                opening_hours="11:00 AM - 11:30 PM (All 7 Days)",
                cgst_rate=2.5,
                sgst_rate=2.5,
                invoice_prefix="EK",
                upi_id="ekdant@upi"
            )
            db.add(rest)
            db.commit()

        owner_pass = "TestPassword123!" if Config.TESTING else Config.INITIAL_OWNER_PASSWORD
        initial_users = [
            ("owner", owner_pass, "Shree Ekdant Owner", "owner"),
            ("manager", "Manager@2026", "Operations Manager", "manager"),
            ("cashier", "Cashier@2026", "Front Billing Cashier", "cashier"),
            ("waiter1", "Waiter@2026", "Table Captain Ramesh", "waiter"),
            ("chef1", "Chef@2026", "Head Chef Santosh", "chef"),
        ]
        for uname, pwd, fname, role in initial_users:
            u = db.query(User).filter(User.username == uname).first()
            if not u:
                print(f"Creating staff account: {uname} ({role})")
                new_u = User(
                    username=uname,
                    password_hash=hash_password(pwd),
                    full_name=fname,
                    role=role,
                    is_active=True,
                    must_change_password=(uname == "owner")
                )
                db.add(new_u)
        db.commit()

        # 3. 11 Tables
        existing_tables_count = db.query(RestaurantTable).count()
        if existing_tables_count == 0:
            print("Seeding 11 dining tables...")
            for i in range(1, 12):
                tbl_num = f"{i:02d}"
                sec = "AC" if i <= 5 else "NON_AC"
                cap = 4 if i not in [5, 11] else 6
                t = RestaurantTable(
                    table_number=tbl_num,
                    name=f"Table {tbl_num}",
                    section=sec,
                    capacity=cap,
                    qr_code_token=str(uuid.uuid4()),
                    is_active=True
                )
                db.add(t)
            db.commit()

        # 4. Categories & Menu Items
        if db.query(MenuCategory).count() == 0:
            print("Seeding menu categories and dishes...")
            cats_data = [
                ("Special Thalis", "पारंपारिक थाळी", "CURRY_TANDOOR", 1),
                ("Maharashtrian Starters", "स्टार्टर्स", "CURRY_TANDOOR", 2),
                ("Chicken & Mutton Special", "नॉन-व्हेज स्पेशल", "CURRY_TANDOOR", 3),
                ("Seafood Coastal Catch", "सीफूड", "CURRY_TANDOOR", 4),
                ("Biryani & Fragrant Rice", "दम बिर्याणी", "RICE_BIRYANI", 5),
                ("Roti, Naan & Bhakri", "रोटी व भाकरी", "CURRY_TANDOOR", 6),
                ("Desserts & Beverages", "पेये आणि गोड", "BEVERAGE", 7),
            ]
            cat_map = {}
            for name, desc, station, order in cats_data:
                c = MenuCategory(
                    name=name,
                    description=desc,
                    kitchen_station=station,
                    display_order=order,
                    is_active=True
                )
                db.add(c)
                db.commit()
                cat_map[name] = c.id

            dishes = [
                # Thalis
                ("Special Ekdant Mutton Thali", "स्पेशल एकदंत मटण थाळी", cat_map["Special Thalis"], 420, False, "mutton", "Kolhapuri Tikhat"),
                ("Gavran Chicken Thali", "गावरान चिकन थाळी", cat_map["Special Thalis"], 360, False, "chicken", "Spicy"),
                ("Shahi Paneer Deluxe Thali", "शाही पनीर थाळी", cat_map["Special Thalis"], 260, True, "veg", "Medium"),
                # Starters
                ("Kolhapuri Chicken Sukka", "कोल्हापुरी चिकन सुक्का", cat_map["Maharashtrian Starters"], 290, False, "chicken", "Spicy"),
                ("Kaju Kothimbir Vadi", "काजू कोथिंबीर वडी", cat_map["Maharashtrian Starters"], 180, True, "veg", "Medium"),
                # Mains
                ("Mutton Kolhapuri Rassa", "मटण कोल्हापुरी तांबडा रस्सा", cat_map["Chicken & Mutton Special"], 340, False, "mutton", "Kolhapuri Tikhat"),
                ("Chicken Handi Lazeez", "चिकन हांडी लजीज", cat_map["Chicken & Mutton Special"], 310, False, "chicken", "Medium"),
                ("Paneer Tikka Masala", "पनीर टिक्का मसाला", cat_map["Chicken & Mutton Special"], 250, True, "veg", "Medium"),
                # Seafood
                ("Surmai Malvani Fry", "सुरमई मालवणी फ्राय", cat_map["Seafood Coastal Catch"], 390, False, "fish", "Spicy"),
                # Biryani
                ("Ekdant Dum Mutton Biryani", "एकदंत मटण दम बिर्याणी", cat_map["Biryani & Fragrant Rice"], 380, False, "mutton", "Medium"),
                ("Chicken Dum Biryani", "चिकन दम बिर्याणी", cat_map["Biryani & Fragrant Rice"], 280, False, "chicken", "Medium"),
                # Breads
                ("Jowar Bhakri (Fresh)", "गरमागरम ज्वारीची भाकरी", cat_map["Roti, Naan & Bhakri"], 35, True, "veg", "Mild"),
                ("Butter Naan", "बटर नान", cat_map["Roti, Naan & Bhakri"], 50, True, "veg", "Mild"),
                # Beverages
                ("Solkadhi (Fresh Coconut & Kokum)", "सोलकढी", cat_map["Desserts & Beverages"], 60, True, "veg", "Mild"),
                ("Gulab Jamun (2 pcs)", "गुलाब जामुन", cat_map["Desserts & Beverages"], 80, True, "veg", "Mild"),
            ]

            for name, m_name, cid, price_rs, is_veg, ftype, spice in dishes:
                prep_cost = round(price_rs * 0.38)
                item = MenuItem(
                    category_id=cid,
                    name=name,
                    marathi_name=m_name,
                    price=rupees_to_paise(price_rs),
                    preparation_cost=rupees_to_paise(prep_cost),
                    is_veg=is_veg,
                    food_type=ftype,
                    spice_level=spice,
                    is_available=True,
                    is_special=True if "Ekdant" in name else False,
                    preparation_time_mins=20 if not is_veg else 15,
                    is_active=True
                )
                db.add(item)
            db.commit()

        # 5. Inventory Items
        if db.query(InventoryItem).count() == 0:
            print("Seeding inventory raw materials...")
            inv_defaults = [
                ("Fresh Country Chicken", "ताजे गावरान चिकन", "MEAT", 45.0, "kg", 10.0, "Kolhapur Poultry"),
                ("Fresh Goat Mutton", "मटण", "MEAT", 25.0, "kg", 8.0, "City Mutton Depot"),
                ("Fresh Malai Paneer", "पनीर", "DAIRY", 18.0, "kg", 5.0, "Gokul Dairy Cooperative"),
                ("Daawat Basmati Biryani Rice", "बासमती तांदूळ", "GRAINS", 80.0, "kg", 20.0, "Shree Wholesale"),
                ("Pure Desi Gir Cow Ghee", "शुद्ध देशी तूप", "DAIRY", 12.0, "Litres", 4.0, "Local Gaushala"),
                ("Refined Sunflower Cooking Oil", "सूर्यफूल तेल", "OILS", 50.0, "Litres", 15.0, "Fortune Wholesale"),
                ("Kolhapuri Kanda-Lasun Masala", "कोल्हापुरी कांदा-लसूण मसाला", "SPICES", 15.0, "kg", 3.0, "Authentic Grihudyog"),
                ("Fresh Surmai Fish", "सुरमई मासा", "MEAT", 10.0, "kg", 3.0, "Ratnagiri Coastal Catch"),
            ]
            for name, m_name, cat, stock, unit, min_alert, sup in inv_defaults:
                db.add(InventoryItem(
                    name=name,
                    marathi_name=m_name,
                    category=cat,
                    current_stock=stock,
                    unit=unit,
                    min_alert_threshold=min_alert,
                    supplier_info=sup
                ))
            db.commit()

        print("Idempotent seed completed successfully.")
    finally:
        db.close()
