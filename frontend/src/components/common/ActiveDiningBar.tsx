import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChefHat, ArrowRight, Utensils, CheckCircle } from 'lucide-react';
import { formatINR } from '../../utils/money';
import { apiRequest } from '../../api';
import type { Language } from '../../utils/i18n';

interface ActiveDiningBarProps {
  language?: Language;
}

export const ActiveDiningBar: React.FC<ActiveDiningBarProps> = ({ language }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentLang: Language = language || (localStorage.getItem('ekdant_language') as Language) || 'en';
  const isMr = currentLang === 'mr';

  const [activeSession, setActiveSession] = useState<{
    latest_order_id: number;
    latest_order_number: string;
    latest_order_status: string;
    table_number: string | null;
    running_final_amount: number;
    orders_count: number;
  } | null>(null);

  const fetchSessionStatus = async () => {
    // Check if we have an active order or table saved
    const activeOrderId = localStorage.getItem('ekdant_active_order_id');
    const activeTable = localStorage.getItem('ekdant_active_table');
    const orderToken = activeOrderId ? localStorage.getItem(`order_token_${activeOrderId}`) : null;

    if (!activeOrderId && !activeTable) {
      setActiveSession(null);
      return;
    }

    try {
      let query = '';
      if (orderToken) query = `order_token=${orderToken}`;
      else if (activeTable) query = `table=${activeTable}`;

      if (query) {
        const res = await apiRequest<any>(`/api/orders/active-session?${query}`);
        if (res && res.active && !res.is_billed) {
          setActiveSession({
            latest_order_id: res.latest_order_id,
            latest_order_number: res.latest_order_number,
            latest_order_status: res.latest_order_status,
            table_number: res.table_number,
            running_final_amount: res.running_final_amount,
            orders_count: res.orders_count,
          });
        } else {
          setActiveSession(null);
        }
      }
    } catch {
      // Quiet fail if offline or not found
    }
  };

  useEffect(() => {
    fetchSessionStatus();
    const interval = setInterval(fetchSessionStatus, 15000); // 15s poll
    return () => clearInterval(interval);
  }, [location.pathname]);

  // Don't show the floating bar if user is ALREADY on the tracking page or staff pages
  if (
    !activeSession ||
    location.pathname.startsWith('/track') ||
    location.pathname.startsWith('/staff') ||
    location.pathname.startsWith('/kitchen') ||
    location.pathname.startsWith('/admin')
  ) {
    return null;
  }

  const statusLabel =
    activeSession.latest_order_status === 'PREPARING'
      ? (isMr ? 'स्वयंपाकघरात तयार होत आहे' : 'Cooking in Kitchen')
      : activeSession.latest_order_status === 'READY'
      ? (isMr ? 'वाढण्यासाठी तयार' : 'Ready to Serve')
      : activeSession.latest_order_status === 'SERVED'
      ? (isMr ? 'टेबलवर दिले' : 'Served at Table')
      : (isMr ? 'ऑर्डर प्राप्त झाली' : 'Order Received');

  return (
    <aside
      aria-label="Active order status"
      className="fixed bottom-4 left-4 right-4 max-w-xl mx-auto z-40 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
    >
      <div className="bg-[#641C24] text-[#FFF9F0] rounded-2xl p-3.5 shadow-2xl border-2 border-[#C49A52] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#FFF9F0]/10 border border-[#C49A52]/50 flex items-center justify-center shrink-0">
            {activeSession.latest_order_status === 'SERVED' ? (
              <CheckCircle className="w-5 h-5 text-emerald-300" />
            ) : (
              <ChefHat className="w-5 h-5 text-[#C49A52] animate-bounce" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#C49A52] uppercase tracking-wider">
                {activeSession.table_number ? (isMr ? `टेबल ${activeSession.table_number}` : `Table ${activeSession.table_number}`) : (isMr ? 'पार्सल' : 'Takeaway')}
              </span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-white/90 font-medium truncate">{statusLabel}</span>
            </div>
            <p className="text-xs font-bold text-white truncate">
              {isMr ? 'चालू बिल:' : 'Running Bill:'} {formatINR(activeSession.running_final_amount)}
              {activeSession.orders_count > 1 && (
                <span className="text-[10px] text-white/70 ml-1 font-normal">
                  {isMr ? `(सत्रातील ${activeSession.orders_count} ऑर्डर्स)` : `(${activeSession.orders_count} orders in sitting)`}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => navigate(`/track/${activeSession.latest_order_id}`)}
            className="bg-[#C49A52] hover:bg-[#d6aa5f] text-[#282321] font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1 shadow-md cursor-pointer transition-colors"
          >
            <span>{isMr ? 'ट्रॅक व बिल' : 'Track & Bill'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
