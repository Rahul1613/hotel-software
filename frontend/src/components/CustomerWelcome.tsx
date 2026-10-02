import React from 'react';
import { EkdantLogo } from './EkdantLogo';
import { 
  UtensilsCrossed, CalendarCheck, Phone, MessageSquare, 
  MapPin, Clock, Award, ShieldCheck, ChevronRight 
} from 'lucide-react';
import type { RestaurantInfo } from '../types';

interface WelcomeProps {
  restaurant: RestaurantInfo | null;
  tableNumber: string | null;
  onViewMenu: () => void;
  onBookTable: () => void;
  onCallWaiter: () => void;
  onViewReviews?: () => void;
  onOpenStaffLogin?: () => void;
}

export const CustomerWelcome: React.FC<WelcomeProps> = ({
  restaurant,
  tableNumber,
  onViewMenu,
  onBookTable,
  onCallWaiter,
  onViewReviews,
  onOpenStaffLogin
}) => {
  const phone = restaurant?.phone || '+91 98234 56789';
  const whatsappNumber = (restaurant?.whatsapp || '919823456789').replace(/[^0-9]/g, '');

  return (
    <div className="min-h-screen bg-[#FFF9F0] text-[#282321] flex flex-col justify-between selection:bg-[#C49A52] selection:text-white">
      {/* Top Auspicious Header with subtle Ganesha blessings */}
      <div className="bg-[#641C24] text-[#FFF9F0] px-4 py-2 text-center text-xs tracking-wider flex items-center justify-center gap-2 border-b border-[#C49A52]/40">
        <span className="text-[#C49A52]">॥ श्री गणेशाय नमः ॥</span>
        <span className="text-white/70 hidden sm:inline">•</span>
        <span className="hidden sm:inline text-white/90">Celebrating 23 Years of Authentic Hospitality</span>
      </div>

      {/* Main Hero Container */}
      <div className="max-w-2xl mx-auto w-full px-5 py-8 flex flex-col items-center text-center">
        {/* Brand Logo */}
        <div className="mb-6 transform hover:scale-105 transition-transform duration-300">
          <EkdantLogo size="lg" />
        </div>

        {/* Detected Table Banner */}
        {tableNumber ? (
          <div className="w-full bg-[#641C24]/10 border-2 border-[#C49A52] rounded-2xl p-4 mb-6 shadow-sm flex items-center justify-between">
            <div className="text-left">
              <span className="text-xs uppercase tracking-widest text-[#852D34] font-bold">QR Detected Table</span>
              <h2 className="text-2xl font-bold font-serif-royal text-[#641C24]">Table {tableNumber}</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
                Active Dining Session
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full bg-amber-50 border border-amber-300 rounded-2xl p-3 mb-6 text-sm text-amber-900 flex items-center justify-center gap-2">
            <span>Table not detected automatically.</span>
            <button 
              onClick={onViewMenu}
              className="text-[#641C24] font-bold underline cursor-pointer"
            >
              Browse digital menu
            </button>
          </div>
        )}

        {/* Hero Imagery Card */}
        <div className="relative w-full rounded-3xl overflow-hidden shadow-2xl mb-6 border-2 border-[#C49A52]/40 group">
          <img 
            src="https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=1200&q=85" 
            alt="Hotel Ekdant Traditional Indian Family Feast & Ambience"
            className="w-full h-64 sm:h-72 object-cover group-hover:scale-105 transition-transform duration-700" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent flex flex-col justify-end p-5 sm:p-6 text-left text-white">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="bg-[#C49A52] text-[#641C24] font-bold text-[11px] px-3 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                AC & Non-AC Dining
              </span>
              <span className="bg-black/60 text-[#FFF9F0] text-[11px] font-semibold px-2.5 py-0.5 rounded-full backdrop-blur-md border border-white/20">
                23 Years Legacy
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-serif-royal font-bold text-[#FFF9F0] leading-tight">
              Welcome to Traditional Taste & Royal Hospitality
            </h3>
            <p className="text-xs sm:text-sm text-white/90 line-clamp-2 mt-1 font-light leading-relaxed">
              Experience authentic Maharashtrian specialties, sizzling tandoori gravies, fragrant dum biryanis, and coastal flavours.
            </p>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="w-full space-y-3 mb-8">
          <button 
            onClick={onViewMenu}
            className="w-full bg-[#641C24] hover:bg-[#852D34] active:scale-[0.99] text-[#FFF9F0] py-4 px-6 rounded-xl font-semibold text-lg flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all cursor-pointer border border-[#C49A52]/50"
          >
            <UtensilsCrossed className="w-6 h-6 text-[#C49A52]" />
            <span>Browse Menu & Order Food</span>
            <ChevronRight className="w-5 h-5 ml-auto text-[#C49A52]" />
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={onBookTable}
              className="bg-[#FFF9F0] hover:bg-amber-50 active:scale-[0.99] text-[#641C24] py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border-2 border-[#641C24] shadow-sm transition-all cursor-pointer"
            >
              <CalendarCheck className="w-4 h-4 text-[#852D34]" />
              <span>Book a Table</span>
            </button>

            {onViewReviews ? (
              <button 
                onClick={onViewReviews}
                className="bg-[#FFF9F0] hover:bg-amber-50 active:scale-[0.99] text-[#641C24] py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border-2 border-[#C49A52] shadow-sm transition-all cursor-pointer"
              >
                <Award className="w-4 h-4 text-[#C49A52]" />
                <span>Guest Reviews</span>
              </button>
            ) : tableNumber ? (
              <button 
                onClick={onCallWaiter}
                className="bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Phone className="w-4 h-4 text-emerald-200" />
                <span>Call Waiter</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Quick Contact & WhatsApp Actions */}
        <div className="w-full bg-white/70 border border-[#C49A52]/30 rounded-2xl p-4 shadow-sm mb-6 text-sm">
          <h4 className="font-serif-royal font-bold text-[#641C24] mb-3 text-base">Direct Assistance & Inquiries</h4>
          <div className="grid grid-cols-2 gap-3">
            <a 
              href={`tel:${phone}`}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-[#282321] font-medium text-xs transition-colors"
            >
              <Phone className="w-4 h-4 text-[#641C24]" />
              <span>Call Restaurant</span>
            </a>
            <a 
              href={`https://wa.me/${whatsappNumber}?text=Namaskar%20Hotel%20Ekdant,%20I%20would%20like%20to%20inquire%20about%20a%20table%20reservation`}
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] font-medium text-xs transition-colors border border-[#25D366]/30"
            >
              <MessageSquare className="w-4 h-4 text-[#25D366]" />
              <span>WhatsApp Us</span>
            </a>
          </div>
        </div>

        {/* Restaurant Heritage Highlights */}
        <div className="grid grid-cols-3 gap-2 w-full text-center py-4 border-y border-[#C49A52]/30 text-xs">
          <div className="flex flex-col items-center">
            <Award className="w-5 h-5 text-[#C49A52] mb-1" />
            <span className="font-bold text-[#641C24]">23+ Years</span>
            <span className="text-gray-600">Culinary Trust</span>
          </div>
          <div className="flex flex-col items-center border-x border-[#C49A52]/30 px-2">
            <ShieldCheck className="w-5 h-5 text-[#258451] mb-1" />
            <span className="font-bold text-[#641C24]">100% Pure Taste</span>
            <span className="text-gray-600">Separate Kitchens</span>
          </div>
          <div className="flex flex-col items-center">
            <Clock className="w-5 h-5 text-[#852D34] mb-1" />
            <span className="font-bold text-[#641C24]">11 AM - 11:30 PM</span>
            <span className="text-gray-600">Open Everyday</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#641C24] text-[#FFF9F0] py-6 px-4 text-center text-xs border-t border-[#C49A52]/40">
        <p className="font-serif-royal text-base text-[#C49A52] mb-1">Hotel Ekdant Family Restaurant</p>
        <p className="text-white/80">{restaurant?.address || "Near Shree Ganesh Mandir, Kolhapur Road, Maharashtra"}</p>
        <p className="text-white/60 mt-1">FSSAI Lic No: {restaurant?.fssai || "11521034000189"} • GSTIN: {restaurant?.gstin || "27AABCE1234F1Z5"}</p>
        
        {onOpenStaffLogin && (
          <div className="mt-4 pt-3 border-t border-white/10 flex justify-center">
            <button
              onClick={onOpenStaffLogin}
              className="bg-black/40 hover:bg-black/60 border border-[#C49A52]/40 text-[#C49A52] hover:text-amber-200 text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
            >
              <span>🔑 Staff, Cashier & Kitchen Desk Login (स्टाफ लॉगिन)</span>
            </button>
          </div>
        )}

        <p className="text-white/40 mt-3 text-[10px]">© 2026 Hotel Ekdant. All rights reserved.</p>
      </footer>
    </div>
  );
};
