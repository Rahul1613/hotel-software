import React, { useState } from 'react';
import type { Order } from '../../types';
import { formatINR } from '../../utils/money';
import { printViaHiddenIframe } from '../../utils/printer';
import { ChefHat, CheckCheck, FileText, Printer, Utensils } from 'lucide-react';

interface OrderCardProps {
  order: Order;
  onUpdateStatus: (orderId: number, status: string) => Promise<void>;
  onOpenBillModal: (order: Order) => void;
  onReprintBill: (order: Order) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onUpdateStatus,
  onOpenBillModal,
  onReprintBill
}) => {
  const isNew = order.status === 'RECEIVED';

  return (
    <div
      className={`bg-white rounded-2xl p-4 border transition-all flex flex-col justify-between ${
        isNew
          ? 'border-red-500 ring-2 ring-red-300 shadow-md animate-pulse-subtle'
          : 'border-gray-200 shadow-2xs'
      }`}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="bg-[#641C24] text-white text-xs font-bold px-2.5 py-1 rounded-lg">
              {order.table_number ? `Table ${order.table_number}` : 'Takeaway'}
            </span>
            <span className="text-[10px] text-gray-500 font-mono">{order.order_number}</span>
          </div>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              order.status === 'RECEIVED'
                ? 'bg-red-100 text-red-800'
                : order.status === 'ACCEPTED'
                ? 'bg-blue-100 text-blue-800'
                : order.status === 'PREPARING'
                ? 'bg-amber-100 text-amber-800'
                : order.status === 'READY'
                ? 'bg-emerald-100 text-emerald-800'
                : order.status === 'SERVED'
                ? 'bg-purple-100 text-purple-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {order.status}
          </span>
        </div>

        <p className="text-xs text-gray-600 mb-2">
          Guest: <strong className="text-gray-800">{order.customer_name}</strong>
          {order.customer_phone ? ` (${order.customer_phone})` : ''}
        </p>

        <div className="bg-[#FFF9F0] rounded-xl p-3 border border-[#C49A52]/20 mb-3 space-y-1.5 text-xs">
          {order.items.map(it => (
            <div key={it.id} className="flex justify-between items-start">
              <div>
                <span className="font-semibold text-gray-800">{it.item_name}</span>
                <span className="ml-1 text-gray-500 font-bold">× {it.quantity}</span>
                {it.customization && (
                  <p className="text-[10px] text-amber-800 italic">{it.customization}</p>
                )}
              </div>
              <span className="font-bold text-gray-700">{formatINR(it.total_price)}</span>
            </div>
          ))}
        </div>

        {order.special_instructions && (
          <p className="text-xs bg-amber-50 text-amber-900 p-2 rounded-lg mb-3 border border-amber-200">
            <strong>Note:</strong> {order.special_instructions}
          </p>
        )}

        <div className="flex justify-between items-baseline text-xs font-bold text-gray-800 mb-3">
          <span>Total Payable:</span>
          <span className="text-base text-[#641C24]">{formatINR(order.final_amount)}</span>
        </div>
      </div>

      <div className="pt-2 border-t border-gray-100 space-y-2">
        <div className="grid grid-cols-2 gap-2 text-xs">
          {order.status === 'RECEIVED' && (
            <>
              <button
                onClick={() => onUpdateStatus(order.id, 'ACCEPTED')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg cursor-pointer"
              >
                Accept Order
              </button>
              <button
                onClick={() => onUpdateStatus(order.id, 'CANCELLED')}
                className="bg-red-100 hover:bg-red-200 text-red-700 font-bold py-2 rounded-lg cursor-pointer"
              >
                Reject
              </button>
            </>
          )}

          {order.status !== 'CANCELLED' && (
            <div className="col-span-2 flex justify-end pb-1">
              <button
                onClick={() => printViaHiddenIframe(`/api/orders/${order.id}/kot/html`)}
                className="text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-2 py-1 rounded flex items-center gap-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-[#641C24]" />
                <span>Print KOT Ticket</span>
              </button>
            </div>
          )}

          {order.status === 'ACCEPTED' && (
            <button
              onClick={() => onUpdateStatus(order.id, 'PREPARING')}
              className="col-span-2 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded-lg cursor-pointer flex items-center justify-center gap-1"
            >
              <ChefHat className="w-4 h-4" />
              <span>Mark Cooking</span>
            </button>
          )}

          {order.status === 'PREPARING' && (
            <button
              onClick={() => onUpdateStatus(order.id, 'READY')}
              className="col-span-2 bg-[#258451] hover:bg-emerald-800 text-white font-bold py-2 rounded-lg cursor-pointer flex items-center justify-center gap-1"
            >
              <Utensils className="w-4 h-4" />
              <span>Mark Ready</span>
            </button>
          )}

          {order.status === 'READY' && (
            <button
              onClick={() => onUpdateStatus(order.id, 'SERVED')}
              className="col-span-2 bg-purple-700 hover:bg-purple-800 text-white font-bold py-2 rounded-lg cursor-pointer flex items-center justify-center gap-1"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark Served to Table</span>
            </button>
          )}

          {order.status === 'SERVED' ? (
            <button
              onClick={() => onOpenBillModal(order)}
              className="col-span-2 bg-[#641C24] hover:bg-[#852D34] text-white font-bold py-2 rounded-lg cursor-pointer flex items-center justify-center gap-1 shadow-xs"
            >
              <FileText className="w-4 h-4 text-[#C49A52]" />
              <span>Generate GST Bill & Settle</span>
            </button>
          ) : order.status !== 'COMPLETED' && (
            <button
              onClick={() => onOpenBillModal(order)}
              className="col-span-2 bg-amber-50 hover:bg-amber-100 text-[#641C24] border border-[#C49A52]/60 font-bold py-1.5 rounded-lg cursor-pointer flex items-center justify-center gap-1 text-[11px] mt-1"
            >
              <FileText className="w-3.5 h-3.5 text-[#C49A52]" />
              <span>Quick Bill / Settle Table</span>
            </button>
          )}

          {order.status === 'COMPLETED' && (
            <div className="col-span-2 flex items-center justify-between text-xs text-gray-500 pt-1">
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Paid & Closed</span>
              </span>
              <button
                onClick={() => onOpenBillModal(order)}
                className="text-[#641C24] bg-amber-50 hover:bg-amber-100 border border-[#C49A52]/50 px-2.5 py-1.5 rounded-lg font-bold cursor-pointer flex items-center gap-1.5 shadow-2xs text-xs"
                title="Open reprint & bill download options"
              >
                <Printer className="w-3.5 h-3.5 text-[#641C24]" />
                <span>Reprint / Bill Options</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
