import React, { useEffect, useState } from 'react';
import { EkdantLogo } from './EkdantLogo';
import { 
  CheckCircle, Clock, Utensils, ChefHat, 
  CheckCheck, ArrowRight, BellRing, RefreshCw, XCircle 
} from 'lucide-react';
import type { Order } from '../types';
import { formatINR } from '../utils/money';
import { apiRequest } from '../api';
import { useParams, useNavigate } from 'react-router-dom';
import { translations, type Language } from '../utils/i18n';

interface OrderTrackingProps {
  language: Language;
}

export const OrderTracking: React.FC<OrderTrackingProps> = ({ language }) => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const t = translations[language];

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchOrder = async () => {
    if (!orderId) return;
    try {
      const savedToken = localStorage.getItem(`order_token_${orderId}`);
      const url = savedToken ? `/api/orders/${orderId}?token=${savedToken}` : `/api/orders/${orderId}`;
      const data = await apiRequest<Order>(url);
      setOrder(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 25000); // 25s fallback poll
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
      fetchOrder();
    } catch (err: any) {
      alert(err.message || 'Cannot cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleServiceRequest = async (type: string) => {
    if (!order?.table_number) return;
    try {
      await apiRequest('/api/service-requests', {
        method: 'POST',
        body: JSON.stringify({
          table_number: order.table_number,
          request_type: type,
        }),
      });
      alert('Service request sent to staff!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading && !order) {
    return (
      <div className="min-h-screen bg-[#FFF9F0] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#641C24] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const steps = [
    { key: 'RECEIVED', label: 'Order Received', desc: 'Sent to restaurant kitchen', icon: Clock },
    { key: 'ACCEPTED', label: 'Accepted', desc: 'Kitchen acknowledged order', icon: CheckCircle },
    { key: 'PREPARING', label: 'Cooking & Preparing', desc: 'Chefs are crafting your dish', icon: ChefHat },
    { key: 'READY', label: 'Ready to Serve', desc: 'Fresh on pickup tray', icon: Utensils },
    { key: 'SERVED', label: 'Served at Table', desc: 'Enjoy your meal!', icon: CheckCheck },
  ];

  const currentStatus = order?.status || 'RECEIVED';
  const activeStepIdx = steps.findIndex(s => s.key === currentStatus);

  return (
    <div className="min-h-screen bg-[#FFF9F0] text-[#282321] px-4 py-8 max-w-xl mx-auto flex flex-col justify-between font-sans">
      <div>
        <div className="text-center mb-6">
          <EkdantLogo size="sm" showSubtitle={false} />
          <div className="mt-4 inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-300">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Order Confirmed & Logged</span>
          </div>
          <h1 className="text-2xl font-serif-royal font-bold text-[#641C24] mt-2">
            {order?.table_number ? `Table ${order.table_number}` : 'Takeaway Parcel'}
          </h1>
          <p className="text-xs text-gray-500 font-mono">Order #{order?.order_number}</p>
          {order?.estimated_wait_minutes && order.status !== 'SERVED' && order.status !== 'COMPLETED' && (
            <p className="text-xs text-amber-900 font-bold bg-amber-100 px-3 py-1 rounded-full inline-block mt-2">
              ⏳ Estimated Wait: ~{order.estimated_wait_minutes} mins
            </p>
          )}
        </div>

        {/* Stepper */}
        <div className="bg-white rounded-2xl p-5 border border-[#C49A52]/30 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Live Preparation Status
            </span>
            <button onClick={fetchOrder} className="text-xs text-[#641C24] flex items-center gap-1 cursor-pointer">
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

        {/* Order Details */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm mb-6">
          <h3 className="font-serif-royal font-bold text-[#641C24] text-sm mb-3">Order Details</h3>
          <div className="space-y-2 text-xs divide-y divide-gray-100">
            {order?.items.map(it => (
              <div key={it.id} className="pt-2 first:pt-0 flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-800">{it.item_name}</span>
                  <span className="text-gray-500 ml-1.5 font-bold">× {it.quantity}</span>
                </div>
                <span className="font-semibold text-gray-700">{formatINR(it.total_price)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 mt-4 pt-3 flex justify-between font-bold text-sm text-[#641C24]">
            <span>Bill Total (GST Inc):</span>
            <span>{formatINR(order?.final_amount || 0)}</span>
          </div>
        </div>

        {/* Call Waiter */}
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

      <div className="space-y-3 pt-4 border-t border-gray-200">
        <button
          onClick={() => navigate('/menu')}
          className="w-full bg-[#641C24] hover:bg-[#852D34] text-[#FFF9F0] py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer"
        >
          <span>{t.order_more}</span>
          <ArrowRight className="w-4 h-4 text-[#C49A52]" />
        </button>
      </div>
    </div>
  );
};
