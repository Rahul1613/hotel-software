import React, { useState } from 'react';
import type { UserStaff } from '../../types';
import { apiRequest } from '../../api';
import { Modal } from '../../components/common/Modal';
import { Plus, Key, UserX, UserCheck } from 'lucide-react';

interface StaffTabProps {
  staffList: UserStaff[];
  onRefresh: () => void;
}

export const StaffTab: React.FC<StaffTabProps> = ({ staffList, onRefresh }) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    role: 'waiter',
    phone: '',
  });
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const data = await apiRequest('/api/staff', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setTempPassword(data.temp_password);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create staff');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (user: UserStaff) => {
    if (!window.confirm(`Reset password for ${user.full_name}? A new one-time password will be generated.`)) return;
    try {
      const data = await apiRequest(`/api/staff/${user.id}/reset-password`, {
        method: 'POST',
      });
      alert(`New Temporary Password for ${user.username}:\n\n${data.temp_password}\n\nPlease share this securely with staff.`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleActive = async (user: UserStaff) => {
    try {
      await apiRequest(`/api/staff/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-serif-royal text-[#641C24]">Staff Accounts & Permissions</h2>
          <p className="text-xs text-gray-500">Manage roles (owner, manager, cashier, waiter, chef). Passwords are never stored in plaintext.</p>
        </div>
        <button
          onClick={() => {
            setFormData({ username: '', full_name: '', role: 'waiter', phone: '' });
            setTempPassword(null);
            setIsCreateOpen(true);
          }}
          className="bg-[#641C24] hover:bg-[#852D34] text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#C49A52]" />
          <span>Add Staff Member</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#FFF9F0] border-b border-gray-200 text-gray-700 font-bold uppercase text-[10px]">
            <tr>
              <th className="p-3">Staff Name</th>
              <th className="p-3">Username</th>
              <th className="p-3">Role</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {staffList.map(u => (
              <tr key={u.id} className="hover:bg-gray-50/70">
                <td className="p-3 font-bold text-gray-900">{u.full_name}</td>
                <td className="p-3 font-mono text-gray-600">{u.username}</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-900">
                    {u.role}
                  </span>
                </td>
                <td className="p-3 text-gray-600">{u.phone || '—'}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    {u.is_active ? 'Active' : 'Deactivated'}
                  </span>
                </td>
                <td className="p-3 text-right space-x-2">
                  <button
                    onClick={() => handleResetPassword(u)}
                    className="p-1 text-gray-600 hover:text-[#641C24] font-bold cursor-pointer"
                    title="Generate One-time Password"
                  >
                    <Key className="w-3.5 h-3.5 inline mr-1" />
                    <span>Reset Pass</span>
                  </button>
                  <button
                    onClick={() => handleToggleActive(u)}
                    className="p-1 text-gray-600 hover:text-red-700 font-bold cursor-pointer"
                  >
                    {u.is_active ? <UserX className="w-3.5 h-3.5 inline mr-1" /> : <UserCheck className="w-3.5 h-3.5 inline mr-1" />}
                    <span>{u.is_active ? 'Deactivate' : 'Activate'}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Staff Account">
        {tempPassword ? (
          <div className="space-y-3 p-2 text-center">
            <h4 className="font-bold text-sm text-emerald-800">Staff Account Created!</h4>
            <p className="text-xs text-gray-600">Provide this one-time temporary password to the staff member:</p>
            <div className="p-3 bg-amber-50 border border-amber-300 font-mono text-base font-black text-[#641C24] rounded-xl select-all">
              {tempPassword}
            </div>
            <p className="text-[10px] text-gray-500">They will be prompted to choose their own password on first login.</p>
            <button
              onClick={() => setIsCreateOpen(false)}
              className="w-full bg-[#641C24] text-white py-2 rounded-xl text-xs font-bold"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-3 text-xs">
            {errorMsg && <div className="p-2 bg-red-50 text-red-700 rounded-lg">{errorMsg}</div>}
            <div>
              <label className="block font-bold text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Username (Login ID)</label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Role Permission</label>
              <select
                value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium"
              >
                <option value="waiter">Waiter (Order taking, serving, KOT print)</option>
                <option value="cashier">Cashier (Billing, discount limit ₹100, reprint)</option>
                <option value="chef">Chef (Kitchen screen only)</option>
                <option value="manager">Manager (All ops, unlimited discounts, inventory)</option>
                <option value="owner">Owner (Full administrative control)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Phone Number (Optional)</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#641C24] hover:bg-[#852D34] text-white py-2.5 rounded-xl font-bold cursor-pointer"
            >
              Generate Account
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
};
