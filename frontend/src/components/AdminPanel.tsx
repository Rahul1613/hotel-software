import React, { useState, useEffect } from 'react';
import { EkdantLogo } from './EkdantLogo';
import type { 
  RestaurantInfo, MenuItem, MenuCategory, RestaurantTable, 
  Reservation, InventoryItem, UserStaff, Review, AuditLog 
} from '../types';
import { apiRequest } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatINR } from '../utils/money';

// Modular Tab Components
import { MenuTab } from '../features/menu/MenuTab';
import { InventoryTab } from '../features/inventory/InventoryTab';
import { StaffTab } from '../features/staff/StaffTab';
import { ReviewsTab } from '../features/reviews/ReviewsTab';
import { ReservationsTab } from '../features/reservations/ReservationsTab';
import { SettingsTab } from '../features/settings/SettingsTab';
import { AuditTab } from '../features/reports/AuditTab';
import { InternalFinancialTab } from '../features/reports/InternalFinancialTab';

import { 
  BarChart3, Utensils, Settings, CalendarCheck, 
  FileSpreadsheet, Package, Users, Star, ShieldAlert, TrendingUp 
} from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const { logout, currentUser } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [staffList, setStaffList] = useState<UserStaff[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const fetchAdminData = async () => {
    try {
      const [restRes, sumRes, catRes, menuRes, tblRes, resRes, invRes, staffRes, revRes, auditRes] = await Promise.all([
        apiRequest<RestaurantInfo>('/api/restaurant'),
        apiRequest('/api/reports/summary'),
        apiRequest<MenuCategory[]>('/api/categories'),
        apiRequest<MenuItem[]>('/api/menu?include_unavailable=true'),
        apiRequest<RestaurantTable[]>('/api/tables'),
        apiRequest<Reservation[]>('/api/reservations'),
        apiRequest<InventoryItem[]>('/api/inventory'),
        apiRequest<UserStaff[]>('/api/staff'),
        apiRequest<Review[]>('/api/reviews/all'),
        apiRequest<AuditLog[]>('/api/reports/audit-logs'),
      ]);

      setRestaurant(restRes);
      setSummary(sumRes);
      setCategories(catRes);
      setMenuItems(menuRes);
      setTables(tblRes);
      setReservations(resRes);
      setInventory(invRes);
      setStaffList(staffRes);
      setReviews(revRes);
      setAuditLogs(auditRes);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  return (
    <div className="min-h-screen bg-[#F3F1ED] text-[#282321] flex flex-col font-sans">
      <header className="bg-[#641C24] text-white px-6 py-4 flex items-center justify-between shadow-md border-b border-[#C49A52]">
        <div className="flex items-center gap-4">
          <EkdantLogo size="sm" variant="light" showSubtitle={false} />
          <div className="border-l border-[#C49A52]/50 pl-4">
            <h1 className="text-base font-bold font-serif-royal">HOTEL EKDANT — OWNER ADMIN SUITE</h1>
            <p className="text-xs text-white/70">Proprietor Controls & Business Analytics</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/staff')}
            className="bg-[#C49A52] text-[#282321] font-bold px-3 py-1.5 rounded-lg text-xs cursor-pointer"
          >
            Staff Desk
          </button>
          <button onClick={logout} className="text-xs text-red-200 underline cursor-pointer">
            Logout
          </button>
        </div>
      </header>

      {/* Nav Tabs */}
      <div className="bg-white border-b border-gray-300 px-6 flex items-center gap-4 overflow-x-auto">
        {[
          { id: 'overview', label: 'Business Overview', icon: BarChart3 },
          { id: 'financial', label: 'Financial & P&L', icon: TrendingUp },
          { id: 'menu', label: 'Menu Catalog', icon: Utensils },
          { id: 'inventory', label: 'Inventory & Recipes', icon: Package },
          { id: 'reservations', label: 'Reservations', icon: CalendarCheck },
          { id: 'staff', label: 'Staff Accounts', icon: Users },
          { id: 'reviews', label: 'Reviews', icon: Star },
          { id: 'settings', label: 'GST & Settings', icon: Settings },
          { id: 'audit', label: 'Audit Trail', icon: ShieldAlert },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3.5 px-3 border-b-2 font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shrink-0 ${
                isActive ? 'border-[#641C24] text-[#641C24]' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <main className="max-w-7xl mx-auto w-full p-6 flex-1">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold font-serif-royal text-[#641C24]">Performance Analytics</h2>
                <p className="text-xs text-gray-500">Live generated from PAID invoices and sales records.</p>
              </div>
              <a
                href="/api/reports/export.xlsx"
                download
                className="bg-[#258451] hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Download Multi-Sheet Excel Sales Report</span>
              </a>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-gray-200">
                <span className="text-xs text-gray-500 uppercase font-semibold">Today's Revenue</span>
                <p className="text-3xl font-black text-[#641C24] mt-1">{formatINR(summary?.today_revenue || 0)}</p>
                <span className="text-[10px] text-gray-400">Paid Invoices</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-200">
                <span className="text-xs text-gray-500 uppercase font-semibold">Paid Invoices</span>
                <p className="text-3xl font-black text-gray-900 mt-1">{summary?.total_orders_today || 0}</p>
                <span className="text-[10px] text-emerald-600 font-bold">Synchronized</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-200">
                <span className="text-xs text-gray-500 uppercase font-semibold">Avg. Order Value</span>
                <p className="text-3xl font-black text-amber-700 mt-1">{formatINR(summary?.avg_order_value || 0)}</p>
                <span className="text-[10px] text-gray-400">Across All Sittings</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-200">
                <span className="text-xs text-gray-500 uppercase font-semibold">Pending Bookings</span>
                <p className="text-3xl font-black text-blue-700 mt-1">{summary?.pending_reservations || 0}</p>
                <span className="text-[10px] text-gray-400">Awaiting Confirmation</span>
              </div>
            </div>

            {summary?.weekly_sales && (
              <div className="bg-white p-6 rounded-2xl border border-gray-200">
                <h3 className="font-serif-royal font-bold text-base text-[#641C24] mb-4">Past 7 Days Sales Trend</h3>
                <div className="grid grid-cols-7 gap-2 items-end h-40 pt-6">
                  {summary.weekly_sales.map((day: any, i: number) => {
                    const maxRev = Math.max(...summary.weekly_sales.map((d: any) => d.revenue), 1000);
                    const barHeightPercent = Math.max(10, Math.min(100, (day.revenue / maxRev) * 100));
                    return (
                      <div key={i} className="flex flex-col items-center gap-2 h-full justify-end">
                        <span className="text-[10px] font-bold text-gray-700">{formatINR(day.revenue)}</span>
                        <div
                          style={{ height: `${barHeightPercent}%` }}
                          className="w-full bg-[#641C24] hover:bg-[#852D34] rounded-t-lg transition-all"
                        />
                        <span className="text-[11px] text-gray-500 font-medium">{day.date}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'financial' && <InternalFinancialTab />}
        {activeTab === 'menu' && <MenuTab menuItems={menuItems} categories={categories} onRefresh={fetchAdminData} />}
        {activeTab === 'inventory' && <InventoryTab inventory={inventory} onRefresh={fetchAdminData} />}
        {activeTab === 'reservations' && <ReservationsTab reservations={reservations} tables={tables} onRefresh={fetchAdminData} />}
        {activeTab === 'staff' && <StaffTab staffList={staffList} onRefresh={fetchAdminData} />}
        {activeTab === 'reviews' && <ReviewsTab reviews={reviews} onRefresh={fetchAdminData} />}
        {activeTab === 'settings' && <SettingsTab restaurant={restaurant} onRefresh={fetchAdminData} />}
        {activeTab === 'audit' && <AuditTab logs={auditLogs} />}
      </main>
    </div>
  );
};
