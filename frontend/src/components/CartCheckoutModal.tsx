import React, { useState } from 'react';
import type { CartItem, RestaurantInfo } from '../types';
import { FoodBadge } from './FoodBadge';
import { calculateCartGst, formatINR } from '../utils/money';
import { apiRequest } from '../api';
import { translations, type Language } from '../utils/i18n';
import { X, Trash2, Plus, Minus, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';

interface CartProps {
  restaurant: RestaurantInfo | null;
  tableNumber: string | null;
  language: Language;
  cart: CartItem[];
  onUpdateCartQty: (item: any, delta: number) => void;
  onRemoveItem: (index: number) => void;
  onCloseCart: () => void;
  onOrderSuccess: (orderData: any) => void;
  onSelectTable?: (tbl: string) => void;
}

export const CartCheckoutModal: React.FC<CartProps> = ({
  restaurant,
  tableNumber,
  language,
  cart,
  onUpdateCartQty,
  onRemoveItem,
  onCloseCart,
  onOrderSuccess,
  onSelectTable,
}) => {
  const t = translations[language];
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY'>(tableNumber ? 'DINE_IN' : 'TAKEAWAY');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const cgstRate = restaurant?.cgst_rate || 2.5;
  const sgstRate = restaurant?.sgst_rate || 2.5;

  const rawSubtotal = cart.reduce((sum, ci) => {
    const addonsTotal = (ci.selected_addons || []).reduce((aSum, a) => aSum + a.price, 0);
    return sum + (ci.item.price + addonsTotal) * ci.quantity;
  }, 0);

  const gst = calculateCartGst(rawSubtotal, 0, cgstRate, sgstRate, 0);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderType === 'DINE_IN' && !tableNumber) {
      setErrorMsg('Please select your table number.');
      return;
    }
    if (cart.length === 0) {
      setErrorMsg('Your order list is empty.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        order_type: orderType,
        table_number: orderType === 'DINE_IN' ? tableNumber : undefined,
        customer_name: customerName || 'Guest',
        customer_phone: customerPhone,
        special_instructions: specialInstructions,
        items: cart.map(ci => ({
          item_id: ci.item.id,
          quantity: ci.quantity,
          customization: ci.customization,
          selected_addons: ci.selected_addons,
        })),
      };

      const data = await apiRequest('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      onOrderSuccess(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with restaurant server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
      <div className="bg-[#FFF9F0] w-full max-w-lg h-full sm:h-auto sm:max-h-[92vh] rounded-none sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-[#C49A52]/40">
        <div className="bg-[#641C24] text-[#FFF9F0] px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onCloseCart} className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-serif-royal font-bold text-lg">{t.cart}</h2>
              <span className="text-xs text-[#C49A52]">
                {orderType === 'DINE_IN' && tableNumber ? `Table ${tableNumber}` : 'Takeaway Parcel'}
              </span>
            </div>
          </div>
          <button onClick={onCloseCart} className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-[#C83E3E] text-xs p-3 rounded-xl font-bold">
              {errorMsg}
            </div>
          )}

          {cart.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              Your cart is empty. Add dishes from the menu.
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                {cart.map((ci, index) => {
                  const addonsSum = (ci.selected_addons || []).reduce((s, a) => s + a.price, 0);
                  const itemTotal = (ci.item.price + addonsSum) * ci.quantity;

                  return (
                    <div key={`${ci.item.id}-${index}`} className="bg-white p-3 rounded-xl border border-gray-200 flex items-center justify-between gap-3 shadow-2xs">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <FoodBadge isVeg={ci.item.is_veg} foodType={ci.item.food_type} size="sm" />
                          <h4 className="font-semibold text-xs text-[#282321] truncate">{ci.item.name}</h4>
                        </div>
                        {ci.selected_addons && ci.selected_addons.length > 0 && (
                          <p className="text-[10px] text-gray-500 truncate">
                            Add-ons: {ci.selected_addons.map(a => a.name).join(', ')}
                          </p>
                        )}
                        <span className="text-xs font-bold text-[#641C24] block mt-1">{formatINR(itemTotal)}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                          <button onClick={() => onUpdateCartQty(ci.item, -1)} className="p-1 hover:bg-gray-200 rounded cursor-pointer">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold px-2">{ci.quantity}</span>
                          <button onClick={() => onUpdateCartQty(ci.item, 1)} className="p-1 hover:bg-gray-200 rounded cursor-pointer">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <button onClick={() => onRemoveItem(index)} className="text-gray-400 hover:text-red-600 p-1 cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Customer Dining Details */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
                <h3 className="font-serif-royal font-bold text-[#641C24] text-sm">Guest Details (Optional)</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <input
                    type="text"
                    placeholder="Your Name"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#641C24]"
                  />
                  <input
                    type="tel"
                    placeholder="Mobile Number"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    className="border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#641C24]"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Kitchen Instructions (e.g. less spicy)"
                  value={specialInstructions}
                  onChange={e => setSpecialInstructions(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#641C24]"
                />
                <p className="text-[10px] text-gray-500 leading-tight">
                  <ShieldCheck className="w-3 h-3 inline text-emerald-600 mr-1" />
                  {t.privacy_consent}
                </p>
              </div>

              {/* GST Calculation Preview */}
              <div className="bg-[#FFF9F0] p-4 rounded-xl border border-[#C49A52]/40 space-y-1 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-gray-800">{formatINR(gst.subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>CGST ({cgstRate}%):</span>
                  <span>{formatINR(gst.cgst)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>SGST ({sgstRate}%):</span>
                  <span>{formatINR(gst.sgst)}</span>
                </div>
                <div className="border-t border-[#C49A52]/40 pt-2 flex justify-between items-baseline font-bold text-sm text-[#641C24]">
                  <span>{t.total}:</span>
                  <span className="text-lg">{formatINR(gst.finalPayable)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {cart.length > 0 && (
          <div className="bg-white p-4 border-t border-gray-200 shrink-0">
            <button
              onClick={handlePlaceOrder}
              disabled={isSubmitting}
              className="w-full bg-[#641C24] hover:bg-[#852D34] disabled:opacity-50 text-[#FFF9F0] py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-[#C49A52]" />
                  <span>{t.place_order} ({formatINR(gst.finalPayable)})</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
