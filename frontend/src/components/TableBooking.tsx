import React, { useState } from 'react';
import { EkdantLogo } from './EkdantLogo';
import { Calendar, Clock, Users, ArrowLeft, CheckCircle2, MessageSquare, Phone } from 'lucide-react';
import type { RestaurantInfo } from '../types';

interface ReservationProps {
  restaurant: RestaurantInfo | null;
  onBack: () => void;
}

export const TableBooking: React.FC<ReservationProps> = ({ restaurant, onBack }) => {
  const [customerName, setCustomerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [bookingDate, setBookingDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [preferredTime, setPreferredTime] = useState('07:30 PM');
  const [guestsCount, setGuestsCount] = useState(4);
  const [seatingPreference, setSeatingPreference] = useState<'AC' | 'NON_AC'>('AC');
  const [specialRequests, setSpecialRequests] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedBookingRef, setConfirmedBookingRef] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const timeSlots = [
    '12:30 PM', '01:00 PM', '01:30 PM', '02:00 PM', 
    '07:00 PM', '07:30 PM', '08:00 PM', '08:30 PM', '09:00 PM', '09:30 PM'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !mobileNumber) {
      setErrorMsg('Please enter your name and contact phone number');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName,
          mobile_number: mobileNumber,
          booking_date: bookingDate,
          preferred_time: preferredTime,
          guests_count: guestsCount,
          seating_preference: seatingPreference,
          special_requests: specialRequests
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit reservation');
      setConfirmedBookingRef(data.booking_reference);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error booking table. Please call restaurant directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const whatsappNumber = (restaurant?.whatsapp || '919823456789').replace(/[^0-9]/g, '');

  return (
    <div className="min-h-screen bg-[#FFF9F0] text-[#282321] px-4 py-8 max-w-xl mx-auto flex flex-col justify-between">
      <div>
        {/* Navigation & Header */}
        <div className="flex items-center gap-3 mb-6">
          <button 
            onClick={onBack}
            className="p-2 rounded-xl bg-white border border-gray-300 hover:bg-gray-100 cursor-pointer text-[#641C24]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <EkdantLogo size="sm" showSubtitle={false} />
        </div>

        {confirmedBookingRef ? (
          <div className="bg-white rounded-3xl p-6 border-2 border-[#C49A52] text-center shadow-lg space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h2 className="font-serif-royal font-bold text-2xl text-[#641C24]">
              Table Reservation Received!
            </h2>
            <p className="text-xs text-gray-600">
              We look forward to welcoming you and your family to Hotel Ekdant.
            </p>

            <div className="bg-[#FFF9F0] p-4 rounded-2xl border border-[#C49A52]/40 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Booking Reference:</span>
                <span className="font-bold text-[#641C24] font-mono">{confirmedBookingRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date & Time:</span>
                <span className="font-semibold">{bookingDate} at {preferredTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Guests & Section:</span>
                <span className="font-semibold">{guestsCount} Guests ({seatingPreference} Dining)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Primary Contact:</span>
                <span className="font-semibold">{customerName} ({mobileNumber})</span>
              </div>
            </div>

            <div className="pt-2">
              <a 
                href={`https://wa.me/${whatsappNumber}?text=Namaskar%20Hotel%20Ekdant,%20I%20have%20booked%20table%20reference%20${confirmedBookingRef}%20for%20${bookingDate}.`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#25D366] text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#128C7E] transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Confirm on WhatsApp with Manager</span>
              </a>
            </div>

            <button 
              onClick={onBack}
              className="text-[#641C24] text-xs font-bold underline cursor-pointer pt-2"
            >
              Return to restaurant menu
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 border border-[#C49A52]/30 shadow-md space-y-4">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#C49A52] font-bold">Advance Booking</span>
              <h2 className="font-serif-royal font-bold text-xl text-[#641C24]">Reserve Your Family Table</h2>
              <p className="text-xs text-gray-500">Total 11 tables across AC and Non-AC dining halls.</p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Full Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Suresh Deshmukh"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#641C24]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Mobile Number</label>
                <input 
                  type="tel" 
                  required
                  placeholder="98234XXXXX"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#641C24]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Booking Date</label>
                <input 
                  type="date" 
                  required
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#641C24]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Number of Guests</label>
                <select
                  value={guestsCount}
                  onChange={(e) => setGuestsCount(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#641C24]"
                >
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                    <option key={n} value={n}>{n} Guests</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Seating preference */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Seating Preference</label>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setSeatingPreference('AC')}
                  className={`py-2.5 rounded-xl font-bold border cursor-pointer transition-all ${
                    seatingPreference === 'AC' 
                      ? 'border-[#641C24] bg-[#641C24] text-white' 
                      : 'border-gray-200 bg-gray-50 text-gray-700'
                  }`}
                >
                  AC Hall (5 Tables)
                </button>
                <button
                  type="button"
                  onClick={() => setSeatingPreference('NON_AC')}
                  className={`py-2.5 rounded-xl font-bold border cursor-pointer transition-all ${
                    seatingPreference === 'NON_AC' 
                      ? 'border-[#641C24] bg-[#641C24] text-white' 
                      : 'border-gray-200 bg-gray-50 text-gray-700'
                  }`}
                >
                  Non-AC Family Hall (6 Tables)
                </button>
              </div>
            </div>

            {/* Time Slot Picker */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Preferred Time</label>
              <div className="grid grid-cols-5 gap-1.5">
                {timeSlots.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPreferredTime(t)}
                    className={`py-1.5 text-[11px] rounded-lg font-medium cursor-pointer transition-all ${
                      preferredTime === t 
                        ? 'bg-[#C49A52] text-[#282321] font-bold shadow-xs' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Special Request */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Special Requests (Optional)</label>
              <textarea 
                rows={2}
                placeholder="e.g. Birthday celebration, High chair for child, quiet corner..."
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#641C24]"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#641C24] hover:bg-[#852D34] text-[#FFF9F0] py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              {isSubmitting ? 'Submitting reservation...' : 'Confirm Table Reservation'}
            </button>
          </form>
        )}
      </div>

      <div className="mt-8 text-center text-xs text-gray-500">
        Direct telephone reservation: <a href={`tel:${restaurant?.phone || '+91 98234 56789'}`} className="font-bold text-[#641C24] underline">{restaurant?.phone || '+91 98234 56789'}</a>
      </div>
    </div>
  );
};
