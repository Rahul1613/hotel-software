import React, { useState } from 'react';
import type { Reservation, RestaurantTable } from '../../types';
import { apiRequest } from '../../api';
import { Check, X, Calendar } from 'lucide-react';
import { Modal } from '../../components/common/Modal';

interface ReservationsTabProps {
  reservations: Reservation[];
  tables: RestaurantTable[];
  onRefresh: () => void;
}

export const ReservationsTab: React.FC<ReservationsTabProps> = ({ reservations, tables, onRefresh }) => {
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null);
  const [assignedTableId, setAssignedTableId] = useState<string>('');

  const handleUpdateStatus = async (resId: number, status: string, tableId?: string) => {
    try {
      await apiRequest(`/api/reservations/${resId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status,
          assigned_table_id: tableId ? Number(tableId) : undefined,
        }),
      });
      setSelectedRes(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold font-serif-royal text-[#641C24]">Guest Table Bookings</h2>
        <p className="text-xs text-gray-500">Confirm, reject, or assign tables. Staff can send pre-formatted WhatsApp confirmations.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#FFF9F0] border-b border-gray-200 text-gray-700 font-bold uppercase text-[10px]">
            <tr>
              <th className="p-3">Reference #</th>
              <th className="p-3">Guest Details</th>
              <th className="p-3">Reserved Time</th>
              <th className="p-3">Party Size</th>
              <th className="p-3">Section</th>
              <th className="p-3">Assigned Table</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reservations.map(r => (
              <tr key={r.id} className="hover:bg-gray-50/70">
                <td className="p-3 font-mono font-bold text-[#641C24]">{r.booking_reference}</td>
                <td className="p-3">
                  <strong className="text-gray-900 block">{r.customer_name}</strong>
                  <span className="text-[11px] text-gray-500">{r.mobile_number}</span>
                </td>
                <td className="p-3 text-gray-700">
                  {new Date(r.reserved_for).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </td>
                <td className="p-3 font-bold">{r.guests_count} Guests</td>
                <td className="p-3 uppercase font-semibold">{r.seating_preference}</td>
                <td className="p-3 text-gray-800">{r.assigned_table_name || 'Unassigned'}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    r.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800' :
                    r.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {r.status}
                  </span>
                </td>
                <td className="p-3 text-right space-x-2">
                  {r.whatsapp_link && (
                    <a
                      href={r.whatsapp_link}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1 bg-[#25D366]/20 text-[#128C7E] border border-[#25D366]/40 rounded font-bold text-[10px] inline-block"
                    >
                      WhatsApp
                    </a>
                  )}
                  {r.status === 'PENDING' && (
                    <button
                      onClick={() => {
                        setSelectedRes(r);
                        setAssignedTableId('');
                      }}
                      className="px-2.5 py-1 bg-[#641C24] text-white rounded font-bold text-[10px] cursor-pointer"
                    >
                      Assign & Confirm
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!selectedRes} onClose={() => setSelectedRes(null)} title={`Confirm Booking: ${selectedRes?.customer_name}`}>
        <div className="space-y-3 text-xs">
          <p className="text-gray-600">
            Booking: {selectedRes?.guests_count} Guests on {selectedRes?.reserved_for ? new Date(selectedRes.reserved_for).toLocaleString() : ''}
          </p>
          <div>
            <label className="block font-bold text-gray-700 mb-1">Assign Table</label>
            <select
              value={assignedTableId}
              onChange={e => setAssignedTableId(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-2 font-bold"
            >
              <option value="">Auto / Select Table</option>
              {tables.map(t => (
                <option key={t.id} value={t.id}>Table {t.table_number} ({t.section}, Cap: {t.capacity})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={() => selectedRes && handleUpdateStatus(selectedRes.id, 'CONFIRMED', assignedTableId)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl"
            >
              Confirm
            </button>
            <button
              onClick={() => selectedRes && handleUpdateStatus(selectedRes.id, 'REJECTED')}
              className="bg-red-100 hover:bg-red-200 text-red-700 font-bold py-2 rounded-xl"
            >
              Reject
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
