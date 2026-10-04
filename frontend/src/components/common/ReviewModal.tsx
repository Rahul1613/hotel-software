import React, { useState } from 'react';
import { Star, CheckCircle, HeartHandshake } from 'lucide-react';
import { Modal } from './Modal';
import { apiRequest } from '../../api';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId?: number;
  orderNumber?: string;
  customerName?: string;
  onSuccess: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  customerName,
  onSuccess,
}) => {
  const [rating, setRating] = useState(5);
  const [foodRating, setFoodRating] = useState(5);
  const [serviceRating, setServiceRating] = useState(5);
  const [cleanlinessRating, setCleanlinessRating] = useState(5);
  const [comment, setComment] = useState('');
  const [name, setName] = useState(customerName || '');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const orderToken = orderId ? localStorage.getItem(`order_token_${orderId}`) : null;
      await apiRequest('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          order_token: orderToken,
          customer_name: name || 'Guest',
          rating,
          food_rating: foodRating,
          service_rating: serviceRating,
          cleanliness_rating: cleanlinessRating,
          comment: comment.trim(),
        }),
      });
      setSubmitted(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const StarSelector = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="p-1 cursor-pointer transition-transform hover:scale-125"
        >
          <Star
            className={`w-6 h-6 ${
              star <= value ? 'text-amber-400 fill-amber-400' : 'text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rate Your Dining Experience">
      {submitted ? (
        <div className="p-6 text-center space-y-3">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
            <HeartHandshake className="w-8 h-8" />
          </div>
          <h3 className="font-serif-royal font-bold text-lg text-[#641C24]">
            धन्यवाद! Thank You for Dining with Us!
          </h3>
          <p className="text-xs text-gray-600">
            Your feedback helps us maintain authentic Maharashtrian hospitality. Have a wonderful day!
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="text-center pb-2 border-b border-gray-100">
            <span className="text-xs text-gray-500 font-medium">Overall Experience</span>
            <div className="flex justify-center mt-1">
              <StarSelector value={rating} onChange={setRating} />
            </div>
          </div>

          <div className="space-y-2 bg-[#FFF9F0] p-3 rounded-2xl border border-[#C49A52]/30">
            <div className="flex items-center justify-between">
              <span className="text-gray-700 font-semibold">Taste & Food Quality:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setFoodRating(v)}
                    className={`w-6 h-6 rounded-md text-[11px] font-bold cursor-pointer ${
                      v <= foodRating ? 'bg-[#641C24] text-white' : 'bg-white text-gray-400 border border-gray-200'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-700 font-semibold">Service & Hospitality:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setServiceRating(v)}
                    className={`w-6 h-6 rounded-md text-[11px] font-bold cursor-pointer ${
                      v <= serviceRating ? 'bg-[#641C24] text-white' : 'bg-white text-gray-400 border border-gray-200'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-700 font-semibold">Ambiance & Cleanliness:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCleanlinessRating(v)}
                    className={`w-6 h-6 rounded-md text-[11px] font-bold cursor-pointer ${
                      v <= cleanlinessRating ? 'bg-[#641C24] text-white' : 'bg-white text-gray-400 border border-gray-200'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">Your Name (Optional)</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Ramesh Kulkarni"
              className="w-full border border-gray-300 rounded-xl p-2 text-xs focus:outline-none focus:border-[#641C24]"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1">Feedback & Suggestions</label>
            <textarea
              rows={2}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="How was the Kolhapuri Thali, Dum Biryani, or Solkadhi?"
              className="w-full border border-gray-300 rounded-xl p-2 text-xs focus:outline-none focus:border-[#641C24]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#641C24] hover:bg-[#852D34] text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
          >
            <span>{submitting ? 'Submitting...' : 'Submit Review & Complete Sitting'}</span>
          </button>
        </form>
      )}
    </Modal>
  );
};
