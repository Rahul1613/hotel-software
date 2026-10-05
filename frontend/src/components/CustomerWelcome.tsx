import React from 'react';
import { EkdantLogo } from './EkdantLogo';
import { 
  UtensilsCrossed, CalendarCheck, Phone, MessageSquare, 
  Award, ShieldCheck, ChevronRight, Globe, ChefHat, ArrowRight 
} from 'lucide-react';
import type { RestaurantInfo } from '../types';
import { useNavigate } from 'react-router-dom';
import { translations, type Language } from '../utils/i18n';

interface WelcomeProps {
  restaurant: RestaurantInfo | null;
  tableNumber: string | null;
  language: Language;
  onToggleLanguage: () => void;
  onSelectTable?: (tbl: string) => void;
}

export const CustomerWelcome: React.FC<WelcomeProps> = ({
  restaurant,
  tableNumber,
  language,
  onToggleLanguage,
  onSelectTable
}) => {
  const navigate = useNavigate();
  const t = translations[language];
  const phone = restaurant?.phone || '+91 98234 56789';
  const whatsappNumber = (restaurant?.whatsapp || '919823456789').replace(/[^0-9]/g, '');
  const activeOrderId = localStorage.getItem('ekdant_active_order_id');

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const forceHome = params.get('home') === 'true';
    if (activeOrderId && !forceHome) {
      navigate(`/track/${activeOrderId}`, { replace: true });
    }
  }, [activeOrderId]);

  return (
    <div className="min-h-screen bg-[#FFF9F0] text-[#282321] flex flex-col justify-between selection:bg-[#C49A52] selection:text-white">
      {/* Auspicious Header with Language Switcher */}
      <div className="bg-[#641C24] text-[#FFF9F0] px-4 py-2 text-center text-xs tracking-wider flex items-center justify-between border-b border-[#C49A52]/40">
        <div className="flex items-center gap-2 mx-auto">
          <span className="text-[#C49A52]">{t.welcome}</span>
          <span className="text-white/70 hidden sm:inline">•</span>
          <span className="hidden sm:inline text-white/90">{t.tagline}</span>
        </div>
        <button
          onClick={onToggleLanguage}
          className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-[#C49A52] px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-all border border-[#C49A52]/40 shadow-2xs"
          title={language === 'en' ? 'मराठीमध्ये बदला (Switch to Marathi)' : 'Switch to English'}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{language === 'en' ? 'मराठी' : 'English'}</span>
        </button>
      </div>

      <div className="max-w-2xl mx-auto w-full px-5 py-8 flex flex-col items-center text-center">
        <div className="mb-6 transform hover:scale-105 transition-transform duration-300">
          <EkdantLogo size="lg" />
        </div>

        {/* Detected Table Banner or Quick Table Selection */}
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
              {onSelectTable && (
                <button
                  onClick={() => onSelectTable('')}
                  className="text-[11px] text-[#641C24] underline font-bold ml-1 cursor-pointer"
                >
                  Change
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full bg-amber-50/90 border border-amber-300 rounded-2xl p-4 mb-6 text-left shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#641C24] uppercase tracking-wider">
                📍 Sitting at a Table? Tap your Table Number:
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase shrink-0">AC Dining:</span>
                {['01', '02', '03', '04', '05'].map(num => (
                  <button
                    key={num}
                    onClick={() => onSelectTable && onSelectTable(num)}
                    className="py-1 px-2.5 bg-white hover:bg-[#641C24] hover:text-white border border-[#C49A52]/40 rounded-lg text-xs font-bold text-[#641C24] transition-all cursor-pointer shadow-2xs"
                  >
                    T-{num}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-[10px] font-bold text-gray-500 uppercase shrink-0">Non-AC:</span>
                {['06', '07', '08', '09', '10', '11'].map(num => (
                  <button
                    key={num}
                    onClick={() => onSelectTable && onSelectTable(num)}
                    className="py-1 px-2.5 bg-white hover:bg-[#641C24] hover:text-white border border-[#C49A52]/40 rounded-lg text-xs font-bold text-[#641C24] transition-all cursor-pointer shadow-2xs"
                  >
                    T-{num}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Active Dining Order Alert (Customer Never Loses Their Order) */}
        {activeOrderId && (
          <div className="w-full bg-[#641C24] text-[#FFF9F0] border-2 border-[#C49A52] rounded-2xl p-4 mb-6 shadow-xl flex items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFF9F0]/10 border border-[#C49A52]/50 flex items-center justify-center shrink-0">
                <ChefHat className="w-5 h-5 text-[#C49A52] animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider text-[#C49A52] font-bold">
                    Active Order in Kitchen
                  </span>
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <p className="text-sm font-bold text-white mt-0.5">Your meal is currently in progress</p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/track/${activeOrderId}`)}
              className="bg-[#C49A52] hover:bg-[#d6aa5f] text-[#282321] font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-1.5 shadow-md shrink-0 cursor-pointer transition-colors"
            >
              <span>Track Live Bill</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Hero Imagery Card */}
        <div className="relative w-full rounded-3xl overflow-hidden shadow-2xl mb-6 border-2 border-[#C49A52]/40">
          <img
            src="/hero.png"
            onError={(e: any) => { e.target.src = "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=1200&q=85"; }}
            alt="Hotel Ekdant Authentic Family Feast"
            width={1200}
            height={600}
            className="w-full h-64 sm:h-72 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent flex flex-col justify-end p-5 sm:p-6 text-left text-white">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="bg-[#C49A52] text-[#641C24] font-bold text-[11px] px-3 py-0.5 rounded-full uppercase tracking-wider">
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
              Experience authentic Maharashtrian thalis, fragrant dum biryanis, and coastal seafood curries.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-3 mb-8">
          <button
            onClick={() => navigate('/menu')}
            className="w-full bg-[#641C24] hover:bg-[#852D34] text-[#FFF9F0] py-4 px-6 rounded-xl font-semibold text-lg flex items-center justify-center gap-3 shadow-lg transition-all cursor-pointer border border-[#C49A52]/50"
          >
            <UtensilsCrossed className="w-6 h-6 text-[#C49A52]" />
            <span>{t.browse_menu}</span>
            <ChevronRight className="w-5 h-5 ml-auto text-[#C49A52]" />
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/book')}
              className="bg-[#FFF9F0] hover:bg-amber-50 text-[#641C24] py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border-2 border-[#641C24] cursor-pointer"
            >
              <CalendarCheck className="w-4 h-4 text-[#852D34]" />
              <span>{t.book_table}</span>
            </button>

            <button
              onClick={() => navigate('/reviews')}
              className="bg-[#FFF9F0] hover:bg-amber-50 text-[#641C24] py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border-2 border-[#C49A52] cursor-pointer"
            >
              <Award className="w-4 h-4 text-[#C49A52]" />
              <span>{t.guest_reviews}</span>
            </button>
          </div>
        </div>

        {/* Direct Contacts */}
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

        {/* Heritage Trust Badges */}
        <div className="grid grid-cols-3 gap-2 w-full text-center py-4 border-y border-[#C49A52]/30 text-xs">
          <div className="flex flex-col items-center">
            <Award className="w-5 h-5 text-[#C49A52] mb-1" />
            <span className="font-bold text-[#641C24]">23+ Years</span>
            <span className="text-gray-600">Culinary Trust</span>
          </div>
          <div className="flex flex-col items-center border-x border-[#C49A52]/30 px-2">
            <ShieldCheck className="w-5 h-5 text-[#258451] mb-1" />
            <span className="font-bold text-[#641C24]">100% Pure Taste</span>
            <span className="text-gray-600">Fresh Ingredients</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-sm font-bold text-[#852D34]">11:00 AM</span>
            <span className="font-bold text-[#641C24]">To 11:30 PM</span>
            <span className="text-gray-600">Open Everyday</span>
          </div>
        </div>
      </div>

      <footer className="bg-[#641C24] text-[#FFF9F0] py-6 px-4 text-center text-xs border-t border-[#C49A52]/40">
        <p className="font-serif-royal text-base text-[#C49A52] mb-1">Hotel Ekdant Family Restaurant</p>
        <p className="text-white/80">{restaurant?.address || "Near Shree Ganesh Mandir, Main Road, Maharashtra"}</p>
        <p className="text-white/60 mt-1">FSSAI: {restaurant?.fssai} • GSTIN: {restaurant?.gstin}</p>

        <div className="mt-4 pt-3 border-t border-white/10 flex justify-center">
          <button
            onClick={() => navigate('/login')}
            className="bg-black/40 hover:bg-black/60 border border-[#C49A52]/40 text-[#C49A52] hover:text-amber-200 text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer"
          >
            <span>🔑 {t.staff_login}</span>
          </button>
        </div>
        <p className="text-white/40 mt-3 text-[10px]">© 2026 Hotel Ekdant. All rights reserved.</p>
      </footer>
    </div>
  );
};
