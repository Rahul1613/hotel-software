from flask import Blueprint, request, jsonify, g
from app.models import SessionLocal, Review, Order
from app.auth import require_role, decode_order_token
from app.money import now_utc

reviews_bp = Blueprint('reviews', __name__, url_prefix='/api/reviews')

@reviews_bp.route('', methods=['GET'])
def list_approved_reviews():
    """Public read of approved guest reviews."""
    db = SessionLocal()
    try:
        reviews = db.query(Review).filter(Review.is_approved == True).order_by(Review.created_at.desc()).limit(100).all()
        return jsonify([{
            "id": r.id,
            "customer_name": r.customer_name,
            "rating": r.rating,
            "food_rating": r.food_rating,
            "service_rating": r.service_rating,
            "cleanliness_rating": r.cleanliness_rating,
            "comment": r.comment,
            "manager_reply": r.manager_reply,
            "replied_at": r.replied_at.strftime('%d %b %Y') if r.replied_at else None,
            "created_at": r.created_at.strftime('%d %b %Y') if r.created_at else None
        } for r in reviews])
    finally:
        db.close()

@reviews_bp.route('/all', methods=['GET'])
@require_role("owner", "manager")
def list_all_reviews():
    """Admin list of all reviews including unapproved."""
    db = SessionLocal()
    try:
        reviews = db.query(Review).order_by(Review.created_at.desc()).all()
        return jsonify([{
            "id": r.id,
            "order_id": r.order_id,
            "customer_name": r.customer_name,
            "rating": r.rating,
            "food_rating": r.food_rating,
            "service_rating": r.service_rating,
            "cleanliness_rating": r.cleanliness_rating,
            "comment": r.comment,
            "manager_reply": r.manager_reply,
            "is_approved": r.is_approved,
            "created_at": r.created_at.strftime('%d %b %Y') if r.created_at else None
        } for r in reviews])
    finally:
        db.close()

@reviews_bp.route('', methods=['POST'])
def submit_review():
    """Submit a guest review (linked to completed order if token provided)."""
    data = request.json or {}
    order_token = data.get('order_token')
    order_id = None

    if order_token:
        payload = decode_order_token(order_token)
        if payload:
            order_id = payload.get('order_id')

    db = SessionLocal()
    try:
        review = Review(
            restaurant_id=1,
            order_id=order_id,
            customer_name=data.get('customer_name') or 'Guest',
            rating=max(1, min(5, int(data.get('rating', 5)))),
            food_rating=max(1, min(5, int(data.get('food_rating', 5)))),
            service_rating=max(1, min(5, int(data.get('service_rating', 5)))),
            cleanliness_rating=max(1, min(5, int(data.get('cleanliness_rating', 5)))),
            comment=data.get('comment'),
            is_approved=True, # Auto-approve clean reviews
            created_at=now_utc()
        )
        db.add(review)
        db.commit()
        return jsonify({"message": "Thank you! Your feedback has been received."}), 201
    finally:
        db.close()

@reviews_bp.route('/<int:review_id>/moderate', methods=['PUT'])
@require_role("owner", "manager")
def moderate_review(review_id):
    """Admin approves or hides review."""
    data = request.json or {}
    db = SessionLocal()
    try:
        r = db.query(Review).get(review_id)
        if not r:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Review not found."}}), 404

        if 'is_approved' in data:
            r.is_approved = bool(data['is_approved'])
        if 'manager_reply' in data:
            r.manager_reply = data['manager_reply']
            r.replied_at = now_utc()

        db.commit()
        return jsonify({"message": "Review moderation updated."})
    finally:
        db.close()
