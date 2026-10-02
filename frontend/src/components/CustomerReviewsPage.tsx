import React, { useState } from 'react';
import { Star, MessageSquare, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { EkdantLogo } from './EkdantLogo';
import type { Review } from '../types';

interface ReviewsProps {
  onBack: () => void;
}

export const CustomerReviewsPage: React.FC<ReviewsProps> = ({ onBack }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState('');
  const [rating, setRating] = useState(5);
  const [foodRating, setFoodRating] = useState(5);
  const [serviceRating, setServiceRating] = useState(5);
  const [cleanlinessRating, setCleanlinessRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchReviews = async () => {
    try {
      const res = await fetch('/api/reviews');
      const data = await res.json();
      if (Array.isArray(data)) setReviews(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchReviews();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName,
          rating,
          food_rating: foodRating,
          service_rating: serviceRating,
          cleanliness_rating: cleanlinessRating,
          comment
        })
      });
      if (res.ok) {
        setSubmitted(true);
        fetchReviews();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF9F0] text-[#282321] px-4 py-8 max-w-2xl mx-auto flex flex-col justify-between">
      <div>
        {/* Navigation */}
        <div className="flex items-center gap-3 mb-6">
          <button 
            onClick={onBack}
            className="p-2 rounded-xl bg-white border border-gray-300 hover:bg-gray-100 cursor-pointer text-[#641C24]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <EkdantLogo size="sm" showSubtitle={false} />
        </div>

        {/* Heading */}
        <div className="text-center mb-6">
          <span className="text-[11px] uppercase tracking-wider text-[#C49A52] font-bold">Guest Experiences</span>
          <h1 className="text-2xl font-serif-royal font-bold text-[#641C24]">Customer Reviews & Feedback</h1>
          <p className="text-xs text-gray-600 mt-1">Honest dining feedback from our valued family patrons.</p>
        </div>

        {/* Form or Confirmation */}
        {submitted ? (
          <div className="bg-white rounded-3xl p-6 border-2 border-[#C49A52] text-center shadow-md mb-8 space-y-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-serif-royal font-bold text-lg text-[#641C24]">Thank You For Your Feedback!</h3>
            <p className="text-xs text-gray-600">Your review has been saved to our guest book.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-5 border border-[#C49A52]/30 shadow-md mb-8 space-y-3.5 text-xs">
            <h3 className="font-serif-royal font-bold text-sm text-[#641C24]">Leave Your Dining Feedback</h3>
            
            <div>
              <label className="block font-bold text-gray-700 mb-1">Your Name</label>
              <input 
                type="text"
                required
                placeholder="e.g. Anand Kulkarni"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-[#641C24]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Overall Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(st => (
                    <button
                      type="button"
                      key={st}
                      onClick={() => setRating(st)}
                      className="p-1 cursor-pointer"
                    >
                      <Star className={`w-5 h-5 ${st <= rating ? 'fill-[#C49A52] text-[#C49A52]' : 'text-gray-300'}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Food Taste</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(st => (
                    <button
                      type="button"
                      key={st}
                      onClick={() => setFoodRating(st)}
                      className="p-1 cursor-pointer"
                    >
                      <Star className={`w-5 h-5 ${st <= foodRating ? 'fill-emerald-500 text-emerald-500' : 'text-gray-300'}`} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Comments & Suggestions</label>
              <textarea 
                rows={3}
                required
                placeholder="Share your experience with our dishes, ambience, or staff..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:border-[#641C24]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#641C24] hover:bg-[#852D34] text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
            >
              <MessageSquare className="w-4 h-4 text-[#C49A52]" />
              <span>{submitting ? 'Submitting...' : 'Submit Feedback'}</span>
            </button>
          </form>
        )}

        {/* Existing Reviews List */}
        <div className="space-y-3">
          <h3 className="font-serif-royal font-bold text-base text-[#641C24]">Recent Patron Reviews</h3>
          {loading ? (
            <div className="text-center py-6 text-xs text-gray-500">Loading reviews...</div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-500">No reviews yet. Be the first to share your experience!</div>
          ) : (
            reviews.map(rev => (
              <div key={rev.id} className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">{rev.customer_name}</span>
                  <div className="flex items-center gap-0.5">
                    {[...Array(rev.rating)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-[#C49A52] text-[#C49A52]" />
                    ))}
                  </div>
                </div>
                <p className="text-gray-700 leading-relaxed">{rev.comment}</p>
                {rev.reply && (
                  <div className="mt-2 bg-[#FFF9F0] p-2.5 rounded-xl border border-[#C49A52]/30 text-[11px] text-gray-800">
                    <strong className="text-[#641C24]">Hotel Ekdant Management:</strong> {rev.reply}
                  </div>
                )}
                <span className="text-[10px] text-gray-400 block pt-1">{rev.created_at}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
