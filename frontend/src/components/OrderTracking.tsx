import React, { useEffect, useState } from 'react';
import { EkdantLogo } from './EkdantLogo';
import { 
  CheckCircle, Clock, Utensils, ChefHat, 
  CheckCheck, ArrowRight, BellRing, RefreshCw, XCircle, 
  Star, Receipt, Sparkles, ShieldCheck, Globe 
} from 'lucide-react';
import type { Order } from '../types';
import { formatINR } from '../utils/money';
import { apiRequest } from '../api';
import { useParams, useNavigate } from 'react-router-dom';
import { translations, type Language } from '../utils/i18n';
import { ReviewModal } from './common/ReviewModal';

interface OrderTrackingProps {
  language: Language;
  onToggleLanguage?: () => void;
}

export const OrderTracking: React.FC<OrderTrackingProps> = ({ language, onToggleLanguage }) => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const t = translations[language];

  const [order, setOrder] = useState<Order | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [screenKeptOn, setScreenKeptOn] = useState(false);

  // 1. Screen Wake Lock: Keep phone screen ON while waiting for food
  useEffect(() => {
    let wakeLockSentinel: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
          setScreenKeptOn(true);
        }
      } catch (err) {
        console.log('Screen WakeLock not granted or supported:', err);
      }
    };
    requestWakeLock();

    return () => {
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, []);

  // 2. Fetch order & active session details
  const fetchOrderAndSession = async () => {
    if (!orderId) return;
    try {
      const savedToken = localStorage.getItem(`order_token_${orderId}`);
      const url = savedToken ? `/api/orders/${orderId}?token=${savedToken}` : `/api/orders/${orderId}`;
      const data = await apiRequest<Order>(url);
      setOrder(data);

      // Persist active order so user never loses it even if they navigate away
      localStorage.setItem('ekdant_active_order_id', String(data.id));
      if (data.table_number) {
        localStorage.setItem('ekdant_active_table', data.table_number);
      }

      // Fetch consolidated table session running bill
      const sessUrl = savedToken
        ? `/api/orders/active-session?order_token=${savedToken}`
        : data.table_number
        ? `/api/orders/active-session?table=${data.table_number}`
        : null;

      if (sessUrl) {
        const sData = await apiRequest<any>(sessUrl);
        if (sData && sData.active) {
          setSessionData(sData);
        }
      }
    } catch (e) {
      console.error('Failed to load order', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderAndSession();
    const interval = setInterval(fetchOrderAndSession, 15000); // 15s poll
    return () => clearInterval(interval);
  }, [orderId]);

  const handleCancelOrder = async () => {
    if (!order || !window.confirm('Cancel this pending order?')) return;
    setIsCancelling(true);
    try {
      const savedToken = localStorage.getItem(`order_token_${order.id}`);
      await apiRequest(`/api/orders/${order.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({
          order_token: savedToken,
          reason: cancelReason || 'Cancelled by guest',
        }),
      });
      localStorage.removeItem('ekdant_active_order_id');
      fetchOrderAndSession();
    } catch (err: any) {
      alert(err.message || 'Cannot cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleServiceRequest = async (type: string) => {
    const tbl = order?.table_number || sessionData?.table_number;
    if (!tbl) return;
    try {
      await apiRequest('/api/service-requests', {
        method: 'POST',
        body: JSON.stringify({
          table_number: tbl,
          request_type: type,
        }),
      });
      alert('Service request sent to staff!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleFinishSitting = () => {
    localStorage.removeItem('ekdant_active_order_id');
    navigate('/');
  };

  if (loading && !order) {
    return (
      <div className="min-h-screen bg-[#FFF9F0] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#641C24] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const steps = [
    { 
      key: 'RECEIVED', 
      label: language === 'mr' ? 'ऑर्डर प्राप्त झाली' : 'Order Received', 
      desc: language === 'mr' ? 'किचनमध्ये ऑर्डर पाठवली' : 'Sent to restaurant kitchen', 
      icon: Clock 
    },
    { 
      key: 'ACCEPTED', 
      label: language === 'mr' ? 'स्वीकारली' : 'Accepted', 
      desc: language === 'mr' ? 'किचनने ऑर्डर स्वीकारली' : 'Kitchen acknowledged order', 
      icon: CheckCircle 
    },
    { 
      key: 'PREPARING', 
      label: language === 'mr' ? 'तयार होत आहे' : 'Cooking & Preparing', 
      desc: language === 'mr' ? 'शेफ आपले जेवण बनवत आहेत' : 'Chefs are crafting your dish', 
      icon: ChefHat 
    },
    { 
      key: 'READY', 
      label: language === 'mr' ? 'वाढण्यासाठी तयार' : 'Ready to Serve', 
      desc: language === 'mr' ? 'गरमागरम पिकअप ट्रेवर तयार' : 'Fresh on pickup tray', 
      icon: Utensils 
    },
    { 
      key: 'SERVED', 
      label: language === 'mr' ? 'टेबलवर वाढले' : 'Served at Table', 
      desc: language === 'mr' ? 'स्वादिष्ट भोजनाचा आनंद घ्या!' : 'Enjoy your meal!', 
      icon: CheckCheck 
    },
  ];

  const currentStatus = order?.status || 'RECEIVED';
  const activeStepIdx = steps.findIndex(s => s.key === currentStatus);
  const isMealServed = currentStatus === 'SERVED' || currentStatus === 'COMPLETED';

  return (
    <div className="min-h-screen bg-[#FFF9F0] text-[#282321] px-4 py-6 max-w-xl mx-auto flex flex-col justify-between font-sans">
      <div>
        {/* Navigation & Language Switcher Bar */}
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#C49A52]/20">
          <button 
            onClick={() => navigate('/menu')}
            className="p-1.5 rounded-lg hover:bg-[#641C24]/10 text-[#641C24] transition-colors flex items-center gap-1 text-xs font-bold cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            <span>{language === 'mr' ? 'मेनूकडे जा' : 'Browse Menu'}</span>
          </button>
          
          {onToggleLanguage && (
            <button
              onClick={onToggleLanguage}
              className="flex items-center gap-1.5 bg-[#641C24]/10 hover:bg-[#641C24]/20 text-[#641C24] px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-colors border border-[#C49A52]/40 shadow-2xs"
              title={language === 'en' ? 'मराठीमध्ये बदला (Switch to Marathi)' : 'Switch to English'}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{language === 'en' ? 'मराठी' : 'English'}</span>
            </button>
          )}
        </div>

        {/* Header */}
        <div className="text-center mb-6">
          <EkdantLogo size="sm" showSubtitle={false} />
          
          <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-300">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>{language === 'mr' ? 'ऑर्डर सक्रिय व नोंदवली' : 'Order Active & Logged'}</span>
            </div>
            {screenKeptOn && (
              <span className="text-[10px] bg-amber-100 text-amber-900 font-semibold px-2 py-0.5 rounded-full border border-amber-300">
                💡 {language === 'mr' ? 'स्क्रीन चालू ठेवली आहे' : 'Screen kept awake'}
              </span>
            )}
          </div>

          <h1 className="text-2xl font-serif-royal font-bold text-[#641C24] mt-2">
            {order?.table_number ? `${language === 'mr' ? 'टेबल' : 'Table'} ${order.table_number}` : (language === 'mr' ? 'पार्सल' : 'Takeaway Parcel')}
          </h1>
          <p className="text-xs text-gray-500 font-mono">Order #{order?.order_number}</p>
          
          {order?.estimated_wait_minutes && !isMealServed && (
            <p className="text-xs text-amber-900 font-bold bg-amber-100 px-3.5 py-1.5 rounded-full inline-block mt-2 shadow-2xs border border-amber-300">
              ⏳ {language === 'mr' ? `अंदाजे वेळ: ~${order.estimated_wait_minutes} मिनिटे` : `Estimated Preparation: ~${order.estimated_wait_minutes} mins`}
            </p>
          )}
        </div>

        {/* Live Stepper */}
        <div className="bg-white rounded-2xl p-5 border border-[#C49A52]/30 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Live Cooking & Serving Status
            </span>
            <button onClick={fetchOrderAndSession} className="text-xs text-[#641C24] flex items-center gap-1 cursor-pointer font-semibold">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>

          <div className="space-y-4 relative before:absolute before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-gray-200">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isPast = idx < activeStepIdx;
              const isCurrent = idx === activeStepIdx;

              let iconBg = 'bg-gray-100 text-gray-400 border-gray-300';
              if (isPast) iconBg = 'bg-emerald-600 text-white border-emerald-600';
              if (isCurrent) iconBg = 'bg-[#641C24] text-[#C49A52] border-[#C49A52] ring-4 ring-[#641C24]/10';

              return (
                <div key={step.key} className="relative flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 z-10 ${iconBg}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 pt-0.5">
                    <h4 className={`text-sm font-bold ${isCurrent ? 'text-[#641C24]' : isPast ? 'text-gray-800' : 'text-gray-400'}`}>
                      {step.label}
                      {isCurrent && (
                        <span className="ml-2 text-[10px] font-semibold text-[#C49A52] bg-amber-50 px-2 py-0.5 rounded-full border border-[#C49A52]/40">
                          In Progress
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-gray-500">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cancellation allowed while RECEIVED */}
          {order?.status === 'RECEIVED' && (
            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={handleCancelOrder}
                disabled={isCancelling}
                className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel Order</span>
              </button>
            </div>
          )}
        </div>

        {/* Meal Served & Review Prompt Card */}
        {isMealServed && (
          <div className="bg-gradient-to-br from-[#FFF9F0] to-amber-50 rounded-2xl p-5 border-2 border-[#C49A52] shadow-md mb-6 text-center space-y-3">
            <div className="w-12 h-12 bg-[#641C24] text-[#C49A52] rounded-full flex items-center justify-center mx-auto shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-serif-royal font-bold text-[#641C24]">
                Meal Served! जेवणाचा आनंद घ्या!
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                Hope you are enjoying your food. Before you finish, please share your valuable review with us.
              </p>
            </div>
            <button
              onClick={() => setIsReviewOpen(true)}
              className="w-full bg-[#641C24] hover:bg-[#852D34] text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Star className="w-4 h-4 text-[#C49A52] fill-[#C49A52]" />
              <span>Leave a Review & Complete Sitting</span>
            </button>
          </div>
        )}

        {/* Consolidated Table Bill & Items */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif-royal font-bold text-[#641C24] text-sm flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-[#C49A52]" />
              <span>
                {sessionData && sessionData.orders_count > 1
                  ? `Consolidated Table Bill (${sessionData.orders_count} Orders)`
                  : 'Order Details'}
              </span>
            </h3>
            <span className="text-[10px] text-gray-400 font-mono">
              Table {order?.table_number || 'Takeaway'}
            </span>
          </div>

          {/* List items across session or this order */}
          <div className="space-y-2 text-xs divide-y divide-gray-100">
            {(sessionData?.items || order?.items || []).map((it: any) => (
              <div key={it.id} className="pt-2 first:pt-0 flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900">{it.item_name}</span>
                  <span className="text-gray-500 ml-1.5 font-bold">× {it.quantity}</span>
                  {it.order_number && (
                    <span className="text-[10px] text-gray-400 block font-mono">
                      #{it.order_number} ({it.item_status})
                    </span>
                  )}
                </div>
                <span className="font-semibold text-gray-800">{formatINR(it.total_price)}</span>
              </div>
            ))}
          </div>

          {/* Running total */}
          <div className="border-t-2 border-dashed border-[#C49A52]/40 mt-4 pt-3 flex justify-between font-bold text-base text-[#641C24]">
            <span>Total Bill Payable (GST Inc):</span>
            <span>{formatINR(sessionData?.running_final_amount || order?.final_amount || 0)}</span>
          </div>
        </div>

        {/* Service Requests (Call Waiter / Water) */}
        {order?.table_number && (
          <div className="grid grid-cols-2 gap-2 mb-6">
            <button
              onClick={() => handleServiceRequest('CALL_WAITER')}
              className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-white border border-[#C49A52]/40 text-xs font-semibold text-[#641C24] hover:bg-amber-50 cursor-pointer shadow-2xs"
            >
              <BellRing className="w-4 h-4 text-[#C49A52]" />
              <span>{t.call_waiter}</span>
            </button>
            <button
              onClick={() => handleServiceRequest('WATER_REQUEST')}
              className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-white border border-blue-200 text-xs font-semibold text-blue-900 hover:bg-blue-50 cursor-pointer shadow-2xs"
            >
              <span>{t.request_water}</span>
            </button>
          </div>
        )}
      </div>

      {/* Navigation Buttons: Order More or Finish */}
      <div className="space-y-2 pt-4 border-t border-gray-200">
        <button
          onClick={() => navigate('/menu')}
          className="w-full bg-[#641C24] hover:bg-[#852D34] text-[#FFF9F0] py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer"
        >
          <span>🍽️ {t.order_more}</span>
          <ArrowRight className="w-4 h-4 text-[#C49A52]" />
        </button>

        {isMealServed && (
          <button
            onClick={() => setIsReviewOpen(true)}
            className="w-full bg-[#C49A52] hover:bg-[#d4aa5d] text-[#282321] py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
          >
            <Star className="w-3.5 h-3.5" />
            <span>Rate Dining & Close Sitting</span>
          </button>
        )}
      </div>

      {/* Review Modal */}
      <ReviewModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        orderId={order?.id}
        orderNumber={order?.order_number}
        customerName={order?.customer_name}
        onSuccess={handleFinishSitting}
      />
    </div>
  );
};
