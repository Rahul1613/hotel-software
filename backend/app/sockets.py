from flask import request
from flask_socketio import SocketIO, emit, join_room, disconnect
from app.auth import decode_staff_jwt, decode_table_session_token

socketio = SocketIO(cors_allowed_origins="*", async_mode='threading')

def emit_to_room(room_name: str, event: str, payload: dict):
    socketio.emit(event, payload, to=room_name)

def emit_broadcast(event: str, payload: dict):
    socketio.emit(event, payload)

@socketio.on('connect')
def handle_connect(auth):
    """
    Secure connection handler.
    Clients can connect with auth dict:
    - { token: "<staff_jwt>" } OR
    - { table_token: "<table_session_token>" }
    """
    token = None
    if isinstance(auth, dict):
        token = auth.get('token')
        table_token = auth.get('table_token')
    else:
        token = request.args.get('token')
        table_token = request.args.get('table_token')

    if token:
        payload = decode_staff_jwt(token)
        if payload:
            role = payload.get('role', 'waiter').lower()
            join_room("staff")
            if role in ["chef", "cook", "owner", "manager"]:
                join_room("kitchen")
            emit('connected', {"status": "authenticated_staff", "role": role})
            return

    if table_token:
        payload = decode_table_session_token(table_token)
        if payload:
            tbl_num = payload.get('table_number')
            join_room(f"table_{tbl_num}")
            emit('connected', {"status": "authenticated_table", "table_number": tbl_num})
            return

    # Allow unauthenticated initial connection but restrict rooms
    emit('connected', {"status": "public_guest"})

@socketio.on('join_dashboard')
def handle_join_dashboard(data):
    """Only authenticated staff can join staff/kitchen rooms."""
    token = data.get('token') if isinstance(data, dict) else None
    if not token:
        emit('error', {"message": "Staff token required to join dashboard"})
        return
    payload = decode_staff_jwt(token)
    if not payload:
        emit('error', {"message": "Invalid staff token"})
        return

    role = payload.get('role', 'waiter').lower()
    join_room("staff")
    if role in ["chef", "cook", "owner", "manager"]:
        join_room("kitchen")
    emit('status', {"message": f"Subscribed to updates as {role}"})

@socketio.on('join_table')
def handle_join_table(data):
    """Customer joins their own table room using signed table-session token."""
    table_token = data.get('table_session_token') if isinstance(data, dict) else None
    table_number = data.get('table_number') if isinstance(data, dict) else None

    if table_token:
        payload = decode_table_session_token(table_token)
        if payload:
            tbl = payload.get('table_number')
            join_room(f"table_{tbl}")
            emit('status', {"message": f"Subscribed to Table {tbl} updates"})
            return

    # Fallback in dev if table_number provided
    if table_number:
        join_room(f"table_{table_number}")
        emit('status', {"message": f"Subscribed to Table {table_number} updates"})
