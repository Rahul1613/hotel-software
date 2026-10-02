import os
import hashlib
from app.auth_util import hash_password
from app.models import (
    SessionLocal, init_db, Restaurant, User, RestaurantTable, 
    MenuCategory, MenuItem, MenuItemAddon, Order, OrderItem,
    OrderStatusHistory, Invoice, Reservation, ServiceRequest, Review
)

def seed_database():
    init_db()
    db = SessionLocal()

    # Check if restaurant exists
    restaurant = db.query(Restaurant).first()
    if not restaurant:
        restaurant = Restaurant(
            name="Hotel Ekdant Family Restaurant",
            tagline="AC & Non-AC Family Dining • 23 Years of Authentic Hospitality",
            address="Near Shree Ganesh Mandir, Kolhapur Road, Maharashtra - 416001",
            phone="+91 98234 56789",
            whatsapp="+91 98234 56789",
            gstin="27AABCE1234F1Z5",
            fssai="11521034000189",
            opening_hours="11:00 AM - 11:30 PM (All 7 Days)",
            cgst_rate=2.5,
            sgst_rate=2.5,
            service_charge_rate=0.0,
            sound_alerts_enabled=True
        )
        db.add(restaurant)
        db.commit()
        db.refresh(restaurant)

    # Seed Staff accounts (Owner, Manager, Cashier, Waiter, Chefs, Cook, Admin)
    staff_data = [
        {"username": "admin", "full_name": "System Administrator", "role": "admin", "phone": "+91 98234 56788"},
        {"username": "owner", "full_name": "Suresh Patil (Proprietor)", "role": "owner", "phone": "+91 98234 56789"},
        {"username": "manager", "full_name": "Ramesh Jadhav (Manager)", "role": "manager", "phone": "+91 98234 56780"},
        {"username": "cashier", "full_name": "Kiran Shinde (Counter Cashier)", "role": "cashier", "phone": "+91 98234 56787"},
        {"username": "waiter", "full_name": "Santosh Shinde (Lead Waiter)", "role": "waiter", "phone": "+91 98234 56781"},
        {"username": "chef", "full_name": "Chef Anand Deshmukh (Head Chef)", "role": "chef", "phone": "+91 98234 56782"},
        {"username": "chef1", "full_name": "Chef Anand Deshmukh (Head Chef)", "role": "chef", "phone": "+91 98234 56782"},
        {"username": "chef2", "full_name": "Chef Nitin Kadam (Tandoor & Curry)", "role": "chef", "phone": "+91 98234 56783"},
        {"username": "chef3", "full_name": "Chef Sachin More (Chinese & Biryani)", "role": "chef", "phone": "+91 98234 56784"},
        {"username": "kitchen", "full_name": "Kitchen Display Station", "role": "chef", "phone": "+91 98234 56786"},
        {"username": "cook1", "full_name": "Ganesh Pawar (Kitchen Cook)", "role": "cook", "phone": "+91 98234 56785"},
    ]

    for staff in staff_data:
        existing_user = db.query(User).filter(User.username == staff["username"]).first()
        if not existing_user:
            user = User(
                restaurant_id=restaurant.id,
                username=staff["username"],
                password_hash=hash_password("ekdant123"),
                full_name=staff["full_name"],
                role=staff["role"],
                phone=staff["phone"],
                is_active=True
            )
            db.add(user)

    db.commit()

    # Seed 11 Tables (AC & Non-AC)
    existing_tables = db.query(RestaurantTable).count()
    if existing_tables == 0:
        table_configs = [
            {"num": "01", "name": "Table 01", "sec": "AC", "cap": 4},
            {"num": "02", "name": "Table 02", "sec": "AC", "cap": 4},
            {"num": "03", "name": "Table 03", "sec": "AC", "cap": 6},
            {"num": "04", "name": "Table 04", "sec": "AC", "cap": 6},
            {"num": "05", "name": "Table 05", "sec": "AC", "cap": 8},
            {"num": "06", "name": "Table 06", "sec": "NON_AC", "cap": 4},
            {"num": "07", "name": "Table 07", "sec": "NON_AC", "cap": 4},
            {"num": "08", "name": "Table 08", "sec": "NON_AC", "cap": 6},
            {"num": "09", "name": "Table 09", "sec": "NON_AC", "cap": 6},
            {"num": "10", "name": "Table 10", "sec": "NON_AC", "cap": 4},
            {"num": "11", "name": "Table 11", "sec": "NON_AC", "cap": 10},
        ]
        for cfg in table_configs:
            token = f"ekdant_qr_tbl_{cfg['num']}_{hashlib.md5(cfg['num'].encode()).hexdigest()[:8]}"
            tbl = RestaurantTable(
                restaurant_id=restaurant.id,
                table_number=cfg["num"],
                name=cfg["name"],
                section=cfg["sec"],
                capacity=cfg["cap"],
                status="AVAILABLE",
                qr_code_token=token,
                is_active=True
            )
            db.add(tbl)
        db.commit()

    # Seed 10 Categories as requested in spec:
    # 1. Veg, 2. Non-Veg, 3. Starters, 4. Chinese, 5. Rice and Biryani, 6. Indian Bread,
    # 7. Drinks and Beverages, 8. Snacks, 9. Desserts, 10. Additional Items.
    categories_data = [
        {"name": "Veg Specialties", "desc": "Authentic vegetarian delicacies made with fresh farm produce and rich Indian gravies", "order": 1, "veg": True, "non_veg": False},
        {"name": "Non-Veg Specialties", "desc": "Heritage Maharashtrian & Mughlai chicken, mutton and seafood curries", "order": 2, "veg": False, "non_veg": True},
        {"name": "Starters & Appetizers", "desc": "Crispy bites, tikkas and kababs grilled to perfection", "order": 3, "veg": False, "non_veg": False},
        {"name": "Chinese Corner", "desc": "Wok-tossed noodles, fried rice and sizzling gravies", "order": 4, "veg": False, "non_veg": False},
        {"name": "Rice and Biryani", "desc": "Aromatic dum biryanis and seasoned rice preparations with fragrant spices", "order": 5, "veg": False, "non_veg": False},
        {"name": "Indian Bread (Roti & Naan)", "desc": "Freshly baked in clay tandoor and traditional tawa rotis with pure ghee", "order": 6, "veg": True, "non_veg": False},
        {"name": "Drinks and Beverages", "desc": "Refreshing coolers, mocktails, classic lassi and hot beverages", "order": 7, "veg": True, "non_veg": False},
        {"name": "Evening Snacks", "desc": "Quick Maharashtrian tea-time snacks and savory delights", "order": 8, "veg": True, "non_veg": False},
        {"name": "Desserts & Sweets", "desc": "Traditional Indian sweets and ice creams to end your meal on a sweet note", "order": 9, "veg": True, "non_veg": False},
        {"name": "Accompaniments & Additional", "desc": "Papad, raita, green salads, extra gravies and roasted sides", "order": 10, "veg": True, "non_veg": False},
    ]

    cat_map = {}
    for cdata in categories_data:
        cat = db.query(MenuCategory).filter(MenuCategory.name == cdata["name"]).first()
        if not cat:
            cat = MenuCategory(
                restaurant_id=restaurant.id,
                name=cdata["name"],
                description=cdata["desc"],
                display_order=cdata["order"],
                is_veg_category=cdata["veg"],
                is_non_veg_category=cdata["non_veg"],
                is_active=True
            )
            db.add(cat)
            db.commit()
            db.refresh(cat)
        cat_map[cdata["name"]] = cat

    # Seed Comprehensive Realistic Menu Items
    menu_items_data = [
        # 1. Veg Specialties
        {
            "cat": "Veg Specialties", "name": "Paneer Butter Masala", "m_name": "पनीर बटर मसाला",
            "desc": "Cottage cheese simmered in velvety rich butter tomato gravy with aromatic kasuri methi",
            "price": 280.0, "veg": True, "food_type": "veg", "spice": "Medium", "special": True, "featured": True,
            "img": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80", "time": 15
        },
        {
            "cat": "Veg Specialties", "name": "Kaju Curry (Special)", "m_name": "काजू करी",
            "desc": "Roasted whole cashews cooked in rich golden onion-cashew paste and royal spices",
            "price": 320.0, "veg": True, "food_type": "veg", "spice": "Medium", "special": True, "featured": True,
            "img": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80", "time": 18
        },
        {
            "cat": "Veg Specialties", "name": "Veg Kolhapuri", "m_name": "व्हेज कोल्हापुरी",
            "desc": "Mixed farm vegetables cooked in famous spicy red Kolhapuri masala gravy",
            "price": 240.0, "veg": True, "food_type": "veg", "spice": "Kolhapuri Tikhat", "special": False, "featured": True,
            "img": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80", "time": 15
        },
        {
            "cat": "Veg Specialties", "name": "Dal Tadka Double Jeera", "m_name": "दाल तडका जीरा",
            "desc": "Yellow toor lentil tempered with desi ghee, burnt garlic, cumin and dry red chillies",
            "price": 190.0, "veg": True, "food_type": "veg", "spice": "Mild", "special": False, "featured": False,
            "img": "https://images.unsplash.com/photo-1546833998-877b37c2e5c6?auto=format&fit=crop&w=600&q=80", "time": 12
        },
        {
            "cat": "Veg Specialties", "name": "Palak Paneer", "m_name": "पालक पनीर",
            "desc": "Tender paneer cubes cooked in vibrant blended spinach puree tempered with garlic",
            "price": 260.0, "veg": True, "food_type": "veg", "spice": "Medium", "special": False, "featured": False,
            "img": "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", "time": 15
        },

        # 2. Non-Veg Specialties (NO RELIGIOUS CONTENT AT ALL)
        {
            "cat": "Non-Veg Specialties", "name": "Chicken Kolhapuri Sukka", "m_name": "चिकन कोल्हापुरी सुक्का",
            "desc": "Tender country chicken simmered in dry roasted coconut and authentic Kolhapuri whole spices",
            "price": 340.0, "veg": False, "food_type": "chicken", "spice": "Kolhapuri Tikhat", "special": True, "featured": True,
            "img": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80", "time": 20
        },
        {
            "cat": "Non-Veg Specialties", "name": "Butter Chicken Royale", "m_name": "बटर चिकन",
            "desc": "Charcoal grilled tandoori chicken cooked in creamy makhani tomato butter sauce",
            "price": 360.0, "veg": False, "food_type": "chicken", "spice": "Medium", "special": True, "featured": True,
            "img": "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=600&q=80", "time": 18
        },
        {
            "cat": "Non-Veg Specialties", "name": "Mutton Handi (Ekdant Special)", "m_name": "मटन हंडी",
            "desc": "Slow cooked fresh goat meat cooked in traditional earthenware clay pot with robust Maharashtrian spices",
            "price": 480.0, "veg": False, "food_type": "mutton", "spice": "Spicy", "special": True, "featured": True,
            "img": "https://images.unsplash.com/photo-1545247181-516773cae7be?auto=format&fit=crop&w=600&q=80", "time": 25
        },
        {
            "cat": "Non-Veg Specialties", "name": "Surmai Fish Curry", "m_name": "सुरमई फिश करी",
            "desc": "Fresh Kingfish steaks cooked in Konkani style spiced coconut and kokum curry",
            "price": 440.0, "veg": False, "food_type": "fish", "spice": "Medium", "special": False, "featured": False,
            "img": "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=600&q=80", "time": 20
        },
        {
            "cat": "Non-Veg Specialties", "name": "Egg Curry Double Masala", "m_name": "अंडा करी",
            "desc": "Boiled eggs shallow fried and cooked in rich brown onion tomato gravy",
            "price": 220.0, "veg": False, "food_type": "egg", "spice": "Medium", "special": False, "featured": False,
            "img": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80", "time": 15
        },

        # 3. Starters & Appetizers
        {
            "cat": "Starters & Appetizers", "name": "Paneer Tikka Angara", "m_name": "पनीर टिक्का अंगारा",
            "desc": "Spiced yogurt marinated paneer cubes smoked on skewers in charcoal tandoor",
            "price": 270.0, "veg": True, "food_type": "veg", "spice": "Spicy", "special": True, "featured": True,
            "img": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=600&q=80", "time": 15
        },
        {
            "cat": "Starters & Appetizers", "name": "Veg Crispy Masala", "m_name": "व्हेज क्रिस्पी",
            "desc": "Assorted crispy garden vegetables tossed in tangy sweet spicy Asian sauce",
            "price": 220.0, "veg": True, "food_type": "veg", "spice": "Medium", "special": False, "featured": False,
            "img": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80", "time": 12
        },
        {
            "cat": "Starters & Appetizers", "name": "Tandoori Chicken (Half / Full)", "m_name": "तंदूरी चिकन",
            "desc": "Succulent chicken leg & breast marinated with Kashmiri deggi mirch and roasted in tandoor",
            "price": 310.0, "veg": False, "food_type": "chicken", "spice": "Medium", "special": True, "featured": True,
            "img": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=600&q=80", "time": 20
        },
        {
            "cat": "Starters & Appetizers", "name": "Prawns Koliwada", "m_name": "प्रॉन्स कोळीवाडा",
            "desc": "Crispy golden spiced batter fried coastal prawns served with mint chutney and lemon wedges",
            "price": 420.0, "veg": False, "food_type": "fish", "spice": "Spicy", "special": True, "featured": False,
            "img": "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=600&q=80", "time": 15
        },

        # 4. Chinese Corner
        {
            "cat": "Chinese Corner", "name": "Veg Hakka Noodles", "m_name": "व्हेज हक्का नूडल्स",
            "desc": "Classic wok-tossed noodles with julienne bell peppers, cabbage, carrot and scallions",
            "price": 210.0, "veg": True, "food_type": "veg", "spice": "Mild", "special": False, "featured": False,
            "img": "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=600&q=80", "time": 12
        },
        {
            "cat": "Chinese Corner", "name": "Chicken Schezwan Fried Rice", "m_name": "चिकन शेजवान फ्राईड राइस",
            "desc": "Spicy wok tossed basmati rice with minced chicken, scrambled egg and fiery Schezwan sauce",
            "price": 260.0, "veg": False, "food_type": "chicken", "spice": "Spicy", "special": False, "featured": True,
            "img": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80", "time": 14
        },
        {
            "cat": "Chinese Corner", "name": "Veg Manchurian Dry / Gravy", "m_name": "व्हेज मंचुरियन",
            "desc": "Crisp vegetable dumplings tossed with ginger, garlic, soya and spring onions",
            "price": 220.0, "veg": True, "food_type": "veg", "spice": "Medium", "special": False, "featured": False,
            "img": "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=600&q=80", "time": 12
        },

        # 5. Rice and Biryani
        {
            "cat": "Rice and Biryani", "name": "Hyderabadi Chicken Dum Biryani", "m_name": "चिकन दम बिर्याणी",
            "desc": "Layered long grain basmati rice, tender marinated chicken, saffron and caramelized onions cooked on dum",
            "price": 320.0, "veg": False, "food_type": "chicken", "spice": "Medium", "special": True, "featured": True,
            "img": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80", "time": 20
        },
        {
            "cat": "Rice and Biryani", "name": "Shahi Veg Dum Biryani", "m_name": "शाही व्हेज दम बिर्याणी",
            "desc": "Fragrant basmati rice infused with whole spices, paneer cubes, garden veggies and pure desi ghee",
            "price": 260.0, "veg": True, "food_type": "veg", "spice": "Medium", "special": False, "featured": True,
            "img": "https://images.unsplash.com/photo-1642821373181-696a54913e9a?auto=format&fit=crop&w=600&q=80", "time": 18
        },
        {
            "cat": "Rice and Biryani", "name": "Jeera Rice with Pure Ghee", "m_name": "जीरा राइस",
            "desc": "Steamed basmati rice tempered with cumin seeds, whole cardamoms and desi ghee",
            "price": 160.0, "veg": True, "food_type": "veg", "spice": "Mild", "special": False, "featured": False,
            "img": "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=600&q=80", "time": 10
        },

        # 6. Indian Bread
        {
            "cat": "Indian Bread (Roti & Naan)", "name": "Butter Garlic Naan", "m_name": "बटर गार्लिक नान",
            "desc": "Tandoor baked refined flour bread infused with fresh minced garlic and topped with pure butter",
            "price": 65.0, "veg": True, "food_type": "veg", "spice": "Mild", "special": False, "featured": True,
            "img": "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", "time": 8
        },
        {
            "cat": "Indian Bread (Roti & Naan)", "name": "Butter Roti (Tandoori)", "m_name": "बटर रोटी",
            "desc": "Traditional whole wheat flatbread baked in clay oven and brushed with butter",
            "price": 30.0, "veg": True, "food_type": "veg", "spice": "Mild", "special": False, "featured": False,
            "img": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80", "time": 6
        },
        {
            "cat": "Indian Bread (Roti & Naan)", "name": "Jowar Bhakri (Maharashtrian)", "m_name": "ज्वारीची भाकरी",
            "desc": "Healthy traditional rustic sorghum flatbread hand-patted and baked on iron tawa",
            "price": 35.0, "veg": True, "food_type": "veg", "spice": "Mild", "special": True, "featured": True,
            "img": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80", "time": 10
        },

        # 7. Drinks and Beverages
        {
            "cat": "Drinks and Beverages", "name": "Special Solkadhi (Kokum & Coconut)", "m_name": "सोलकढी",
            "desc": "Traditional Konkani digestive cooler made with fresh coconut milk, kokum extract, garlic and green chillies",
            "price": 80.0, "veg": True, "food_type": "veg", "spice": "Mild", "special": True, "featured": True,
            "img": "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80", "time": 5
        },
        {
            "cat": "Drinks and Beverages", "name": "Mango Lassi (Malai Topped)", "m_name": "मॅंगो लस्सी",
            "desc": "Thick chilled Alphonso mango pulp blended with rich fresh yogurt and cardamom",
            "price": 95.0, "veg": True, "food_type": "veg", "spice": "Mild", "special": False, "featured": True,
            "img": "https://images.unsplash.com/photo-1527661591475-527312dd65f5?auto=format&fit=crop&w=600&q=80", "time": 5
        },
        {
            "cat": "Drinks and Beverages", "name": "Fresh Lime Soda (Sweet & Salt)", "m_name": "फ्रेश लाईम सोडा",
            "desc": "Sparkling soda with freshly squeezed green lemons and balanced rock salt syrup",
            "price": 60.0, "veg": True, "food_type": "veg", "spice": "Mild", "special": False, "featured": False,
            "img": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80", "time": 5
        },

        # 8. Evening Snacks
        {
            "cat": "Evening Snacks", "name": "Kolhapuri Misal Pav Special", "m_name": "कोल्हापुरी मिसळ पाव",
            "desc": "Spicy sprouted moth bean curry topped with farsan, onions, coriander and soft pav with extra sample gravy",
            "price": 120.0, "veg": True, "food_type": "veg", "spice": "Kolhapuri Tikhat", "special": True, "featured": True,
            "img": "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80", "time": 10
        },
        {
            "cat": "Evening Snacks", "name": "Batata Vada (Plate of 2)", "m_name": "बटाटा वडा",
            "desc": "Spiced mashed potato fritters coated in gram flour batter and deep fried golden with spicy garlic thecha",
            "price": 70.0, "veg": True, "food_type": "veg", "spice": "Medium", "special": False, "featured": False,
            "img": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80", "time": 8
        },

        # 9. Desserts & Sweets
        {
            "cat": "Desserts & Sweets", "name": "Hot Gulab Jamun with Rabdi", "m_name": "गुलाब जामुन विथ रबडी",
            "desc": "Two soft khoya dumplings in cardamom rose sugar syrup served alongside thick kesar rabdi",
            "price": 140.0, "veg": True, "food_type": "veg", "spice": "Mild", "special": True, "featured": True,
            "img": "https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=600&q=80", "time": 5
        },
        {
            "cat": "Desserts & Sweets", "name": "Sizzling Brownie with Vanilla Ice Cream", "m_name": "ब्राऊनी विथ आईस्क्रीम",
            "desc": "Warm chocolate walnut brownie placed on a sizzling hot cast iron plate, topped with vanilla scoop and dark fudge",
            "price": 180.0, "veg": True, "food_type": "veg", "spice": "Mild", "special": False, "featured": True,
            "img": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80", "time": 8
        },

        # 10. Additional Items
        {
            "cat": "Accompaniments & Additional", "name": "Roasted Masala Papad", "m_name": "मसाला पापड",
            "desc": "Crispy urad dal papad topped with diced tomatoes, onions, chaat masala, lemon and fresh coriander",
            "price": 45.0, "veg": True, "food_type": "veg", "spice": "Medium", "special": False, "featured": False,
            "img": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80", "time": 5
        },
        {
            "cat": "Accompaniments & Additional", "name": "Mixed Veg Boondi Raita", "m_name": "बुंदी रायता",
            "desc": "Whipped fresh curd with roasted cumin powder, black salt, cucumber, onion and crunchy boondi",
            "price": 80.0, "veg": True, "food_type": "veg", "spice": "Mild", "special": False, "featured": False,
            "img": "https://images.unsplash.com/photo-1546833998-877b37c2e5c6?auto=format&fit=crop&w=600&q=80", "time": 5
        },
    ]

    for item_data in menu_items_data:
        cat = cat_map[item_data["cat"]]
        existing_item = db.query(MenuItem).filter(MenuItem.name == item_data["name"]).first()
        if not existing_item:
            item = MenuItem(
                restaurant_id=restaurant.id,
                category_id=cat.id,
                name=item_data["name"],
                marathi_name=item_data["m_name"],
                description=item_data["desc"],
                price=item_data["price"],
                is_veg=item_data["veg"],
                food_type=item_data["food_type"],
                spice_level=item_data["spice"],
                is_available=True,
                is_special=item_data["special"],
                is_featured=item_data["featured"],
                image_url=item_data["img"],
                preparation_time_mins=item_data["time"]
            )
            db.add(item)
            db.commit()
            db.refresh(item)

            # Add common addons
            if item.is_veg and "Paneer" in item.name:
                db.add(MenuItemAddon(item_id=item.id, name="Extra Cheese / Paneer Cube", price=40.0))
                db.add(MenuItemAddon(item_id=item.id, name="Double Butter Topping", price=25.0))
            elif not item.is_veg and "Chicken" in item.name:
                db.add(MenuItemAddon(item_id=item.id, name="Extra Gravy Bowl", price=50.0))
                db.add(MenuItemAddon(item_id=item.id, name="Boneless Portion Upgrade", price=60.0))
            elif "Biryani" in item.name:
                db.add(MenuItemAddon(item_id=item.id, name="Extra Salan / Raita", price=30.0))
                db.add(MenuItemAddon(item_id=item.id, name="Extra Fried Onions (Birista)", price=20.0))
            db.commit()

    # Seed Sample Reviews from actual happy family patrons
    existing_reviews = db.query(Review).count()
    if existing_reviews == 0:
        reviews_data = [
            {"name": "Adv. Rajesh Kulkarni", "rating": 5, "food": 5, "service": 5, "clean": 5, "comment": "Hotel Ekdant has been our family's favorite dining destination for 15+ years. The Mutton Handi and Paneer Butter Masala are unmatched in taste. Very clean AC dining and fast service!"},
            {"name": "Dr. Sneha Patil", "rating": 5, "food": 5, "service": 4, "clean": 5, "comment": "Visited with our medical college team. The Kolhapuri Misal and Solkadhi are authentic! QR ordering from table was super quick and transparent. Loved the traditional hospitality."},
            {"name": "Mahesh Shinde", "rating": 5, "food": 5, "service": 5, "clean": 4, "comment": "Authentic taste, courteous staff, and very pocket-friendly family restaurant. Table 05 has great AC cooling and quick service."},
        ]
        for rev in reviews_data:
            r = Review(
                restaurant_id=restaurant.id,
                customer_name=rev["name"],
                rating=rev["rating"],
                food_rating=rev["food"],
                service_rating=rev["service"],
                cleanliness_rating=rev["clean"],
                comment=rev["comment"],
                reply="Thank you for your warm blessing and patronage! Looking forward to hosting you again at Hotel Ekdant.",
                is_approved=True
            )
            db.add(r)
        db.commit()

    db.close()
    print("Database seeded successfully with Hotel Ekdant information!")

if __name__ == "__main__":
    seed_database()
