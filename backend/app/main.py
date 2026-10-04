import os
import sys
from datetime import datetime, timedelta
from flask import Flask, jsonify, send_file, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from app.config import Config
from app.models import SessionLocal, init_db
from app.sockets import socketio
from app.services.seed_service import seed_database

# Blueprints
from app.blueprints.auth import auth_bp
from app.blueprints.restaurant import restaurant_bp
from app.blueprints.staff import staff_bp
from app.blueprints.tables import tables_bp
from app.blueprints.menu import menu_bp
from app.blueprints.orders import orders_bp
from app.blueprints.billing import billing_bp
from app.blueprints.reservations import reservations_bp
from app.blueprints.service_requests import services_bp
from app.blueprints.reviews import reviews_bp
from app.blueprints.inventory import inventory_bp
from app.blueprints.reports import reports_bp

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Validate production secrets
    config_class.validate()

    # CORS configuration
    CORS(app, resources={r"/api/*": {"origins": config_class.ALLOWED_ORIGINS}})

    # SocketIO initialization
    socketio.init_app(app, cors_allowed_origins="*", async_mode='threading')

    # Rate Limiting
    limiter = Limiter(
        get_remote_address,
        app=app,
        default_limits=["300 per minute"],
        storage_uri="memory://"
    )
    # Apply strict limits on login
    limiter.limit("5 per minute")(auth_bp)

    # Security Headers Middleware
    @app.after_request
    def add_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        if config_class.ENV == "production":
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        return response

    # Global DB teardown
    @app.teardown_appcontext
    def shutdown_session(exception=None):
        SessionLocal.remove()

    # Health Check
    @app.route('/healthz', methods=['GET'])
    def health_check():
        return jsonify({"status": "healthy", "service": "Hotel Ekdant Backend"}), 200

    # Register all Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(restaurant_bp)
    app.register_blueprint(staff_bp)
    app.register_blueprint(tables_bp)
    app.register_blueprint(menu_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(billing_bp)
    app.register_blueprint(reservations_bp)
    app.register_blueprint(services_bp)
    app.register_blueprint(reviews_bp)
    app.register_blueprint(inventory_bp)
    app.register_blueprint(reports_bp)

    # Serve uploaded images
    @app.route('/uploads/<filename>', methods=['GET'])
    def serve_uploaded_file(filename):
        folder = config_class.UPLOAD_FOLDER
        file_path = os.path.join(folder, filename)
        if os.path.exists(file_path):
            return send_file(file_path)
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Image not found."}}), 404

    # Serve Production React SPA build
    frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'dist'))

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend_spa(path):
        if path.startswith('api') or path.startswith('socket.io') or path.startswith('uploads'):
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Endpoint not found."}}), 404

        target = os.path.join(frontend_dist, path)
        if path and os.path.exists(target) and not os.path.isdir(target):
            return send_file(target)

        index_file = os.path.join(frontend_dist, 'index.html')
        if os.path.exists(index_file):
            return send_file(index_file)

        return "Hotel Ekdant Restaurant Management System Active", 200

    # Standard JSON Error Handlers
    @app.errorhandler(404)
    def handle_404(e):
        return jsonify({"error": {"code": "NOT_FOUND", "message": "Resource not found."}}), 404

    @app.errorhandler(429)
    def handle_429(e):
        return jsonify({"error": {"code": "RATE_LIMIT_EXCEEDED", "message": "Too many requests. Please wait."}}), 429

    @app.errorhandler(500)
    def handle_500(e):
        return jsonify({"error": {"code": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred."}}), 500

    # Automatically ensure tables & idempotent seeds exist on startup
    with app.app_context():
        try:
            init_db()
            seed_database()
        except Exception as e:
            app.logger.warning(f"Database initialization: {e}")

    return app

# Development entry point
app = create_app()

if __name__ == '__main__':
    init_db()
    seed_database()
    port = Config.PORT
    print(f"Starting Hotel Ekdant Backend on port {port}...")
    socketio.run(app, host='0.0.0.0', port=port, debug=Config.DEBUG, allow_unsafe_werkzeug=True)
