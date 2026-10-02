import React, { useEffect, useState } from 'react';
import { EkdantLogo } from './EkdantLogo';
import { 
  CheckCircle, Clock, Utensils, ChefHat, 
  CheckCheck, ArrowRight, BellRing, Phone, RefreshCw 
} from 'lucide-react';
import type { Order } from '../types';

interface TrackingProps {
  orderId: number;
  onOrderMore: () => void;
  onRequestService: (type: 'CALL_WAITER' | 'WATER_REQUEST' | 'BILL_REQUEST') => void;
}

export const OrderTracking: React.FC<TrackingProps> = ({
  orderId,
  onOrderMore,
  onRequestService
}) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/orders?status=`);
      const allOrders: Order[] = await res.json();
      const current = allOrders.find(o => o.id === orderId);
      if (current) {
        setOrder(current);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 4000); // Polling fallback in addition to socket
    return () => clearInterval(interval);
  }, [orderId]);

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
    { key: 'READY', label: 'Ready to Serve', desc: 'Hot & fresh on pickup tray', icon: Utensils },
    { key: 'SERVED', label: 'Served at Table', desc: 'Enjoy your meal!', icon: CheckCheck },
  ];

  const currentStatus = order?.status || 'RECEIVED';
  const getStepIndex = (st: string) => {
    const idx = steps.findIndex(s => s.key === st);
    return idx === -1 ? (st === 'COMPLETED' ? 5 : 0) : idx;
  };
  const activeStepIdx = getStepIndex(currentStatus);

  return (
    <div className="min-h-screen bg-[#FFF9F0] text-[#282321] px-4 py-8 max-w-xl mx-auto flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="text-center mb-6">
          <EkdantLogo size="sm" showSubtitle={false} />
          <div className="mt-4 inline-flex items-center gap-2 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-300">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Order Confirmed & Logged</span>
          </div>
          <h1 className="text-2xl font-serif-royal font-bold text-[#641C24] mt-2">
            Table {order?.table_number}
          </h1>
          <p className="text-xs text-gray-500 font-mono">Order #{order?.order_number}</p>
        </div>

        {/* Live Progress Stepper */}
        <div className="bg-white rounded-2xl p-5 border border-[#C49A52]/30 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Live Preparation Status
            </span>
            <button 
              onClick={fetchOrder}
              className="text-xs text-[#641C24] flex items-center gap-1 hover:underline cursor-pointer"
            >
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
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 z-10 transition-colors ${iconBg}`}>
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
        </div>

        {/* Ordered Items Summary */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm mb-6">
          <h3 className="font-serif-royal font-bold text-[#641C24] text-sm mb-3">Order Details</h3>
          <div className="space-y-2 text-xs divide-y divide-gray-100">
            {order?.items.map(it => (
              <div key={it.id} className="pt-2 first:pt-0 flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-800">{it.item_name}</span>
                  <span className="text-gray-500 ml-1.5 font-bold">× {it.quantity}</span>
                  {it.customization && (
                    <p className="text-[10px] text-amber-700 italic">{it.customization}</p>
                  )}
                </div>
                <span className="font-semibold text-gray-700">₹{it.total_price.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 mt-4 pt-3 space-y-1 text-xs">
            <div className="flex justify-between text-gray-500">
              <span>Taxes (5% GST):</span>
              <span>₹{((order?.cgst_amount || 0) + (order?.sgst_amount || 0)).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm text-[#641C24] pt-1">
              <span>Final Bill:</span>
              <span>₹{order?.final_amount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Table Calling Quick Buttons */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          <button 
            onClick={() => onRequestService('CALL_WAITER')}
            className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-white border border-[#C49A52]/40 text-xs font-semibold text-[#641C24] hover:bg-amber-50 cursor-pointer shadow-2xs"
          >
            <BellRing className="w-4 h-4 text-[#C49A52]" />
            <span>Call Waiter</span>
          </button>
          <button 
            onClick={() => onRequestService('WATER_REQUEST')}
            className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-white border border-blue-200 text-xs font-semibold text-blue-900 hover:bg-blue-50 cursor-pointer shadow-2xs"
          >
            <span>Request Fresh Water</span>
          </button>
        </div>
      </div>

      {/* Action Footer */}
      <div className="space-y-3 pt-4 border-t border-gray-200">
        <button
          onClick={onOrderMore}
          className="w-full bg-[#641C24] hover:bg-[#852D34] text-[#FFF9F0] py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer"
        >
          <span>Order More Dishes for Table</span>
          <ArrowRight className="w-4 h-4 text-[#C49A52]" />
        </button>
      </div>
    </div>
  );
};
