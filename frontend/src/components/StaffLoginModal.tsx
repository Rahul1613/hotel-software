import React, { useState } from 'react';
import { EkdantLogo } from './EkdantLogo';
import { apiRequest } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { KeyRound, User, Lock, ArrowRight } from 'lucide-react';

export const StaffLoginModal: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      login(data.token, data.user);

      // Route by role
      const role = data.user.role.toLowerCase();
      if (['chef', 'cook'].includes(role)) {
        navigate('/kitchen');
      } else if (['owner', 'admin'].includes(role)) {
        navigate('/admin');
      } else {
        navigate('/staff');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid username or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF9F0] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-[#C49A52]/40 space-y-6">
        <div className="text-center">
          <EkdantLogo size="md" />
          <h2 className="text-xl font-bold font-serif-royal text-[#641C24] mt-4">
            Staff & Kitchen Portal Login
          </h2>
          <p className="text-xs text-gray-500">Authorized personnel only. Sessions expire in 12 hours.</p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-gray-700 mb-1">Username / Login ID</label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. waiter1, manager, owner"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:border-[#641C24] font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:border-[#641C24] font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#641C24] hover:bg-[#852D34] text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
          >
            <span>Login to Station</span>
            <ArrowRight className="w-4 h-4 text-[#C49A52]" />
          </button>
        </form>

        <div className="text-center pt-2 border-t border-gray-100">
          <a href="/" className="text-xs text-gray-500 hover:text-[#641C24] font-semibold underline">
            ← Return to Customer Dining Page
          </a>
        </div>
      </div>
    </div>
  );
};
