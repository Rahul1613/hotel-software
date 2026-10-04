import pytest
from app.main import create_app
from app.models import init_db, SessionLocal, User, RestaurantTable, MenuItem, Invoice, InternalBillNote
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

def test_dual_billing_workflow_and_role_security(client):
    db = SessionLocal()
    table = db.query(RestaurantTable).filter(RestaurantTable.table_number == '03').first()
    item = db.query(MenuItem).first()
    
    owner = db.query(User).filter(User.role == 'owner').first()
    manager = db.query(User).filter(User.role == 'manager').first()
    cashier = db.query(User).filter(User.role == 'cashier').first()
    waiter = db.query(User).filter(User.role == 'waiter').first()

    owner_token = generate_staff_jwt(owner)
    manager_token = generate_staff_jwt(manager)
    cashier_token = generate_staff_jwt(cashier)
    waiter_token = generate_staff_jwt(waiter)
    db.close()

    # 1. Place order
    order_res = client.post('/api/orders', json={
        'table_number': '03',
        'customer_name': 'Dual Bill Test',
        'items': [{'item_id': item.id, 'quantity': 2}]
    })
    assert order_res.status_code == 201
    order_id = order_res.get_json()['order_id']

    # 2. Generate Invoice
    inv_res = client.post('/api/invoices', json={
        'order_id': order_id,
        'discount_amount': 20,
        'payment_method': 'CASH',
        'payment_status': 'PAID'
    }, headers={'Authorization': f'Bearer {cashier_token}'})
    assert inv_res.status_code == 201
    invoice_id = inv_res.get_json()['invoice_id']

    # 3. Security: Cashier & Waiter CANNOT access internal bill data (403 Forbidden)
    res_cashier = client.get(f'/api/invoices/{invoice_id}/internal', headers={'Authorization': f'Bearer {cashier_token}'})
    assert res_cashier.status_code == 403

    res_waiter = client.get(f'/api/invoices/{invoice_id}/internal', headers={'Authorization': f'Bearer {waiter_token}'})
    assert res_waiter.status_code == 403

    # 4. Owner & Manager CAN access internal bill data
    res_owner = client.get(f'/api/invoices/{invoice_id}/internal', headers={'Authorization': f'Bearer {owner_token}'})
    assert res_owner.status_code == 200
    internal_data = res_owner.get_json()
    assert 'total_food_cost' in internal_data
    assert 'gross_profit' in internal_data
    assert 'items' in internal_data
    assert len(internal_data['items']) > 0
    assert internal_data['items'][0]['cost_price_unit'] >= 0

    # 5. Add authorized internal adjustment (Manager/Owner only)
    adj_res_cashier = client.post(f'/api/invoices/{invoice_id}/adjustment', json={
        'note_type': 'ADJUSTMENT',
        'amount': -30.0,
        'reason': 'Damaged beverage'
    }, headers={'Authorization': f'Bearer {cashier_token}'})
    assert adj_res_cashier.status_code == 403

    adj_res = client.post(f'/api/invoices/{invoice_id}/adjustment', json={
        'note_type': 'ADJUSTMENT',
        'amount': -30.0,
        'reason': 'Authorized management discount'
    }, headers={'Authorization': f'Bearer {manager_token}'})
    assert adj_res.status_code == 201
    adj_data = adj_res.get_json()
    assert adj_data['note_type'] == 'ADJUSTMENT'

    # Verify adjustment is tracked in internal data without altering original invoice final_payable
    res_owner_after = client.get(f'/api/invoices/{invoice_id}/internal', headers={'Authorization': f'Bearer {owner_token}'})
    data_after = res_owner_after.get_json()
    assert len(data_after['adjustments']) == 1
    assert data_after['adjustments'][0]['amount'] == -30.0

    # 6. Test Print Templates & Permissions
    # Customer receipt is accessible to staff
    cust_html = client.get(f'/api/invoices/{invoice_id}/receipt/html')
    assert cust_html.status_code == 200
    assert b'Hotel Ekdant' in cust_html.data
    # Must NOT expose internal food cost or profit
    assert b'Total Food Cost' not in cust_html.data
    assert b'GROSS PROFIT' not in cust_html.data

    # Internal receipt requires owner/manager
    int_html_cashier = client.get(f'/api/invoices/{invoice_id}/internal-receipt/html', headers={'Authorization': f'Bearer {cashier_token}'})
    assert int_html_cashier.status_code == 403

    int_html_owner = client.get(f'/api/invoices/{invoice_id}/internal-receipt/html', headers={'Authorization': f'Bearer {owner_token}'})
    assert int_html_owner.status_code == 200
    assert b'INTERNAL COPY' in int_html_owner.data
    assert b'GROSS PROFIT' in int_html_owner.data
    assert b'Total Food Cost' in int_html_owner.data

    # Dual receipts print sequence
    dual_html_cashier = client.get(f'/api/invoices/{invoice_id}/both-receipts/html', headers={'Authorization': f'Bearer {cashier_token}'})
    assert dual_html_cashier.status_code == 403

    dual_html_owner = client.get(f'/api/invoices/{invoice_id}/both-receipts/html', headers={'Authorization': f'Bearer {owner_token}'})
    assert dual_html_owner.status_code == 200
    assert b'Dual Bill' in dual_html_owner.data
    assert b'INTERNAL COPY' in dual_html_owner.data

    # 7. Test Internal Financial Report Endpoint
    rep_cashier = client.get('/api/reports/internal-financial', headers={'Authorization': f'Bearer {cashier_token}'})
    assert rep_cashier.status_code == 403

    rep_owner = client.get('/api/reports/internal-financial?period=month', headers={'Authorization': f'Bearer {owner_token}'})
    assert rep_owner.status_code == 200
    rep_data = rep_owner.get_json()
    assert 'total_revenue' in rep_data
    assert 'total_food_cost' in rep_data
    assert 'gross_profit' in rep_data
    assert 'payment_breakdown' in rep_data
