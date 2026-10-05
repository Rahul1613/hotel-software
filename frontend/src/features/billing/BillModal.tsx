import React, { useState, useEffect } from 'react';
import type { Order } from '../../types';
import { calculateCartGst, formatINR } from '../../utils/money';
import { apiRequest } from '../../api';
import { printViaHiddenIframe } from '../../utils/printer';
import { Modal } from '../../components/common/Modal';
import {
  Printer,
  ShieldAlert,
  Layers,
  FileText,
  Download,
  CheckCircle2,
  Edit3,
  Receipt,
  TrendingUp,
  Save,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface BillModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BillModal: React.FC<BillModalProps> = ({ order, isOpen, onClose, onSuccess }) => {
  const { currentUser } = useAuth();
  const [activeView, setActiveView] = useState<'EXTERNAL' | 'INTERNAL' | 'CHANGE'>('EXTERNAL');
  const [discountRupees, setDiscountRupees] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Internal adjustment state
  const [adjType, setAdjType] = useState<string>('REMARK');
  const [adjAmount, setAdjAmount] = useState<number>(0);
  const [adjReason, setAdjReason] = useState<string>('');

  useEffect(() => {
    if (order) {
      setDiscountRupees(0);
      setPaymentMethod('CASH');
      setErrorMsg('');
      setSuccessMsg('');
      setAdjReason('');
      setAdjAmount(0);
      setActiveView('EXTERNAL');
    }
  }, [order?.id, isOpen]);

  if (!order) return null;

  const isCompleted = order.status === 'COMPLETED';

  // Subtotal calculation with multiple fallbacks so it's NEVER 0 when items exist
  const rawSubtotal =
    order.subtotal && order.subtotal > 0
      ? order.subtotal
      : order.subtotal_paise && order.subtotal_paise > 0
      ? order.subtotal_paise / 100
      : order.items && order.items.length > 0
      ? order.items.reduce((acc, it) => acc + (it.total_price || it.price * it.quantity || 0), 0)
      : order.final_amount && order.final_amount > 0
      ? order.final_amount / 1.05
      : 0;

  const gst = calculateCartGst(rawSubtotal, discountRupees, 2.5, 2.5, 0);
  const displayFinalPayable = isCompleted && order.final_amount > 0 && discountRupees === 0
    ? order.final_amount
    : gst.finalPayable;

  // Estimated COGS / Food cost (approx 35% default if unit cost not set)
  const estimatedFoodCost = rawSubtotal * 0.35;
  const estimatedGrossProfit = rawSubtotal - estimatedFoodCost - discountRupees;
  const estimatedMarginPct = rawSubtotal > 0 ? Math.round((estimatedGrossProfit / rawSubtotal) * 100) : 0;

  const handlePrintOrDownload = async (
    target: 'CUSTOMER_THERMAL' | 'CUSTOMER_A4' | 'CUSTOMER_A4_DOWNLOAD' | 'INTERNAL_THERMAL' | 'BOTH'
  ) => {
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      let invoiceId: number | null = order.invoice_id || null;

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
        invoiceId = data.invoice_id;
      } catch (err: any) {
        console.warn('Invoice generation notice:', err);
      }

      const receiptUrl = invoiceId
        ? `/api/invoices/${invoiceId}/receipt/html`
        : `/api/orders/${order.id}/receipt/html`;

      const pdfUrl = invoiceId
        ? `/api/invoices/${invoiceId}/pdf?format=A4`
        : `/api/orders/${order.id}/pdf?format=A4`;

      const pdfDownloadUrl = invoiceId
        ? `/api/invoices/${invoiceId}/pdf?format=A4&download=1`
        : `/api/orders/${order.id}/pdf?format=A4&download=1`;

      if (target === 'CUSTOMER_A4') {
        window.open(pdfUrl, '_blank');
      } else if (target === 'CUSTOMER_A4_DOWNLOAD') {
        const a = document.createElement('a');
        a.href = pdfDownloadUrl;
        a.download = `Bill_${order.order_number}_A4.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else if (target === 'CUSTOMER_THERMAL') {
        printViaHiddenIframe(receiptUrl);
      } else if (target === 'INTERNAL_THERMAL') {
        if (invoiceId) {
          printViaHiddenIframe(`/api/invoices/${invoiceId}/internal-receipt/html`);
        } else {
          printViaHiddenIframe(receiptUrl);
        }
      } else if (target === 'BOTH') {
        if (invoiceId) {
          printViaHiddenIframe(`/api/invoices/${invoiceId}/both-receipts/html`);
        } else {
          printViaHiddenIframe(receiptUrl);
        }
      }

      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process billing / print.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveChangesAndBill = async () => {
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (order.invoice_id) {
        await apiRequest(`/api/invoices/${order.invoice_id}`, {
          method: 'PUT',
          body: JSON.stringify({
            discount_amount: discountRupees,
            payment_method: paymentMethod,
          }),
        });
      } else {
        await apiRequest('/api/invoices', {
          method: 'POST',
          body: JSON.stringify({
            session_id: order.session_id,
            order_id: order.id,
            discount_amount: discountRupees,
            payment_method: paymentMethod,
            payment_status: 'PAID',
          }),
        });
      }

      // If adjustment reason was typed, record adjustment note
      if (adjReason.trim() && order.invoice_id) {
        await apiRequest(`/api/invoices/${order.invoice_id}/adjustment`, {
          method: 'POST',
          body: JSON.stringify({
            note_type: adjType,
            amount: adjAmount,
            reason: adjReason.trim(),
          }),
        });
      }

      setSuccessMsg('Bill changes saved successfully!');
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update bill changes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Bill Management: Table ${order.table_number || 'Takeaway'} (${order.order_number})`}
    >
      <div className="space-y-4">
        {/* Navigation Tabs for External, Internal, and Bill Change */}
        <div className="flex bg-gray-100 p-1 rounded-xl gap-1 text-xs font-bold">
          <button
            onClick={() => setActiveView('EXTERNAL')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeView === 'EXTERNAL'
                ? 'bg-white text-[#641C24] shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5 text-[#641C24]" />
            <span>External (Customer Bill)</span>
          </button>

          <button
            onClick={() => setActiveView('INTERNAL')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeView === 'INTERNAL'
                ? 'bg-[#641C24] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-[#C49A52]" />
            <span>Internal (Management Bill)</span>
          </button>

          <button
            onClick={() => setActiveView('CHANGE')}
            className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeView === 'CHANGE'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Bill Change & Edit</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 font-medium">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {isCompleted && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Status: <strong>Paid & Settled</strong></span>
            </div>
            <span className="text-[11px] font-mono font-bold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
              {order.order_number}
            </span>
          </div>
        )}

        {/* ================= VIEW 1: EXTERNAL CUSTOMER BILL ================= */}
        {activeView === 'EXTERNAL' && (
          <div className="space-y-3">
            {/* Ordered Items List */}
            {order.items && order.items.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-3 max-h-36 overflow-y-auto space-y-1 text-xs">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Ordered Dishes ({order.items.length})
                </div>
                {order.items.map(it => (
                  <div key={it.id} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-800">{it.item_name}</span>
                      <span className="text-gray-500 font-bold">× {it.quantity}</span>
                      {it.customization && (
                        <span className="text-[10px] text-amber-800 italic">({it.customization})</span>
                      )}
                    </div>
                    <span className="font-bold text-gray-700">
                      {formatINR(it.total_price || it.price * it.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* External GST Calculation Breakdown */}
            <div className="bg-[#FFF9F0] p-3.5 rounded-xl border border-[#C49A52]/30 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Order Subtotal:</span>
                <span className="font-semibold">{formatINR(rawSubtotal)}</span>
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
                <span>{formatINR(displayFinalPayable)}</span>
              </div>
            </div>

            {/* External Printing Actions */}
            <div className="pt-2 space-y-2">
              <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                External Customer Print Options
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => handlePrintOrDownload('CUSTOMER_THERMAL')}
                  disabled={isSubmitting}
                  className="bg-[#258451] hover:bg-emerald-800 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  title="Prints standard customer tax invoice receipt (80mm thermal)"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Customer Thermal</span>
                </button>

                <button
                  onClick={() => handlePrintOrDownload('CUSTOMER_A4')}
                  disabled={isSubmitting}
                  className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  title="Open or print A4 Tax Invoice PDF in new tab"
                >
                  <FileText className="w-3.5 h-3.5 text-gray-300" />
                  <span>View A4 PDF</span>
                </button>

                <button
                  onClick={() => handlePrintOrDownload('CUSTOMER_A4_DOWNLOAD')}
                  disabled={isSubmitting}
                  className="bg-[#641C24] hover:bg-[#852D34] text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  title="Download A4 Tax Invoice PDF file to your device"
                >
                  <Download className="w-3.5 h-3.5 text-[#C49A52]" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= VIEW 2: INTERNAL MANAGEMENT BILL ================= */}
        {activeView === 'INTERNAL' && (
          <div className="space-y-3">
            {/* Internal Food Cost & Margin Summary */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-xl">
                <span className="text-[10px] text-gray-500 font-bold block">Selling Total</span>
                <span className="font-bold text-gray-900 text-sm">{formatINR(rawSubtotal)}</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                <span className="text-[10px] text-amber-800 font-bold block">Food Cost (COGS)</span>
                <span className="font-bold text-amber-900 text-sm">{formatINR(estimatedFoodCost)}</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                <span className="text-[10px] text-emerald-800 font-bold block">Gross Profit</span>
                <span className="font-bold text-emerald-700 text-sm">
                  {formatINR(estimatedGrossProfit)} ({estimatedMarginPct}%)
                </span>
              </div>
            </div>

            {/* Internal Food Cost Items Breakdown */}
            {order.items && order.items.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-3 max-h-36 overflow-y-auto space-y-1 text-xs">
                <div className="text-[10px] font-bold text-[#641C24] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>Internal Margin Per Dish</span>
                </div>
                {order.items.map(it => {
                  const selling = it.total_price || it.price * it.quantity;
                  const unitCost = (it.price || 0) * 0.35;
                  const costTotal = unitCost * (it.quantity || 1);
                  const profit = selling - costTotal;
                  return (
                    <div key={it.id} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0 text-[11px]">
                      <div>
                        <span className="font-semibold text-gray-800">{it.item_name} × {it.quantity}</span>
                        <span className="text-[10px] text-gray-400 block">Est. Cost: {formatINR(costTotal)}</span>
                      </div>
                      <div className="text-right font-bold text-emerald-700">
                        <span>{formatINR(profit)}</span>
                        <span className="text-[10px] text-gray-500 block">65% margin</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Internal Printing Buttons */}
            <div className="pt-2 space-y-2">
              <div className="text-[11px] font-bold text-[#641C24] uppercase tracking-wider flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-[#C49A52]" />
                <span>Internal & Dual Print Options</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handlePrintOrDownload('INTERNAL_THERMAL')}
                  disabled={isSubmitting}
                  className="bg-[#641C24] hover:bg-[#852D34] text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  title="Print Internal Copy with food cost & profit margin breakdown"
                >
                  <Printer className="w-3.5 h-3.5 text-[#C49A52]" />
                  <span>Internal Management Bill</span>
                </button>
                <button
                  onClick={() => handlePrintOrDownload('BOTH')}
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-[#258451] to-[#641C24] hover:opacity-95 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                  title="Sequences both Customer Bill and Internal Management Bill in one print job"
                >
                  <Layers className="w-3.5 h-3.5 text-yellow-300" />
                  <span>Print Both Bills</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= VIEW 3: BILL CHANGE & EDIT ================= */}
        {activeView === 'CHANGE' && (
          <div className="space-y-3 bg-amber-50/40 p-3.5 rounded-xl border border-amber-200/60">
            <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5 mb-1">
              <Edit3 className="w-4 h-4 text-amber-700" />
              <span>Modify Bill Details & Adjustments</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Update Discount (₹)</label>
              <input
                type="number"
                min="0"
                value={discountRupees}
                onChange={e => setDiscountRupees(Number(e.target.value))}
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#641C24]"
                placeholder="0"
              />
              <span className="text-[10px] text-gray-500">Recalculates taxable amount & taxes automatically.</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#641C24] font-medium"
              >
                <option value="CASH">Counter Cash</option>
                <option value="UPI">Counter GPay / UPI</option>
                <option value="CARD">Card POS Machine</option>
              </select>
            </div>

            <div className="pt-2 border-t border-amber-200">
              <label className="block text-xs font-bold text-gray-700 mb-1">Internal Note / Remark / Adjustment</label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <select
                  value={adjType}
                  onChange={e => setAdjType(e.target.value)}
                  className="bg-white border border-gray-300 rounded-xl px-2 py-1.5 text-xs font-medium"
                >
                  <option value="REMARK">Internal Remark</option>
                  <option value="ADJUSTMENT">Price Adjustment</option>
                  <option value="REFUND">Refund / Waiver</option>
                  <option value="CORRECTION">Bill Correction</option>
                </select>
                <input
                  type="number"
                  placeholder="Adj Amount (₹)"
                  value={adjAmount || ''}
                  onChange={e => setAdjAmount(Number(e.target.value))}
                  className="bg-white border border-gray-300 rounded-xl px-2 py-1.5 text-xs"
                />
              </div>
              <input
                type="text"
                placeholder="Reason (e.g. VIP guest discount, item removed, cash rounded)"
                value={adjReason}
                onChange={e => setAdjReason(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#641C24]"
              />
            </div>

            <button
              onClick={handleSaveChangesAndBill}
              disabled={isSubmitting}
              className="w-full bg-[#641C24] hover:bg-[#852D34] text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50 mt-2"
            >
              <Save className="w-3.5 h-3.5 text-[#C49A52]" />
              <span>Save Changes & Recalculate Bill</span>
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};


