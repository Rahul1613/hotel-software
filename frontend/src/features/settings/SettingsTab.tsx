import React, { useState } from 'react';
import type { RestaurantInfo } from '../../types';
import { apiRequest } from '../../api';

interface SettingsTabProps {
  restaurant: RestaurantInfo | null;
  onRefresh: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ restaurant, onRefresh }) => {
  const [formData, setFormData] = useState<RestaurantInfo | null>(restaurant);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  if (!formData) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMsg('');
    try {
      await apiRequest('/api/restaurant', {
        method: 'PUT',
        body: JSON.stringify(formData),
      });
      setStatusMsg('Settings saved successfully!');
      onRefresh();
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900 leading-relaxed">
        <strong>⚠️ Tax & Legal Compliance:</strong> Confirm invoice numbering sequence, HSN/SAC codes, and GST rates with your Chartered Accountant (CA) before altering.
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 border border-gray-200 shadow-2xs space-y-4 text-xs">
        <h2 className="font-serif-royal font-bold text-lg text-[#641C24]">Restaurant Profile & GST Configuration</h2>

        {statusMsg && (
          <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl font-bold border border-emerald-200">
            {statusMsg}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-gray-700 mb-1">Restaurant Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-xl p-2"
            />
          </div>
          <div>
            <label className="block font-bold text-gray-700 mb-1">GSTIN Number</label>
            <input
              type="text"
              value={formData.gstin}
              onChange={e => setFormData({ ...formData, gstin: e.target.value })}
              className="w-full border border-gray-300 rounded-xl p-2 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-gray-700 mb-1">CGST Rate (%)</label>
            <input
              type="number"
              step="0.1"
              value={formData.cgst_rate}
              onChange={e => setFormData({ ...formData, cgst_rate: Number(e.target.value) })}
              className="w-full border border-gray-300 rounded-xl p-2"
            />
          </div>
          <div>
            <label className="block font-bold text-gray-700 mb-1">SGST Rate (%)</label>
            <input
              type="number"
              step="0.1"
              value={formData.sgst_rate}
              onChange={e => setFormData({ ...formData, sgst_rate: Number(e.target.value) })}
              className="w-full border border-gray-300 rounded-xl p-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-gray-700 mb-1">Invoice Prefix</label>
            <input
              type="text"
              value={formData.invoice_prefix}
              onChange={e => setFormData({ ...formData, invoice_prefix: e.target.value })}
              className="w-full border border-gray-300 rounded-xl p-2 font-mono uppercase"
            />
          </div>
          <div>
            <label className="block font-bold text-gray-700 mb-1">Cashier Max Discount (₹)</label>
            <input
              type="number"
              value={formData.discount_limit_cashier / 100}
              onChange={e => setFormData({ ...formData, discount_limit_cashier: Number(e.target.value) * 100 })}
              className="w-full border border-gray-300 rounded-xl p-2"
            />
          </div>
        </div>

        <div>
          <label className="block font-bold text-gray-700 mb-1">UPI ID for Bill QR Code</label>
          <input
            type="text"
            placeholder="e.g. restaurant@icici"
            value={formData.upi_id || ''}
            onChange={e => setFormData({ ...formData, upi_id: e.target.value })}
            className="w-full border border-gray-300 rounded-xl p-2 font-mono"
          />
        </div>

        <div>
          <label className="block font-bold text-gray-700 mb-1">Registered Address</label>
          <textarea
            rows={2}
            value={formData.address}
            onChange={e => setFormData({ ...formData, address: e.target.value })}
            className="w-full border border-gray-300 rounded-xl p-2"
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="sc_toggle"
            checked={formData.service_charge_enabled}
            onChange={e => setFormData({ ...formData, service_charge_enabled: e.target.checked })}
          />
          <label htmlFor="sc_toggle" className="font-bold text-gray-700 cursor-pointer">
            Enable Service Charge line on bill
          </label>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-[#641C24] hover:bg-[#852D34] text-white font-bold py-2.5 px-6 rounded-xl cursor-pointer"
        >
          Save Configuration
        </button>
      </form>
    </div>
  );
};
