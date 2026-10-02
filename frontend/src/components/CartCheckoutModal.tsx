import React, { useState } from 'react';
import type { CartItem, RestaurantInfo } from '../types';
import { FoodBadge } from './FoodBadge';
import { 
  X, Trash2, Plus, Minus, ArrowLeft, 
  CreditCard, IndianRupee, QrCode, ShieldCheck, CheckCircle2 
} from 'lucide-react';

interface CartProps {
  restaurant: RestaurantInfo | null;
  tableNumber: string | null;
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
  cart,
  onUpdateCartQty,
  onRemoveItem,
  onCloseCart,
  onOrderSuccess,
  onSelectTable
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'PAY_AT_COUNTER' | 'CASH' | 'UPI' | 'ONLINE'>('PAY_AT_COUNTER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Tax rates
  const cgstRate = restaurant?.cgst_rate || 2.5;
  const sgstRate = restaurant?.sgst_rate || 2.5;

  // Totals
  const subtotal = cart.reduce((sum, ci) => {
    const addonsTotal = ci.selected_addons.reduce((aSum, a) => aSum + a.price, 0);
    return sum + (ci.item.price + addonsTotal) * ci.quantity;
  }, 0);

  const cgstAmount = Number((subtotal * (cgstRate / 100.0)).toFixed(2));
  const sgstAmount = Number((subtotal * (sgstRate / 100.0)).toFixed(2));
  const finalTotal = Number((subtotal + cgstAmount + sgstAmount).toFixed(2));

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNumber) {
      setErrorMsg('Table number is required to place order. Please scan a table QR code.');
      return;
    }
    if (cart.length === 0) {
      setErrorMsg('Your cart is empty. Please add items.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        table_number: tableNumber,
        customer_name: customerName || 'Guest',
        customer_phone: customerPhone,
        special_instructions: specialInstructions,
        payment_method: paymentMethod,
        items: cart.map(ci => ({
          item_id: ci.item.id,
          quantity: ci.quantity,
          customization: ci.customization,
          selected_addons: ci.selected_addons
        }))
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to place order');
      }

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
        {/* Header */}
        <div className="bg-[#641C24] text-[#FFF9F0] px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={onCloseCart}
              className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-serif-royal font-bold text-lg">Your Table Order</h2>
              <span className="text-xs text-[#C49A52]">
                {tableNumber ? `Assigned: Table ${tableNumber}` : 'No Table Selected'}
              </span>
            </div>
          </div>
          <button 
            onClick={onCloseCart}
            className="p-1 rounded-lg hover:bg-white/10 text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-[#C83E3E] text-xs p-3 rounded-xl">
              {errorMsg}
            </div>
          )}

          {cart.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">Your order list is currently empty.</p>
              <button 
                onClick={onCloseCart}
                className="mt-3 text-[#641C24] text-xs font-bold underline cursor-pointer"
              >
                Explore menu to add dishes
              </button>
            </div>
          ) : (
            <>
              {/* Items List */}
              <div className="space-y-3">
                <h3 className="font-serif-royal font-bold text-[#641C24] text-sm">Selected Dishes</h3>
                {cart.map((ci, index) => {
                  const itemAddonsPrice = ci.selected_addons.reduce((sum, a) => sum + a.price, 0);
                  const itemTotal = (ci.item.price + itemAddonsPrice) * ci.quantity;

                  return (
                    <div 
                      key={`${ci.item.id}-${index}`}
                      className="bg-white p-3 rounded-xl border border-gray-200 flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <FoodBadge isVeg={ci.item.is_veg} foodType={ci.item.food_type} size="sm" />
                          <h4 className="font-semibold text-xs text-[#282321] truncate">{ci.item.name}</h4>
                        </div>
                        {ci.selected_addons.length > 0 && (
                          <p className="text-[10px] text-gray-500 truncate">
                            Add-ons: {ci.selected_addons.map(a => a.name).join(', ')}
                          </p>
                        )}
                        {ci.customization && (
                          <p className="text-[10px] text-amber-700 italic truncate">
                            Note: {ci.customization}
                          </p>
                        )}
                        <span className="text-xs font-bold text-[#641C24] block mt-1">
                          ₹{itemTotal.toFixed(2)}
                        </span>
                      </div>

                      {/* Quantity Control */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
                          <button 
                            onClick={() => onUpdateCartQty(ci.item, -1)}
                            className="p-1 hover:bg-gray-200 rounded text-gray-700 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold px-2">{ci.quantity}</span>
                          <button 
                            onClick={() => onUpdateCartQty(ci.item, 1)}
                            className="p-1 hover:bg-gray-200 rounded text-gray-700 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <button 
                          onClick={() => onRemoveItem(index)}
                          className="text-gray-400 hover:text-red-600 p-1 cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Table Assignment Card */}
              <div className="bg-amber-50/90 p-4 rounded-xl border border-amber-300 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-serif-royal font-bold text-[#641C24] text-sm flex items-center gap-1.5">
                    {tableNumber ? (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                        <span>Dining at Table {tableNumber}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-amber-700">📍 Select Your Table Number:</span>
                      </>
                    )}
                  </span>
                  {tableNumber && onSelectTable && (
                    <button
                      type="button"
                      onClick={() => onSelectTable('')}
                      className="text-xs text-[#641C24] hover:text-[#852D34] underline font-bold cursor-pointer"
                    >
                      Change Table
                    </button>
                  )}
                </div>

                {!tableNumber && (
                  <div className="space-y-2 pt-1">
                    <div>
                      <span className="text-[10px] font-bold text-gray-600 uppercase">AC Dining Hall:</span>
                      <div className="grid grid-cols-5 gap-1.5 mt-1">
                        {['01', '02', '03', '04', '05'].map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              if (onSelectTable) onSelectTable(t);
                              setErrorMsg('');
                            }}
                            className="py-1.5 px-1 bg-white hover:bg-[#641C24] hover:text-white border border-[#C49A52]/50 rounded-lg text-xs font-bold text-[#641C24] transition-all cursor-pointer shadow-2xs text-center"
                          >
                            T-{t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-600 uppercase">Non-AC Family Hall:</span>
                      <div className="grid grid-cols-6 gap-1.5 mt-1">
                        {['06', '07', '08', '09', '10', '11'].map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => {
                              if (onSelectTable) onSelectTable(t);
                              setErrorMsg('');
                            }}
                            className="py-1.5 px-1 bg-white hover:bg-[#641C24] hover:text-white border border-[#C49A52]/50 rounded-lg text-xs font-bold text-[#641C24] transition-all cursor-pointer shadow-2xs text-center"
                          >
                            T-{t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Customer Details Form */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
                <h3 className="font-serif-royal font-bold text-[#641C24] text-sm">Dining Details (Optional)</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Your Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Rahul Patil"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-[#FFF9F0]/60 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#641C24]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Mobile (for GST Bill)</label>
                    <input 
                      type="tel" 
                      placeholder="98XXXXXXXX"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full bg-[#FFF9F0]/60 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#641C24]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">Overall Kitchen Instructions</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Serve starters first, spicy curry..."
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    className="w-full bg-[#FFF9F0]/60 border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#641C24]"
                  />
                </div>
              </div>

              {/* Payment Method - Purely at counter (Cash or GPay / UPI) */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif-royal font-bold text-[#641C24] text-sm">Payment at Billing Counter</h3>
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                    Pay After Meal
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 leading-snug">
                  Please pay at the cashier counter after your meal. Select your preferred mode for receipt printing:
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  {[
                    { id: 'COUNTER_CASH', label: 'Cash at Counter', sub: 'Pay physical cash to cashier', icon: IndianRupee },
                    { id: 'COUNTER_GPAY', label: 'GPay / UPI at Counter', sub: 'Scan cashier stand QR code', icon: QrCode },
                  ].map(pm => {
                    const Icon = pm.icon;
                    const isSelected = paymentMethod === pm.id || (pm.id === 'COUNTER_CASH' && paymentMethod === 'PAY_AT_COUNTER');
                    return (
                      <button
                        type="button"
                        key={pm.id}
                        onClick={() => setPaymentMethod(pm.id as any)}
                        className={`flex flex-col p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-[#641C24] bg-[#641C24]/5 font-bold text-[#641C24] ring-1 ring-[#641C24]' 
                            : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className="w-4 h-4 shrink-0 text-[#C49A52]" />
                          <span className="text-xs font-bold">{pm.label}</span>
                        </div>
                        <span className="text-[10px] text-gray-500 font-normal">{pm.sub}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bill Summary with GST breakdown */}
              <div className="bg-[#FFF9F0] p-4 rounded-xl border border-[#C49A52]/40 space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Item Subtotal:</span>
                  <span className="font-semibold text-gray-800">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>CGST ({cgstRate}%):</span>
                  <span>₹{cgstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>SGST ({sgstRate}%):</span>
                  <span>₹{sgstAmount.toFixed(2)}</span>
                </div>
                <div className="border-t border-[#C49A52]/40 pt-2 flex justify-between items-baseline font-bold text-sm text-[#641C24]">
                  <span>Total Payable:</span>
                  <span className="text-lg">₹{finalTotal.toFixed(2)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Place Order Button */}
        {cart.length > 0 && (
          <div className="bg-white p-4 border-t border-gray-200 shrink-0">
            <button
              onClick={handlePlaceOrder}
              disabled={isSubmitting || !tableNumber}
              className="w-full bg-[#641C24] hover:bg-[#852D34] disabled:opacity-50 text-[#FFF9F0] py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-[#C49A52]" />
                  <span>Confirm & Send Order (₹{finalTotal.toFixed(2)})</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-center text-gray-400 mt-2">
              Order routes immediately to kitchen display with table notification.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
