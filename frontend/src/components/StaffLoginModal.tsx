import React, { useState } from 'react';
import { EkdantLogo } from './EkdantLogo';
import { 
  Lock, User, Eye, EyeOff, ShieldCheck, 
  ChefHat, Receipt, Utensils, Award, Settings, ArrowRight
} from 'lucide-react';
import type { UserStaff } from '../types';

interface LoginProps {
  onLoginSuccess: (user: UserStaff) => void;
  onCancel: () => void;
}

const PRESET_ROLES = [
  {
    roleId: 'manager',
    title: 'Manager',
    marathi: 'व्यवस्थापक',
    username: 'manager',
    password: 'ekdant123',
    icon: Award,
    color: 'border-amber-500 bg-amber-50 text-amber-900',
    desc: 'Floor operations, order taking, table shifts & inventory'
  },
  {
    roleId: 'cashier',
    title: 'Cashier',
    marathi: 'रोखपाल / बिलिंग',
    username: 'cashier',
    password: 'ekdant123',
    icon: Receipt,
    color: 'border-emerald-500 bg-emerald-50 text-emerald-900',
    desc: 'Counter GST billing, thermal printing & cash/UPI settlement'
  },
  {
    roleId: 'waiter',
    title: 'Waiter / Captain',
    marathi: 'वेटर / कॅप्टन',
    username: 'waiter',
    password: 'ekdant123',
    icon: Utensils,
    color: 'border-blue-500 bg-blue-50 text-blue-900',
    desc: 'Table service requests, quick KOT punch & table status'
  },
  {
    roleId: 'chef',
    title: 'Kitchen / Chef',
    marathi: 'किचन / शेफ',
    username: 'chef',
    password: 'ekdant123',
    icon: ChefHat,
    color: 'border-orange-500 bg-orange-50 text-orange-900',
    desc: 'Live Kitchen Display System (KDS) & order preparation'
  },
  {
    roleId: 'owner',
    title: 'Proprietor / Owner',
    marathi: 'मालक / मालकीण',
    username: 'owner',
    password: 'ekdant123',
    icon: ShieldCheck,
    color: 'border-purple-500 bg-purple-50 text-purple-900',
    desc: 'Daily revenue reports, staff management & full overview'
  },
  {
    roleId: 'admin',
    title: 'Admin Desk',
    marathi: 'सिस्टम ॲडमिन',
    username: 'admin',
    password: 'ekdant123',
    icon: Settings,
    color: 'border-stone-500 bg-stone-50 text-stone-900',
    desc: 'Menu pricing, QR stand token configs & system logs'
  }
];

export const StaffLoginModal: React.FC<LoginProps> = ({ onLoginSuccess, onCancel }) => {
  const [username, setUsername] = useState('manager');
  const [password, setPassword] = useState('ekdant123');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('manager');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectPreset = (preset: typeof PRESET_ROLES[0]) => {
    setSelectedRole(preset.roleId);
    setUsername(preset.username);
    setPassword(preset.password);
    setErrorMsg('');
  };

  const executeLogin = async (usr: string, pwd: string) => {
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: usr.trim().toLowerCase(), 
          password: pwd.trim() 
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }

      // Persist session to localStorage
      localStorage.setItem('ekdant_staff_user', JSON.stringify(data));
      onLoginSuccess(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please verify username and password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeLogin(username, password);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#FFF9F0] max-w-lg w-full rounded-3xl p-5 sm:p-7 shadow-2xl border-2 border-[#C49A52]/50 relative my-auto animate-in fade-in zoom-in-95 duration-200">
        <button 
          onClick={onCancel}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-gray-500 hover:text-black font-bold text-sm cursor-pointer transition-colors"
          title="Close Login"
        >
          ✕
        </button>

        <div className="text-center mb-5">
          <EkdantLogo size="sm" showSubtitle={false} />
          <h2 className="font-serif-royal font-bold text-xl text-[#641C24] mt-2">
            हॉटेल एकदंत स्टाफ व व्यवस्थापन
          </h2>
          <p className="text-xs text-gray-600 font-medium">Hotel Ekdant Staff, Cashier & Kitchen Desk</p>
        </div>

        {/* 1-Tap Quick Role Selector */}
        <div className="mb-4">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-2">
            Select Role for Quick Access / भूमिका निवडा:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PRESET_ROLES.map((preset) => {
              const Icon = preset.icon;
              const isSelected = selectedRole === preset.roleId && username.toLowerCase() === preset.username;
              return (
                <button
                  key={preset.roleId}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    isSelected 
                      ? 'border-[#641C24] bg-[#641C24] text-white shadow-md ring-2 ring-[#C49A52]' 
                      : 'border-gray-200 bg-white hover:border-[#C49A52] hover:bg-amber-50/50 text-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-[#C49A52]' : 'text-gray-500'}`} />
                    <span className="text-[10px] font-mono opacity-70">
                      {preset.username}
                    </span>
                  </div>
                  <span className="font-bold text-xs leading-tight">{preset.title}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                    {preset.marathi}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 mb-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 text-center font-medium">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-gray-700 mb-1">Username / वापरकर्ता नाव</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                required
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setSelectedRole('');
                }}
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:border-[#641C24] focus:ring-1 focus:ring-[#641C24] font-medium"
                placeholder="manager, cashier, chef, waiter..."
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-700 mb-1">Password / संकेतशब्द</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type={showPassword ? "text" : "password"} 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-10 py-2.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:border-[#641C24] focus:ring-1 focus:ring-[#641C24] font-medium font-mono"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-[#641C24] hover:bg-[#852D34] active:scale-[0.99] text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all disabled:opacity-50"
            >
              <span>{isSubmitting ? 'प्रमाणित करत आहे...' : 'Sign In / लॉगिन करा'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="sm:w-28 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-xl font-bold text-xs transition-colors cursor-pointer text-center"
            >
              रद्द करा
            </button>
          </div>
        </form>

        <div className="mt-4 pt-3 border-t border-gray-200/80 text-center">
          <p className="text-[11px] text-gray-500">
            Master Passcode for all test roles: <code className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-mono font-bold">ekdant123</code>
          </p>
        </div>
      </div>
    </div>
  );
};
