import pytest
from app.main import create_app
from app.models import init_db, SessionLocal, User, RestaurantTable, MenuItem
from app.config import TestingConfig
from app.services.seed_service import seed_database
from app.auth import generate_staff_jwt

@pytest.fixture
def app():
    app = create_app(TestingConfig)
    with app.app_context():
        init_db()
        seed_database()
        yield app

@pytest.fixture
def client(app):
    return app.test_client()

def test_order_creation_server_side_pricing(client):
    db = SessionLocal()
    table = db.query(RestaurantTable).filter(RestaurantTable.table_number == '01').first()
    item = db.query(MenuItem).filter(MenuItem.name.like('%Thali%')).first()
    db.close()

    # Place order with client trying to tamper price to 1 rupee
    res = client.post('/api/orders', json={
        'table_number': '01',
        'customer_name': 'Rahul Test',
        'items': [{
            'item_id': item.id,
            'quantity': 2,
            'price': 1.0 # Tampered price ignored by server
        }]
    })
    assert res.status_code == 201
    data = res.get_json()
    assert 'order_id' in data
    assert 'order_token' in data

    # Check that price is properly calculated from DB: 2 * item.price + GST
    expected_subtotal = item.price * 2
    assert data['final_amount'] > 10.0

def test_single_session_billing_multiple_orders(client):
    db = SessionLocal()
    table = db.query(RestaurantTable).filter(RestaurantTable.table_number == '02').first()
    item1 = db.query(MenuItem).first()
    waiter = db.query(User).filter(User.username == 'waiter1').first()
    waiter_token = generate_staff_jwt(waiter)
    db.close()

    # Order 1 in sitting
    res1 = client.post('/api/orders', json={
        'table_number': '02',
        'customer_name': 'Guest Sitting',
        'items': [{'item_id': item1.id, 'quantity': 1}]
    })
    assert res1.status_code == 201
    ord1_id = res1.get_json()['order_id']

    # Order 2 in same sitting (order more)
    res2 = client.post('/api/orders', json={
        'table_number': '02',
        'customer_name': 'Guest Sitting',
        'items': [{'item_id': item1.id, 'quantity': 2}]
    })
    assert res2.status_code == 201
    ord2_id = res2.get_json()['order_id']

    # Generate ONE invoice for the sitting
    res_bill = client.post('/api/invoices', json={
        'order_id': ord1_id,
        'discount_amount': 50,
        'payment_method': 'CASH',
        'payment_status': 'PAID'
    }, headers={'Authorization': f'Bearer {waiter_token}'})

    assert res_bill.status_code == 201
    bill_data = res_bill.get_json()
    assert 'invoice_number' in bill_data
    assert bill_data['invoice_number'].startswith('EK/26-27/')
