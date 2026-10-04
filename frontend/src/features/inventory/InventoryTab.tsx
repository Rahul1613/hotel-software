import React, { useState } from 'react';
import type { InventoryItem } from '../../types';
import { apiRequest } from '../../api';
import { Modal } from '../../components/common/Modal';
import { AlertTriangle, Plus, ClipboardCheck, History } from 'lucide-react';

interface InventoryTabProps {
  inventory: InventoryItem[];
  onRefresh: () => void;
}

export const InventoryTab: React.FC<InventoryTabProps> = ({ inventory, onRefresh }) => {
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [actionType, setActionType] = useState<'PURCHASE' | 'AUDIT' | 'WASTAGE'>('PURCHASE');
  const [quantity, setQuantity] = useState<number>(10);
  const [note, setNote] = useState<string>('');
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRecordMovement = async () => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      await apiRequest(`/api/inventory/${selectedItem.id}/movement`, {
        method: 'POST',
        body: JSON.stringify({
          movement_type: actionType,
          quantity_change: actionType === 'WASTAGE' ? -Math.abs(quantity) : Math.abs(quantity),
          new_stock: quantity, // Used if actionType is AUDIT
          note,
        }),
      });
      setSelectedItem(null);
      setNote('');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewHistory = async (item: InventoryItem) => {
    try {
      const data = await apiRequest(`/api/inventory/${item.id}/movements`);
      setHistoryItems(data);
      setSelectedItem(item);
      setIsHistoryOpen(true);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-serif-royal text-[#641C24]">Raw Ingredient Stock & Audits</h2>
          <p className="text-xs text-gray-500">Track chicken, mutton, paneer, and spices. Recipe-based usage auto-deducts when orders cook.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {inventory.map(item => (
          <div
            key={item.id}
            className={`bg-white rounded-2xl p-4 border transition-all flex flex-col justify-between ${
              item.is_low_stock ? 'border-red-400 bg-red-50/40 ring-1 ring-red-300' : 'border-gray-200'
            }`}
          >
            <div>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h3 className="font-bold text-sm text-gray-900">{item.name}</h3>
                  {item.marathi_name && <span className="font-marathi text-xs text-gray-500">{item.marathi_name}</span>}
                </div>
                <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded font-bold uppercase">{item.category}</span>
              </div>

              <div className="my-3">
                <span className="text-2xl font-black text-[#641C24]">
                  {item.current_stock.toFixed(1)} <span className="text-xs font-semibold text-gray-600">{item.unit}</span>
                </span>
                {item.is_low_stock && (
                  <p className="text-[11px] text-red-700 font-bold flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Below Alert ({item.min_alert_threshold} {item.unit})
                  </p>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center gap-1.5 text-xs">
              <button
                onClick={() => {
                  setSelectedItem(item);
                  setActionType('PURCHASE');
                  setQuantity(10);
                }}
                className="flex-1 bg-[#641C24] hover:bg-[#852D34] text-white py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Restock</span>
              </button>
              <button
                onClick={() => {
                  setSelectedItem(item);
                  setActionType('AUDIT');
                  setQuantity(item.current_stock);
                }}
                className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold cursor-pointer"
                title="Physical Audit"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleViewHistory(item)}
                className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold cursor-pointer"
                title="Stock Movement Audit Trail"
              >
                <History className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Movement Modal */}
      <Modal isOpen={!!selectedItem && !isHistoryOpen} onClose={() => setSelectedItem(null)} title={`Record Stock: ${selectedItem?.name}`}>
        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-gray-700 mb-1">Action Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['PURCHASE', 'AUDIT', 'WASTAGE'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActionType(t)}
                  className={`py-1.5 rounded-lg font-bold border ${actionType === t ? 'bg-[#641C24] text-white' : 'bg-gray-50'}`}
                >
                  {t === 'PURCHASE' ? '+ Purchase' : t === 'AUDIT' ? 'Audit Count' : 'Wastage'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">
              {actionType === 'AUDIT' ? `Actual Count in ${selectedItem?.unit}` : `Quantity in ${selectedItem?.unit}`}
            </label>
            <input
              type="number"
              step="0.1"
              value={quantity}
              onChange={e => setQuantity(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-xl p-2 text-xs"
            />
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Reason / Supplier Note</label>
            <input
              type="text"
              placeholder="e.g. Regular weekly supply from Gokul Dairy"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-2 text-xs"
            />
          </div>

          <button
            onClick={handleRecordMovement}
            disabled={isSubmitting}
            className="w-full bg-[#641C24] hover:bg-[#852D34] text-white font-bold py-2.5 rounded-xl cursor-pointer"
          >
            Save Stock Record
          </button>
        </div>
      </Modal>

      {/* History Modal */}
      <Modal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} title={`Stock History: ${selectedItem?.name}`} maxWidth="max-w-lg">
        <div className="max-h-80 overflow-y-auto space-y-2 text-xs">
          {historyItems.length === 0 ? (
            <p className="text-gray-500 py-4 text-center">No previous stock movements recorded.</p>
          ) : (
            historyItems.map((h: any) => (
              <div key={h.id} className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 flex justify-between items-center">
                <div>
                  <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${h.movement_type === 'PURCHASE' ? 'bg-emerald-100 text-emerald-800' : h.movement_type === 'WASTAGE' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                    {h.movement_type}
                  </span>
                  <p className="text-[11px] text-gray-600 mt-1">{h.note || 'No note'}</p>
                  <span className="text-[10px] text-gray-400">{h.created_at}</span>
                </div>
                <div className="text-right">
                  <span className={`font-black text-sm ${h.quantity_change > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {h.quantity_change > 0 ? `+${h.quantity_change}` : h.quantity_change}
                  </span>
                  <p className="text-[10px] text-gray-500">Bal: {h.resulting_stock}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
};
