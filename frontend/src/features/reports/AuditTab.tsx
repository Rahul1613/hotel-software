import React from 'react';
import type { AuditLog } from '../../types';

interface AuditTabProps {
  logs: AuditLog[];
}

export const AuditTab: React.FC<AuditTabProps> = ({ logs }) => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold font-serif-royal text-[#641C24]">Security & Management Audit Log</h2>
        <p className="text-xs text-gray-500">Immutable trail of price changes, discounts, cancellations, and staff actions.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#FFF9F0] border-b border-gray-200 text-gray-700 font-bold uppercase text-[10px]">
            <tr>
              <th className="p-3">Timestamp</th>
              <th className="p-3">Action</th>
              <th className="p-3">Entity</th>
              <th className="p-3">Details / Changes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map(l => (
              <tr key={l.id} className="hover:bg-gray-50/70">
                <td className="p-3 font-mono text-gray-500 whitespace-nowrap">{l.created_at}</td>
                <td className="p-3 font-bold text-[#641C24]">{l.action}</td>
                <td className="p-3 text-gray-700">{l.entity_type} {l.entity_id ? `(#${l.entity_id})` : ''}</td>
                <td className="p-3 font-mono text-[11px] text-gray-600 max-w-xs truncate">
                  {l.new_value ? JSON.stringify(l.new_value) : l.old_value ? JSON.stringify(l.old_value) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
