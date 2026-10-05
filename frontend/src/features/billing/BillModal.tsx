import React, { useState } from 'react';
import type { Order } from '../../types';
import { calculateCartGst, formatINR } from '../../utils/money';
import { apiRequest } from '../../api';
import { printViaHiddenIframe } from '../../utils/printer';
import { Modal } from '../../components/common/Modal';
import { Printer, ShieldAlert, Layers, FileText, Download, CheckCircle2 } from 'lucide-react';
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

  const isCompleted = order.status === 'COMPLETED';
  const isManagement = currentUser?.role === 'owner' || currentUser?.role === 'manager';
  const gst = calculateCartGst(order.subtotal, discountRupees, 2.5, 2.5, 0);

  const handlePrintOrDownload = async (
    target: 'CUSTOMER_THERMAL' | 'CUSTOMER_A4' | 'CUSTOMER_A4_DOWNLOAD' | 'INTERNAL_THERMAL' | 'BOTH'
  ) => {
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      // If active order, create/confirm invoice first
      let invoiceId: number | null = null;

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
        // If already invoiced or error, we can still print directly via order endpoints
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isCompleted
          ? `Bill & Print Options: Table ${order.table_number || 'Takeaway'} (${order.order_number})`
          : `Billing & Settle: Table ${order.table_number || 'Takeaway'} (${order.order_number})`
      }
    >
      <div className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
            {errorMsg}
          </div>
        )}

        {isCompleted && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl flex items-center gap-2 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>This order is <strong>Paid & Settled</strong>. You can reprint or download bills below anytime.</span>
          </div>
        )}

        {/* Bill Summary */}
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
            <span>Total Payable:</span>
            <span>{formatINR(isCompleted ? order.final_amount : gst.finalPayable)}</span>
          </div>
        </div>

        {/* Discount & Payment (Only if settling fresh) */}
        {!isCompleted && (
          <>
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
          </>
        )}

        {/* Dual Printing Options */}
        <div className="pt-2 space-y-2">
          <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
            {isCompleted ? 'Reprint & Download Options' : 'Settle & Print Options'}
          </div>

          {/* Standard Customer Bill Buttons */}
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

          {/* Management / Dual Billing Buttons (Only for Owner & Manager) */}
          {isManagement && (
            <div className="pt-2 border-t border-gray-200">
              <div className="flex items-center gap-1 text-[10px] font-bold text-[#641C24] mb-1.5">
                <ShieldAlert className="w-3 h-3 text-[#C49A52]" />
                <span>Management & Dual Billing (Owner / Manager Copy)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handlePrintOrDownload('INTERNAL_THERMAL')}
                  disabled={isSubmitting}
                  className="bg-[#852D34] hover:bg-[#641C24] text-white font-bold py-2.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  title="Print Internal Copy with food cost & profit margin breakdown"
                >
                  <Printer className="w-3.5 h-3.5 text-[#C49A52]" />
                  <span>Internal Bill</span>
                </button>
                <button
                  onClick={() => handlePrintOrDownload('BOTH')}
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

