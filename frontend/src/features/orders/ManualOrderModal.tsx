import React, { useState } from 'react';
import type { MenuItem } from '../../types';
import { formatINR } from '../../utils/money';
import { apiRequest } from '../../api';
import { Modal } from '../../components/common/Modal';
import { Plus, Minus, Send } from 'lucide-react';

interface ManualOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  menuItems: MenuItem[];
}

export const ManualOrderModal: React.FC<ManualOrderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  menuItems,
}) => {
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY'>('DINE_IN');
  const [tableNumber, setTableNumber] = useState<string>('01');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [instructions, setInstructions] = useState<string>('');
  const [cart, setCart] = useState<{ [itemId: number]: number }>({});
  const [search, setSearch] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const filteredItems = menuItems.filter(it =>
    it.is_available && (it.name.toLowerCase().includes(search.toLowerCase()) || (it.marathi_name && it.marathi_name.includes(search)))
  );

  const handleUpdateQty = (itemId: number, delta: number) => {
    setCart(prev => {
      const current = prev[itemId] || 0;
      const next = current + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: next };
    });
  };

  const selectedItemsList = Object.entries(cart).map(([idStr, qty]) => {
    const item = menuItems.find(m => m.id === Number(idStr))!;
    return { item, quantity: qty };
  }).filter(entry => entry.item);

  const subtotal = selectedItemsList.reduce((sum, entry) => sum + entry.item.price * entry.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItemsList.length === 0) {
      setErrorMsg('Please select at least one dish');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await apiRequest('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          order_type: orderType,
          table_number: orderType === 'DINE_IN' ? tableNumber : undefined,
          customer_name: customerName || 'Walk-in Guest',
          customer_phone: customerPhone,
          special_instructions: instructions,
          items: selectedItemsList.map(entry => ({
            item_id: entry.item.id,
            quantity: entry.quantity,
          })),
        }),
      });
      setCart({});
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to place order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manual Order Entry (Takeaway / Phone-less Guest)" maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="block font-bold text-gray-700 mb-1">Order Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOrderType('DINE_IN')}
                className={`flex-1 py-1.5 rounded-lg font-bold border ${orderType === 'DINE_IN' ? 'bg-[#641C24] text-white' : 'bg-gray-100'}`}
              >
                Dine-In
              </button>
              <button
                type="button"
                onClick={() => setOrderType('TAKEAWAY')}
                className={`flex-1 py-1.5 rounded-lg font-bold border ${orderType === 'TAKEAWAY' ? 'bg-[#641C24] text-white' : 'bg-gray-100'}`}
              >
                Takeaway (Parcel)
              </button>
            </div>
          </div>

          {orderType === 'DINE_IN' && (
            <div>
              <label className="block font-bold text-gray-700 mb-1">Table Number</label>
              <select
                value={tableNumber}
                onChange={e => setTableNumber(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-1.5 text-xs font-bold"
              >
                {Array.from({ length: 11 }, (_, i) => String(i + 1).padStart(2, '0')).map(t => (
                  <option key={t} value={t}>Table {t} {Number(t) <= 5 ? '(AC)' : '(Non-AC)'}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <input
            type="text"
            placeholder="Guest Name (Optional)"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs"
          />
          <input
            type="tel"
            placeholder="Mobile (for Bill)"
            value={customerPhone}
            onChange={e => setCustomerPhone(e.target.value)}
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs"
          />
        </div>

        {/* Menu item picker */}
        <div className="border border-gray-200 rounded-2xl p-3 bg-gray-50/50 space-y-2">
          <input
            type="text"
            placeholder="Search dish name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1 text-xs"
          />
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
            {filteredItems.map(it => {
              const qty = cart[it.id] || 0;
              return (
                <div key={it.id} className="flex items-center justify-between p-1.5 bg-white rounded-lg border border-gray-100 text-xs">
                  <div>
                    <span className="font-bold text-gray-800">{it.name}</span>
                    <span className="text-gray-500 ml-2 font-medium">{formatINR(it.price)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {qty > 0 && (
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(it.id, -1)}
                        className="p-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                    )}
                    {qty > 0 && <span className="font-bold text-xs px-1">{qty}</span>}
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(it.id, 1)}
                      className="p-1 bg-[#641C24] text-white rounded hover:bg-[#852D34]"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-between items-center text-sm font-bold pt-2 border-t">
          <span>Subtotal: {formatINR(subtotal)}</span>
          <button
            type="submit"
            disabled={isSubmitting || selectedItemsList.length === 0}
            className="bg-[#258451] hover:bg-emerald-800 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Place Order</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
