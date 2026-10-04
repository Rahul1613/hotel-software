import React, { useState, useEffect } from 'react';
import type { InternalFinancialReport, Invoice, InternalBillData } from '../../types';
import { apiRequest } from '../../api';
import { formatINR } from '../../utils/money';
import { printViaHiddenIframe } from '../../utils/printer';
import { Modal } from '../../components/common/Modal';
import { 
  TrendingUp, DollarSign, PieChart, ShieldAlert, 
  Printer, Layers, FileText, PlusCircle, CheckCircle2, AlertCircle 
} from 'lucide-react';

export const InternalFinancialTab: React.FC = () => {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const [report, setReport] = useState<InternalFinancialReport | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selected invoice for internal P&L modal
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [internalBill, setInternalBill] = useState<InternalBillData | null>(null);
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // New adjustment form
  const [noteType, setNoteType] = useState<'REMARK' | 'ADJUSTMENT' | 'REFUND' | 'CORRECTION'>('REMARK');
  const [adjAmount, setAdjAmount] = useState<number>(0);
  const [adjReason, setAdjReason] = useState<string>('');
  const [adjSubmitting, setAdjSubmitting] = useState(false);
  const [adjSuccessMsg, setAdjSuccessMsg] = useState('');

  const fetchFinancials = async () => {
    setLoading(true);
    try {
      const [repData, invData] = await Promise.all([
        apiRequest<InternalFinancialReport>(`/api/reports/internal-financial?period=${period}`),
        apiRequest<Invoice[]>('/api/invoices?limit=50'),
      ]);
      setReport(repData);
      setInvoices(invData);
    } catch (err) {
      console.error('Failed to load internal financial report', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, [period]);

  const openInternalDetail = async (invoiceId: number) => {
    setSelectedInvoiceId(invoiceId);
    setLoadingDetail(true);
    setInternalModalOpen(true);
    setAdjSuccessMsg('');
    try {
      const detail = await apiRequest<InternalBillData>(`/api/invoices/${invoiceId}/internal`);
      setInternalBill(detail);
    } catch (err: any) {
      alert(err.message || 'Failed to load internal invoice detail.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId || !adjReason.trim()) return;

    setAdjSubmitting(true);
    try {
      await apiRequest(`/api/invoices/${selectedInvoiceId}/adjustment`, {
        method: 'POST',
        body: JSON.stringify({
          note_type: noteType,
          amount: adjAmount,
          reason: adjReason,
        }),
      });
      setAdjReason('');
      setAdjAmount(0);
      setAdjSuccessMsg('Adjustment recorded in audit trail.');
      // Refresh invoice detail and overall financials
      const detail = await apiRequest<InternalBillData>(`/api/invoices/${selectedInvoiceId}/internal`);
      setInternalBill(detail);
      fetchFinancials();
    } catch (err: any) {
      alert(err.message || 'Failed to record adjustment');
    } finally {
      setAdjSubmitting(false);
    }
  };

  const handlePrint = (type: 'CUSTOMER' | 'INTERNAL' | 'BOTH') => {
    if (!selectedInvoiceId) return;
    if (type === 'CUSTOMER') {
      printViaHiddenIframe(`/api/invoices/${selectedInvoiceId}/receipt/html`);
    } else if (type === 'INTERNAL') {
      printViaHiddenIframe(`/api/invoices/${selectedInvoiceId}/internal-receipt/html`);
    } else {
      printViaHiddenIframe(`/api/invoices/${selectedInvoiceId}/both-receipts/html`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Period Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold font-serif-royal text-[#641C24]">Internal Financial & P&L Suite</h2>
            <span className="bg-[#641C24] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              Confidential
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Real food preparation costs, true gross profit, tax liabilities, and dual-billing management.
          </p>
        </div>

        <div className="flex items-center bg-white p-1 rounded-xl border border-gray-300 shadow-2xs">
          {(['today', 'week', 'month', 'year'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors cursor-pointer ${
                period === p ? 'bg-[#641C24] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {p === 'week' ? 'Past 7 Days' : p === 'today' ? 'Today' : p === 'month' ? 'This Month' : 'This Year'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
            <span className="text-xs text-gray-500 uppercase font-semibold">Total Revenue (Customer)</span>
            <p className="text-2xl font-black text-gray-900 mt-1">{formatINR(report.total_revenue)}</p>
            <span className="text-[10px] text-gray-400">{report.invoices_count} Paid Invoices</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
            <span className="text-xs text-gray-500 uppercase font-semibold">Total Food Prep Cost</span>
            <p className="text-2xl font-black text-amber-700 mt-1">{formatINR(report.total_food_cost)}</p>
            <span className="text-[10px] text-gray-400">Aggregated Item COGS</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
            <span className="text-xs text-gray-500 uppercase font-semibold">Gross Profit</span>
            <p className={`text-2xl font-black mt-1 ${report.gross_profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {formatINR(report.gross_profit)}
            </p>
            <span className="text-[10px] font-bold text-emerald-600">{report.profit_margin_pct}% Margin</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
            <span className="text-xs text-gray-500 uppercase font-semibold">Net P&L (Post-Adj.)</span>
            <p className={`text-2xl font-black mt-1 ${report.net_profit >= 0 ? 'text-[#641C24]' : 'text-rose-700'}`}>
              {formatINR(report.net_profit)}
            </p>
            <span className="text-[10px] text-gray-400">
              Adj: {formatINR(report.net_adjustments)}
            </span>
          </div>
        </div>
      )}

      {/* Tax & Payment Channel Breakdown */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-[#C49A52]" />
              <span>Tax Liabilities & Discounts</span>
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">CGST Collected (2.5%):</span>
                <span className="font-semibold">{formatINR(report.total_cgst)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-600">SGST Collected (2.5%):</span>
                <span className="font-semibold">{formatINR(report.total_sgst)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100 font-bold text-[#641C24]">
                <span>Total GST Liability:</span>
                <span>{formatINR(report.total_tax)}</span>
              </div>
              <div className="flex justify-between py-1 text-emerald-700 font-medium">
                <span>Authorized Discounts Given:</span>
                <span>- {formatINR(report.total_discount_given)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>Payment Channel Breakdown</span>
            </h3>
            <div className="space-y-2 text-xs">
              {Object.entries(report.payment_breakdown).length === 0 ? (
                <p className="text-gray-400 text-xs italic">No transactions recorded for this period.</p>
              ) : (
                Object.entries(report.payment_breakdown).map(([pm, amt]) => (
                  <div key={pm} className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-600 uppercase font-semibold">{pm}</span>
                    <span className="font-bold text-gray-900">{formatINR(amt)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoices List for Internal Inspection */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
        <div className="p-4 bg-[#FFF9F0] border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-[#641C24]">Invoices & Dual Billing Registry</h3>
            <p className="text-[11px] text-gray-500">Inspect internal food cost, gross profit, and adjustments per bill.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3">Bill Number</th>
                <th className="p-3">Date</th>
                <th className="p-3">Table / Guest</th>
                <th className="p-3">Customer Paid</th>
                <th className="p-3">Payment</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50/70">
                  <td className="p-3 font-bold text-gray-900">{inv.invoice_number}</td>
                  <td className="p-3 text-gray-500">{inv.created_at ? new Date(inv.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</td>
                  <td className="p-3">
                    <span className="font-medium">{inv.table_number ? `T-${inv.table_number}` : 'Takeaway'}</span>
                    <span className="text-gray-400 ml-1">({inv.customer_name})</span>
                  </td>
                  <td className="p-3 font-bold text-[#641C24]">{formatINR(inv.final_payable)}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-800">
                      {inv.payment_method}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => openInternalDetail(inv.id)}
                      className="bg-[#641C24] hover:bg-[#852D34] text-white font-bold px-3 py-1.5 rounded-lg text-xs cursor-pointer shadow-2xs inline-flex items-center gap-1"
                    >
                      <ShieldAlert className="w-3 h-3 text-[#C49A52]" />
                      <span>Internal P&L</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Internal Management Bill Modal */}
      <Modal
        isOpen={internalModalOpen}
        onClose={() => setInternalModalOpen(false)}
        title={internalBill ? `INTERNAL P&L — ${internalBill.invoice_number}` : 'Loading Internal Bill...'}
      >
        {loadingDetail || !internalBill ? (
          <div className="p-8 text-center text-xs text-gray-500">Loading internal management data...</div>
        ) : (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Watermark Banner */}
            <div className="bg-red-50 border border-red-300 rounded-xl p-2.5 text-center text-xs font-bold text-red-800">
              ⚠ INTERNAL MANAGEMENT COPY — NOT A CUSTOMER TAX INVOICE
            </div>

            {/* Financial Overview Cards */}
            <div className="grid grid-cols-3 gap-2 bg-[#FFF9F0] p-3 rounded-xl border border-[#C49A52]/30 text-xs">
              <div>
                <span className="text-gray-500 text-[10px] block">Customer Sale:</span>
                <span className="font-bold text-gray-900">{formatINR(internalBill.final_payable)}</span>
              </div>
              <div>
                <span className="text-gray-500 text-[10px] block">Total Food Cost:</span>
                <span className="font-bold text-amber-700">{formatINR(internalBill.total_food_cost)}</span>
              </div>
              <div>
                <span className="text-gray-500 text-[10px] block">Gross Profit ({internalBill.profit_margin_pct}%):</span>
                <span className={`font-bold ${internalBill.gross_profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatINR(internalBill.gross_profit)}
                </span>
              </div>
            </div>

            {/* Item-wise P&L Table */}
            <div>
              <h4 className="font-bold text-xs text-gray-700 mb-1.5 uppercase tracking-wider">Item Cost & Margin Breakdown</h4>
              <table className="w-full text-left text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-100 text-[10px] uppercase font-bold text-gray-600">
                  <tr>
                    <th className="p-2">Item</th>
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-2 text-right">Sale</th>
                    <th className="p-2 text-right">Cost</th>
                    <th className="p-2 text-right">Profit</th>
                    <th className="p-2 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {internalBill.items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="p-2 font-medium">{it.item_name}</td>
                      <td className="p-2 text-center">{it.quantity}</td>
                      <td className="p-2 text-right">{formatINR(it.selling_total)}</td>
                      <td className="p-2 text-right text-gray-600">{formatINR(it.cost_total)}</td>
                      <td className={`p-2 text-right font-bold ${it.gross_profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {formatINR(it.gross_profit)}
                      </td>
                      <td className="p-2 text-right font-semibold">{it.margin_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Print Action Buttons */}
            <div className="pt-2 border-t border-gray-200">
              <span className="text-[11px] font-bold text-gray-700 block mb-1.5">Dual Printing Actions</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handlePrint('CUSTOMER')}
                  className="bg-[#258451] hover:bg-emerald-800 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Customer Bill</span>
                </button>
                <button
                  onClick={() => handlePrint('INTERNAL')}
                  className="bg-[#641C24] hover:bg-[#852D34] text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-[#C49A52]" />
                  <span>Internal Bill</span>
                </button>
                <button
                  onClick={() => handlePrint('BOTH')}
                  className="bg-gradient-to-r from-[#258451] to-[#641C24] text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                >
                  <Layers className="w-3.5 h-3.5 text-yellow-300" />
                  <span>Both Bills</span>
                </button>
              </div>
            </div>

            {/* Adjustments & Remarks Section */}
            <div className="pt-2 border-t border-gray-200 space-y-2">
              <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider">Internal Adjustments & Audit Trail</h4>
              
              {internalBill.adjustments.length > 0 ? (
                <div className="space-y-1.5 bg-gray-50 p-2.5 rounded-xl border border-gray-200 text-xs">
                  {internalBill.adjustments.map(adj => (
                    <div key={adj.id} className="flex justify-between items-center py-1 border-b border-gray-200 last:border-0">
                      <div>
                        <span className="font-bold text-gray-800">[{adj.note_type}]</span> {adj.reason}
                        <span className="text-[10px] text-gray-400 ml-1.5">by {adj.created_by}</span>
                      </div>
                      <span className={`font-bold ${adj.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {adj.amount >= 0 ? '+' : ''}{formatINR(adj.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-xs italic">No internal adjustments recorded for this invoice.</p>
              )}

              {/* Add Adjustment Form */}
              <form onSubmit={handleAddAdjustment} className="bg-[#FFF9F0] p-3 rounded-xl border border-[#C49A52]/30 space-y-2 text-xs">
                <span className="font-bold text-gray-800 block text-[11px]">Record Authorized Adjustment / Remark</span>
                {adjSuccessMsg && (
                  <div className="text-emerald-700 text-xs font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{adjSuccessMsg}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Type</label>
                    <select
                      value={noteType}
                      onChange={e => setNoteType(e.target.value as any)}
                      className="w-full border border-gray-300 rounded-lg p-1.5 text-xs bg-white"
                    >
                      <option value="REMARK">Internal Remark (₹0)</option>
                      <option value="ADJUSTMENT">Correction Adjustment</option>
                      <option value="REFUND">Post-Bill Refund</option>
                      <option value="CORRECTION">Ledger Correction</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Adjustment Amount (₹)</label>
                    <input
                      type="number"
                      step="any"
                      value={adjAmount}
                      onChange={e => setAdjAmount(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-lg p-1.5 text-xs bg-white"
                      placeholder="0 (+ or -)"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Reason (Mandatory for Audit Trail)</label>
                  <input
                    type="text"
                    required
                    value={adjReason}
                    onChange={e => setAdjReason(e.target.value)}
                    placeholder="e.g., Authorized ₹50 gesture discount due to delayed dessert"
                    className="w-full border border-gray-300 rounded-lg p-1.5 text-xs bg-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={adjSubmitting}
                  className="bg-[#641C24] hover:bg-[#852D34] text-white font-bold py-1.5 px-3 rounded-lg text-xs cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  {adjSubmitting ? 'Recording...' : 'Add Audit Adjustment'}
                </button>
              </form>
            </div>

            {/* Print History Audit */}
            {internalBill.print_history.length > 0 && (
              <div className="pt-2 border-t border-gray-200">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Print History Audit Log
                </span>
                <div className="space-y-1 text-[11px] text-gray-600">
                  {internalBill.print_history.map((ph, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>• Printed [{ph.print_type}] by {ph.printed_by}</span>
                      <span className="text-gray-400">{ph.created_at ? new Date(ph.created_at).toLocaleTimeString() : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
