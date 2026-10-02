import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.models import SessionLocal, MenuCategory, MenuItem, MenuItemAddon

def add_expanded_menu():
    db = SessionLocal()

    # Find categories
    veg_cat = db.query(MenuCategory).filter(MenuCategory.name.like("%Veg Specialties%")).first()
    nonveg_cat = db.query(MenuCategory).filter(MenuCategory.name.like("%Non-Veg%")).first()
    starter_cat = db.query(MenuCategory).filter(MenuCategory.name.like("%Starter%")).first()
    rice_cat = db.query(MenuCategory).filter(MenuCategory.name.like("%Rice%")).first()
    bread_cat = db.query(MenuCategory).filter(MenuCategory.name.like("%Bread%")).first()
    drink_cat = db.query(MenuCategory).filter(MenuCategory.name.like("%Drink%")).first()

    new_dishes = [
        # --- NEW SEAFOOD / FISH DELICACIES ---
        {
            "cat_id": nonveg_cat.id,
            "name": "Surmai Tawa Fry (Kingfish)",
            "m_name": "सुरमई तवा फ्राय",
            "desc": "Fresh slice of kingfish marinated in coastal kokum, garlic thecha and rava coated on cast iron tawa",
            "price": 460.0,
            "veg": False,
            "food_type": "fish",
            "spice": "Spicy",
            "special": True,
            "featured": True,
            "img": "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=600&q=80",
            "time": 18
        },
        {
            "cat_id": nonveg_cat.id,
            "name": "Pomfret Rava Fry (Full)",
            "m_name": "पापलेट रवा फ्राय",
            "desc": "Crispy golden whole silver pomfret crusted with semolina, deggi mirch and lemon wedges",
            "price": 520.0,
            "veg": False,
            "food_type": "fish",
            "spice": "Medium",
            "special": True,
            "featured": True,
            "img": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=80",
            "time": 20
        },
        {
            "cat_id": nonveg_cat.id,
            "name": "Prawns Masala Malvani Curry",
            "m_name": "कोळंबी मसाला मालवणी",
            "desc": "Juicy sea prawns simmered in freshly ground roasted coconut and Malvani masala gravy",
            "price": 440.0,
            "veg": False,
            "food_type": "fish",
            "spice": "Spicy",
            "special": False,
            "featured": True,
            "img": "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=600&q=80",
            "time": 16
        },
        {
            "cat_id": nonveg_cat.id,
            "name": "Bangda Masala (Mackerel Curry)",
            "m_name": "बांगडा मसाला करी",
            "desc": "Authentic coastal spicy and tangy mackerel curry cooked with dried kokum and whole spices",
            "price": 280.0,
            "veg": False,
            "food_type": "fish",
            "spice": "Kolhapuri Tikhat",
            "special": False,
            "featured": False,
            "img": "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=600&q=80",
            "time": 15
        },

        # --- NEW CHICKEN & MUTTON SPECIALTIES ---
        {
            "cat_id": nonveg_cat.id,
            "name": "Mutton Kolhapuri Tambada Rassa Plate",
            "m_name": "मटण तांबडा रस्सा थाळी स्पेशल",
            "desc": "Slow cooked tender mutton with authentic fiery red thin gravy (Tambada Rassa) and dry sukka mutton",
            "price": 490.0,
            "veg": False,
            "food_type": "mutton",
            "spice": "Kolhapuri Tikhat",
            "special": True,
            "featured": True,
            "img": "https://images.unsplash.com/photo-1545247181-516773cae7be?auto=format&fit=crop&w=600&q=80",
            "time": 22
        },
        {
            "cat_id": nonveg_cat.id,
            "name": "Chicken Handi (Half / Full)",
            "m_name": "चिकन हंडी",
            "desc": "Traditional handi curry slow-cooked with bone chicken in rich coriander brown onion gravy",
            "price": 350.0,
            "veg": False,
            "food_type": "chicken",
            "spice": "Medium",
            "special": False,
            "featured": True,
            "img": "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=600&q=80",
            "time": 18
        },
        {
            "cat_id": nonveg_cat.id,
            "name": "Chicken Tikka Masala",
            "m_name": "चिकन टिक्का मसाला",
            "desc": "Smoky clay oven tandoori chicken chunks folded in spicy tomato butter onion gravy",
            "price": 370.0,
            "veg": False,
            "food_type": "chicken",
            "spice": "Medium",
            "special": False,
            "featured": False,
            "img": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80",
            "time": 18
        },
        {
            "cat_id": nonveg_cat.id,
            "name": "Egg Bhurji Double Pav",
            "m_name": "अंडा भुर्जी पाव",
            "desc": "Scrambled eggs tossed with butter, onions, green chillies, tomatoes and fresh coriander",
            "price": 140.0,
            "veg": False,
            "food_type": "egg",
            "spice": "Medium",
            "special": False,
            "featured": False,
            "img": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80",
            "time": 10
        },

        # --- NEW VEGETARIAN DELICACIES ---
        {
            "cat_id": veg_cat.id,
            "name": "Paneer Angara Masala",
            "m_name": "पनीर अंगारा",
            "desc": "Smoked paneer gravy with live coal aroma, spicy red capsicum, and thick rich gravy",
            "price": 290.0,
            "veg": True,
            "food_type": "veg",
            "spice": "Spicy",
            "special": True,
            "featured": True,
            "img": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80",
            "time": 16
        },
        {
            "cat_id": veg_cat.id,
            "name": "Shev Bhaji (Khandeshi / Kolhapuri)",
            "m_name": "शेव भाजी",
            "desc": "Crispy spiced gram flour thick shev served with fiery spiced coconut gravy",
            "price": 190.0,
            "veg": True,
            "food_type": "veg",
            "spice": "Kolhapuri Tikhat",
            "special": True,
            "featured": True,
            "img": "https://images.unsplash.com/photo-1546833998-877b37c2e5c6?auto=format&fit=crop&w=600&q=80",
            "time": 12
        },
        {
            "cat_id": veg_cat.id,
            "name": "Mushroom Masala Handi",
            "m_name": "मशरूम मसाला",
            "desc": "Fresh button mushrooms simmered in spicy onion tomato gravy and fragrant kasuri methi",
            "price": 260.0,
            "veg": True,
            "food_type": "veg",
            "spice": "Medium",
            "special": False,
            "featured": False,
            "img": "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80",
            "time": 15
        },
        {
            "cat_id": veg_cat.id,
            "name": "Dal Fry Butter Jeera",
            "m_name": "दाल फ्राय बटर",
            "desc": "Slow cooked yellow lentils tempered with butter, hing, garlic and green chillies",
            "price": 170.0,
            "veg": True,
            "food_type": "veg",
            "spice": "Mild",
            "special": False,
            "featured": False,
            "img": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80",
            "time": 10
        },

        # --- NEW STARTERS & APPETIZERS ---
        {
            "cat_id": starter_cat.id,
            "name": "Chicken Pahadi Kabab (Plate of 6)",
            "m_name": "चिकन पहाडी कबाब",
            "desc": "Boneless chicken chunks marinated in fresh mint, coriander, spinach and roasted in clay tandoor",
            "price": 320.0,
            "veg": False,
            "food_type": "chicken",
            "spice": "Medium",
            "special": True,
            "featured": True,
            "img": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=600&q=80",
            "time": 18
        },
        {
            "cat_id": starter_cat.id,
            "name": "Harabhara Kabab (Plate of 6)",
            "m_name": "हराभरा कबाब",
            "desc": "Spinach, green pea and cottage cheese golden patties spiced with chaat masala and mint chutney",
            "price": 210.0,
            "veg": True,
            "food_type": "veg",
            "spice": "Mild",
            "special": False,
            "featured": False,
            "img": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=600&q=80",
            "time": 12
        },
        {
            "cat_id": starter_cat.id,
            "name": "Surmai Rava Fry (Fish Starter)",
            "m_name": "सुरमई रवा फ्राय स्टार्टर",
            "desc": "Crispy shallow fried fish slices coated in spiced semolina batter",
            "price": 430.0,
            "veg": False,
            "food_type": "fish",
            "spice": "Medium",
            "special": True,
            "featured": True,
            "img": "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=600&q=80",
            "time": 15
        },

        # --- NEW RICE & BREAD ---
        {
            "cat_id": rice_cat.id,
            "name": "Mutton Dum Biryani (Ekdant Special)",
            "m_name": "मटन दम बिर्याणी",
            "desc": "Tender marinated goat mutton layered with saffron infused basmati rice and cooked on slow dum",
            "price": 390.0,
            "veg": False,
            "food_type": "mutton",
            "spice": "Medium",
            "special": True,
            "featured": True,
            "img": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80",
            "time": 22
        },
        {
            "cat_id": bread_cat.id,
            "name": "Cheese Garlic Naan",
            "m_name": "चीझ गार्लिक नान",
            "desc": "Clay oven tandoori naan stuffed with melted mozzarella cheese and topped with minced garlic and butter",
            "price": 95.0,
            "veg": True,
            "food_type": "veg",
            "spice": "Mild",
            "special": True,
            "featured": True,
            "img": "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80",
            "time": 8
        },

        # --- NEW REFRESHING DRINKS ---
        {
            "cat_id": drink_cat.id,
            "name": "Mattha (Spiced Buttermilk / ताक)",
            "m_name": "मठ्ठा / ताक",
            "desc": "Traditional churned curd seasoned with ginger, green chilli, cumin and fresh coriander",
            "price": 45.0,
            "veg": True,
            "food_type": "veg",
            "spice": "Mild",
            "special": False,
            "featured": False,
            "img": "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80",
            "time": 5
        }
    ]

    added_count = 0
    for d in new_dishes:
        existing = db.query(MenuItem).filter(MenuItem.name == d["name"]).first()
        if not existing:
            item = MenuItem(
                restaurant_id=1,
                category_id=d["cat_id"],
                name=d["name"],
                marathi_name=d["m_name"],
                description=d["desc"],
                price=d["price"],
                is_veg=d["veg"],
                food_type=d["food_type"],
                spice_level=d["spice"],
                is_available=True,
                is_special=d["special"],
                is_featured=d["featured"],
                image_url=d["img"],
                preparation_time_mins=d["time"]
            )
            db.add(item)
            db.commit()
            db.refresh(item)
            added_count += 1

            # Common Addon
            if "Fish" in item.name or item.food_type == "fish":
                db.add(MenuItemAddon(item_id=item.id, name="Extra Rava Coating / Lemon Wedge", price=20.0))
            elif "Mutton" in item.name:
                db.add(MenuItemAddon(item_id=item.id, name="Extra Tambada Rassa Bowl", price=40.0))
            db.commit()

    db.close()
    print(f"Added {added_count} new authentic Veg, Non-Veg, Fish, and Starter dishes to Hotel Ekdant!")

if __name__ == '__main__':
    add_expanded_menu()
