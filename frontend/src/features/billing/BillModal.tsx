import React, { useState } from 'react';
import type { Order } from '../../types';
import { calculateCartGst, formatINR } from '../../utils/money';
import { apiRequest } from '../../api';
import { printViaHiddenIframe } from '../../utils/printer';
import { Modal } from '../../components/common/Modal';
import { Printer, ShieldAlert, Layers, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface BillModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BillModal: React.FC<BillModalProps> = ({ order, isOpen, onClose, onSuccess }) => {
  const { currentUser } = useAuth();
  const [discountRupees, setDiscountRupees] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!order) return null;

  const isManagement = currentUser?.role === 'owner' || currentUser?.role === 'manager';
  const gst = calculateCartGst(order.subtotal, discountRupees, 2.5, 2.5, 0);

  const handleGenerateAndPrint = async (
    target: 'CUSTOMER_THERMAL' | 'CUSTOMER_A4' | 'INTERNAL_THERMAL' | 'BOTH'
  ) => {
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const data = await apiRequest<{ invoice_id: number; invoice_number: string; final_payable: number }>(
        '/api/invoices',
        {
          method: 'POST',
          body: JSON.stringify({
            session_id: order.session_id,
            order_id: order.id,
            discount_amount: discountRupees,
            payment_method: paymentMethod,
            payment_status: 'PAID',
          }),
        }
      );

      const invoiceId = data.invoice_id;

      if (target === 'CUSTOMER_A4') {
        window.open(`/api/invoices/${invoiceId}/pdf?format=A4`, '_blank');
      } else if (target === 'CUSTOMER_THERMAL') {
        printViaHiddenIframe(`/api/invoices/${invoiceId}/receipt/html`);
      } else if (target === 'INTERNAL_THERMAL') {
        printViaHiddenIframe(`/api/invoices/${invoiceId}/internal-receipt/html`);
      } else if (target === 'BOTH') {
        printViaHiddenIframe(`/api/invoices/${invoiceId}/both-receipts/html`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process billing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Billing & Invoicing: Table ${order.table_number || 'Takeaway'}`}>
      <div className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
            {errorMsg}
          </div>
        )}

        <div className="bg-[#FFF9F0] p-3.5 rounded-xl border border-[#C49A52]/30 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-600">Order Subtotal:</span>
            <span className="font-semibold">{formatINR(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">CGST (2.5%):</span>
            <span>{formatINR(gst.cgst)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">SGST (2.5%):</span>
            <span>{formatINR(gst.sgst)}</span>
          </div>
          {gst.discount > 0 && (
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>Discount Applied:</span>
              <span>- {formatINR(gst.discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm pt-2 border-t border-[#C49A52]/30 text-[#641C24]">
            <span>Final Customer Payable:</span>
            <span>{formatINR(gst.finalPayable)}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Authorized Discount (₹)</label>
          <input
            type="number"
            min="0"
            value={discountRupees}
            onChange={e => setDiscountRupees(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#641C24]"
            placeholder="0"
          />
          <span className="text-[10px] text-gray-400">Cashier limit: up to ₹100. Higher requires Manager.</span>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Payment Method</label>
          <select
            value={paymentMethod}
            onChange={e => setPaymentMethod(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#641C24] font-medium"
          >
            <option value="CASH">Counter Cash</option>
            <option value="UPI">Counter GPay / UPI</option>
            <option value="CARD">Card POS Machine</option>
          </select>
        </div>

        {/* Dual Printing Options */}
        <div className="pt-2 space-y-2">
          <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Printing Options</div>

          {/* Standard Customer Bill Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleGenerateAndPrint('CUSTOMER_THERMAL')}
              disabled={isSubmitting}
              className="bg-[#258451] hover:bg-emerald-800 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              title="Prints standard customer tax invoice receipt"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-200" />
              <span>Customer Receipt</span>
            </button>
            <button
              onClick={() => handleGenerateAndPrint('CUSTOMER_A4')}
              disabled={isSubmitting}
              className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              title="Download or print A4 Tax Invoice PDF"
            >
              <FileText className="w-3.5 h-3.5 text-gray-300" />
              <span>Customer A4 PDF</span>
            </button>
          </div>

          {/* Management / Dual Billing Buttons (Only for Owner & Manager) */}
          {isManagement && (
            <div className="pt-2 border-t border-gray-200">
              <div className="flex items-center gap-1 text-[10px] font-bold text-[#641C24] mb-1.5">
                <ShieldAlert className="w-3 h-3 text-[#C49A52]" />
                <span>Dual Billing & Internal Copy (Management Only)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleGenerateAndPrint('INTERNAL_THERMAL')}
                  disabled={isSubmitting}
                  className="bg-[#641C24] hover:bg-[#852D34] text-white font-bold py-2.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  title="Print Internal Copy with food cost & profit margin breakdown"
                >
                  <Printer className="w-3.5 h-3.5 text-[#C49A52]" />
                  <span>Internal Bill</span>
                </button>
                <button
                  onClick={() => handleGenerateAndPrint('BOTH')}
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-[#258451] to-[#641C24] hover:opacity-95 text-white font-bold py-2.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                  title="Sequences both Customer Bill and Internal Management Bill in one print job"
                >
                  <Layers className="w-3.5 h-3.5 text-yellow-300" />
                  <span>Print Both Bills</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
