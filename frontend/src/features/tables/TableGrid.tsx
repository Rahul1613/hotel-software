import React, { useState } from 'react';
import type { RestaurantTable } from '../../types';
import { apiRequest } from '../../api';
import { Eye, ArrowRightLeft, Merge, FileText } from 'lucide-react';
import { Modal } from '../../components/common/Modal';

interface TableGridProps {
  tables: RestaurantTable[];
  onRefresh: () => void;
  onBillTable?: (tbl: RestaurantTable) => void;
}

export const TableGrid: React.FC<TableGridProps> = ({ tables, onRefresh, onBillTable }) => {
  const [shiftSource, setShiftSource] = useState<RestaurantTable | null>(null);
  const [shiftDest, setShiftDest] = useState<string>('02');
  const [mergeSource, setMergeSource] = useState<string>('02');
  const [mergeDest, setMergeDest] = useState<RestaurantTable | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleShift = async () => {
    if (!shiftSource) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await apiRequest('/api/tables/shift-session', {
        method: 'POST',
        body: JSON.stringify({
          from_table: shiftSource.table_number,
          to_table: shiftDest,
        }),
      });
      setShiftSource(null);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to shift table');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMerge = async () => {
    if (!mergeDest) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await apiRequest('/api/tables/merge-sessions', {
        method: 'POST',
        body: JSON.stringify({
          primary_table: mergeDest.table_number,
          secondary_table: mergeSource,
        }),
      });
      setMergeDest(null);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to merge tables');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {tables.map(tbl => {
          const statusColors: { [key: string]: string } = {
            AVAILABLE: 'border-emerald-300 bg-emerald-50/50 text-emerald-900',
            ORDERING: 'border-amber-300 bg-amber-50/50 text-amber-900',
            PREPARING: 'border-orange-300 bg-orange-50/50 text-orange-900',
            OCCUPIED: 'border-purple-300 bg-purple-50/50 text-purple-900',
            RESERVED: 'border-blue-300 bg-blue-50/50 text-blue-900',
            NEEDS_ATTENTION: 'border-red-400 bg-red-50 text-red-900',
            DISABLED: 'border-gray-400 bg-gray-100 text-gray-500',
          };
          const colorClass = statusColors[tbl.status] || 'border-gray-200 bg-white text-gray-800';

          return (
            <div
              key={tbl.id}
              className={`rounded-2xl p-4 border-2 transition-all flex flex-col justify-between ${colorClass}`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-serif-royal font-bold text-lg">{tbl.name}</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 border border-gray-300 uppercase">
                    {tbl.section}
                  </span>
                </div>
                <p className="text-xs mb-2 font-semibold">
                  Status: <span className="underline">{tbl.status}</span>
                </p>
                <p className="text-[11px] text-gray-600 mb-2">Capacity: {tbl.capacity} Guests</p>
              </div>

              <div className="pt-3 border-t border-black/10 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <a
                    href={`/menu?table=${tbl.table_number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#641C24] font-bold underline flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> Open
                  </a>
                  <button
                    onClick={async () => {
                      const next = tbl.manual_status_override ? null : 'NEEDS_ATTENTION';
                      await apiRequest(`/api/tables/${tbl.id}/override-status`, {
                        method: 'PUT',
                        body: JSON.stringify({ override: next }),
                      });
                      onRefresh();
                    }}
                    className="px-2 py-1 rounded bg-white font-bold border border-gray-300 text-[10px] cursor-pointer"
                  >
                    {tbl.manual_status_override ? 'Clear Flag' : 'Flag Attention'}
                  </button>
                </div>

                {tbl.status !== 'AVAILABLE' && (
                  <div className="space-y-1.5 pt-1 border-t border-black/5">
                    {onBillTable && (
                      <button
                        onClick={() => onBillTable(tbl)}
                        className="w-full bg-[#641C24] hover:bg-[#852D34] text-white py-1.5 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#C49A52]" />
                        <span>Generate Bill (बिल बनवा)</span>
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => {
                          setShiftSource(tbl);
                          setErrorMsg('');
                        }}
                        className="bg-white/90 hover:bg-white text-gray-800 border border-gray-300 py-1 rounded font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>Shift</span>
                      </button>
                      <button
                        onClick={() => {
                          setMergeDest(tbl);
                          setErrorMsg('');
                        }}
                        className="bg-white/90 hover:bg-white text-gray-800 border border-gray-300 py-1 rounded font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Merge className="w-3 h-3" />
                        <span>Merge</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Shift Table Modal */}
      <Modal isOpen={!!shiftSource} onClose={() => setShiftSource(null)} title={`Shift Orders from Table ${shiftSource?.table_number}`}>
        <div className="space-y-3">
          {errorMsg && <div className="p-2 bg-red-50 text-red-700 text-xs rounded-xl">{errorMsg}</div>}
          <p className="text-xs text-gray-600">Select destination table to move all active dining orders:</p>
          <select
            value={shiftDest}
            onChange={e => setShiftDest(e.target.value)}
            className="w-full border border-gray-300 rounded-xl p-2 text-xs font-bold"
          >
            {tables.filter(t => t.table_number !== shiftSource?.table_number).map(t => (
              <option key={t.id} value={t.table_number}>Table {t.table_number} ({t.status})</option>
            ))}
          </select>
          <button
            onClick={handleShift}
            disabled={isSubmitting}
            className="w-full bg-[#641C24] hover:bg-[#852D34] text-white font-bold py-2.5 rounded-xl text-xs"
          >
            Confirm Shift
          </button>
        </div>
      </Modal>

      {/* Merge Table Modal */}
      <Modal isOpen={!!mergeDest} onClose={() => setMergeDest(null)} title={`Merge into Table ${mergeDest?.table_number}`}>
        <div className="space-y-3">
          {errorMsg && <div className="p-2 bg-red-50 text-red-700 text-xs rounded-xl">{errorMsg}</div>}
          <p className="text-xs text-gray-600">Select another table to merge its active orders into Table {mergeDest?.table_number}:</p>
          <select
            value={mergeSource}
            onChange={e => setMergeSource(e.target.value)}
            className="w-full border border-gray-300 rounded-xl p-2 text-xs font-bold"
          >
            {tables.filter(t => t.table_number !== mergeDest?.table_number).map(t => (
              <option key={t.id} value={t.table_number}>Table {t.table_number} ({t.status})</option>
            ))}
          </select>
          <button
            onClick={handleMerge}
            disabled={isSubmitting}
            className="w-full bg-[#641C24] hover:bg-[#852D34] text-white font-bold py-2.5 rounded-xl text-xs"
          >
            Confirm Merge
          </button>
        </div>
      </Modal>
    </div>
  );
};
