import React, { useState } from 'react';
import type { Review } from '../../types';
import { apiRequest } from '../../api';
import { Star, Check, X, MessageSquare } from 'lucide-react';
import { Modal } from '../../components/common/Modal';

interface ReviewsTabProps {
  reviews: Review[];
  onRefresh: () => void;
}

export const ReviewsTab: React.FC<ReviewsTabProps> = ({ reviews, onRefresh }) => {
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleModerate = async (reviewId: number, isApproved: boolean) => {
    try {
      await apiRequest(`/api/reviews/${reviewId}/moderate`, {
        method: 'PUT',
        body: JSON.stringify({ is_approved: isApproved }),
      });
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSendReply = async () => {
    if (!selectedReview) return;
    setIsSubmitting(true);
    try {
      await apiRequest(`/api/reviews/${selectedReview.id}/moderate`, {
        method: 'PUT',
        body: JSON.stringify({ manager_reply: replyText }),
      });
      setSelectedReview(null);
      setReplyText('');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold font-serif-royal text-[#641C24]">Customer Reviews & Moderation</h2>
        <p className="text-xs text-gray-500">Approve public reviews and respond with manager replies.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reviews.map(rev => (
          <div key={rev.id} className="bg-white rounded-2xl p-4 border border-gray-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-gray-900">{rev.customer_name}</span>
                <div className="flex items-center text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`w-3.5 h-3.5 ${i < rev.rating ? 'fill-current' : 'text-gray-300'}`} />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 text-[10px] text-gray-500 bg-gray-50 p-1.5 rounded-lg mb-2">
                <span>Food: {rev.food_rating}★</span>
                <span>Service: {rev.service_rating}★</span>
                <span>Cleanliness: {rev.cleanliness_rating}★</span>
              </div>

              <p className="text-xs text-gray-700 italic mb-2">"{rev.comment || 'No comment provided'}"</p>

              {rev.manager_reply && (
                <div className="bg-[#FFF9F0] p-2 rounded-lg border border-[#C49A52]/30 text-xs">
                  <span className="font-bold text-[#641C24] block">Manager Reply:</span>
                  <span className="text-gray-700">{rev.manager_reply}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t mt-3 flex items-center justify-between text-xs">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rev.is_approved ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                {rev.is_approved ? 'Approved' : 'Hidden'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedReview(rev);
                    setReplyText(rev.manager_reply || '');
                  }}
                  className="text-gray-600 hover:text-[#641C24] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Reply</span>
                </button>
                <button
                  onClick={() => handleModerate(rev.id, !rev.is_approved)}
                  className="text-gray-600 hover:text-black font-bold flex items-center gap-0.5 cursor-pointer"
                >
                  {rev.is_approved ? <X className="w-3.5 h-3.5 text-red-600" /> : <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  <span>{rev.is_approved ? 'Hide' : 'Approve'}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={!!selectedReview} onClose={() => setSelectedReview(null)} title={`Reply to ${selectedReview?.customer_name}`}>
        <div className="space-y-3">
          <textarea
            rows={3}
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Thank you for visiting Hotel Ekdant..."
            className="w-full border border-gray-300 rounded-xl p-2.5 text-xs"
          />
          <button
            onClick={handleSendReply}
            disabled={isSubmitting}
            className="w-full bg-[#641C24] text-white font-bold py-2 rounded-xl text-xs"
          >
            Submit Reply
          </button>
        </div>
      </Modal>
    </div>
  );
};
