import pytest
from app.main import create_app
from app.models import init_db, SessionLocal, User, RestaurantTable, MenuItem, MenuCategory
from app.config import TestingConfig
from app.services.seed_service import seed_database
from app.auth import generate_staff_jwt, generate_table_session_token

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

import os

def test_login_and_auth_flow(client):
    owner_pwd = os.getenv("INITIAL_OWNER_PASSWORD", "EkdantOwner@2026")
    # Test valid login
    res = client.post('/api/auth/login', json={
        'username': 'owner',
        'password': owner_pwd
    })
    assert res.status_code == 200
    data = res.get_json()
    assert 'token' in data
    assert data['user']['role'] == 'owner'
    token = data['token']

    # Test me endpoint with bearer
    res_me = client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})
    assert res_me.status_code == 200
    assert res_me.get_json()['username'] == 'owner'

    # Test wrong password fails
    res_fail = client.post('/api/auth/login', json={
        'username': 'owner',
        'password': 'WrongPassword!'
    })
    assert res_fail.status_code == 401

def test_protected_routes_unauthorized(client):
    # Cannot access staff or orders without auth
    res = client.get('/api/orders')
    assert res.status_code == 401

    res_staff = client.get('/api/staff')
    assert res_staff.status_code == 401

def test_customer_data_leak_prevented(client):
    # Customer cannot list all orders
    res = client.get('/api/orders')
    assert res.status_code == 401

def test_single_order_security(client):
    # Cannot access order by ID without staff auth or order token
    res = client.get('/api/orders/1')
    assert res.status_code == 403

def test_role_permission_matrix(client):
    # Waiter cannot update restaurant settings or add staff
    db = SessionLocal()
    waiter = db.query(User).filter(User.username == 'waiter1').first()
    waiter_token = generate_staff_jwt(waiter)
    db.close()

    res_settings = client.put('/api/restaurant', json={'name': 'Hacked Name'}, headers={'Authorization': f'Bearer {waiter_token}'})
    assert res_settings.status_code == 403

    res_staff = client.post('/api/staff', json={'username': 'newuser', 'full_name': 'New'}, headers={'Authorization': f'Bearer {waiter_token}'})
    assert res_staff.status_code == 403
