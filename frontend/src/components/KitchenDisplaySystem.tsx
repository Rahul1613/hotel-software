import React, { useState, useEffect } from 'react';
import { ChefHat, Clock, CheckCircle2, Flame, ArrowLeft, RefreshCw, Volume2, VolumeX, Printer } from 'lucide-react';
import { soundManager } from '../utils/soundManager';
import type { Order } from '../types';

interface KDSProps {
  onBack: () => void;
}

export const KitchenDisplaySystem: React.FC<KDSProps> = ({ onBack }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stationFilter, setStationFilter] = useState<'ALL' | 'FOOD' | 'BEVERAGE'>('ALL');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const printUrlViaIframe = (url: string) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          window.open(url, '_blank');
        }
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch {}
        }, 3000);
      }, 300);
    };
    iframe.src = url;
  };

  const fetchKitchenOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      const data: Order[] = await res.json();
      if (Array.isArray(data)) {
        // Kitchen displays active orders: ACCEPTED, PREPARING, READY
        const active = data.filter(o => ['RECEIVED', 'ACCEPTED', 'PREPARING'].includes(o.status));
        setOrders(active);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchKitchenOrders();
    const interval = setInterval(fetchKitchenOrders, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (orderId: number, status: string) => {
    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchKitchenOrders();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-[#1F1D1D] text-white flex flex-col font-sans select-none">
      {/* KDS Header */}
      <header className="bg-[#141212] border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <ChefHat className="w-7 h-7 text-[#C49A52]" />
            <h1 className="text-xl font-bold tracking-wider font-serif-royal text-[#FFF9F0]">
              HOTEL EKDANT — KITCHEN DISPLAY (KDS)
            </h1>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-800 rounded-lg p-1 text-xs">
            <button 
              onClick={() => setStationFilter('ALL')}
              className={`px-3 py-1 rounded font-bold cursor-pointer ${stationFilter === 'ALL' ? 'bg-[#641C24] text-white' : 'text-gray-400'}`}
            >
              All Kitchen
            </button>
            <button 
              onClick={() => setStationFilter('FOOD')}
              className={`px-3 py-1 rounded font-bold cursor-pointer ${stationFilter === 'FOOD' ? 'bg-[#641C24] text-white' : 'text-gray-400'}`}
            >
              Curry & Tandoor
            </button>
          </div>

          <button 
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              soundManager.setSoundEnabled(next);
            }}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 cursor-pointer"
          >
            {soundEnabled ? <Volume2 className="w-5 h-5 text-emerald-400" /> : <VolumeX className="w-5 h-5 text-gray-500" />}
          </button>

          <button 
            onClick={fetchKitchenOrders}
            className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-xs px-3 py-2 rounded-lg cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Sync</span>
          </button>
        </div>
      </header>

      {/* Grid of Kitchen Tickets */}
      <main className="flex-1 p-6 overflow-y-auto">
        {orders.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center text-gray-500">
            <ChefHat className="w-16 h-16 text-gray-700 mb-3" />
            <p className="text-lg">All caught up! No pending food orders.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {orders.map(order => {
              const isCooking = order.status === 'PREPARING';

              return (
                <div 
                  key={order.id}
                  className={`rounded-2xl border-2 flex flex-col justify-between overflow-hidden shadow-2xl transition-all ${
                    isCooking 
                      ? 'border-amber-500 bg-[#282321]' 
                      : 'border-red-600 bg-[#241C1D] animate-pulse-subtle'
                  }`}
                >
                  {/* Ticket Header */}
                  <div className={`p-4 flex items-center justify-between border-b ${
                    isCooking ? 'bg-amber-600/30 border-amber-600' : 'bg-red-700/40 border-red-600'
                  }`}>
                    <div>
                      <h2 className="text-2xl font-black tracking-tight text-white font-serif-royal">
                        Table {order.table_number}
                      </h2>
                      <span className="text-[11px] text-gray-300 font-mono">
                        {order.order_number}
                      </span>
                    </div>

                    <div className="text-right flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => printUrlViaIframe(`/api/orders/${order.id}/kot/html`)}
                          className="bg-white/10 hover:bg-white/20 active:scale-95 text-white text-[10px] font-bold px-2 py-0.5 rounded border border-white/20 flex items-center gap-1 cursor-pointer transition-colors"
                          title="Print Kitchen Order Ticket"
                        >
                          <Printer className="w-3 h-3 text-amber-300" />
                          <span>Print</span>
                        </button>
                        <span className={`text-xs font-black px-2 py-0.5 rounded-full uppercase ${
                          isCooking ? 'bg-amber-400 text-black' : 'bg-red-500 text-white animate-bounce'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-300 flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" /> {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  {/* Items list */}
                  <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-80 divide-y divide-gray-700/60 text-sm">
                    {order.items.map(it => (
                      <div key={it.id} className="pt-2.5 first:pt-0">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2">
                            <span className="text-lg font-black text-[#C49A52]">
                              {it.quantity}×
                            </span>
                            <div>
                              <p className="font-bold text-base text-gray-100">{it.item_name}</p>
                              {it.customization && (
                                <p className="text-xs text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded mt-1 border border-amber-800">
                                  {it.customization}
                                </p>
                              )}
                              {it.selected_addons && it.selected_addons.length > 0 && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  + {it.selected_addons.map((a: any) => a.name).join(', ')}
                                </p>
                              )}
                            </div>
                          </div>

                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            it.is_veg ? 'bg-emerald-900 text-emerald-300' : 'bg-red-950 text-red-300'
                          }`}>
                            {it.is_veg ? 'Veg' : 'Non-Veg'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {order.special_instructions && (
                    <div className="px-4 py-2 bg-yellow-950/40 border-t border-yellow-800/40 text-xs text-yellow-300">
                      <strong>Special:</strong> {order.special_instructions}
                    </div>
                  )}

                  {/* Big KDS Action Buttons for Kitchen Staff */}
                  <div className="p-3 bg-black/40 border-t border-gray-800 grid grid-cols-2 gap-2">
                    {order.status !== 'PREPARING' ? (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'PREPARING')}
                        className="col-span-2 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                      >
                        <Flame className="w-5 h-5" />
                        <span>START PREPARING</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'READY')}
                        className="col-span-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black py-3 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>MARK READY TO SERVE</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
