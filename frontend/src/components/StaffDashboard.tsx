import React, { useState, useEffect } from 'react';
import { EkdantLogo } from './EkdantLogo';
import { soundManager } from '../utils/soundManager';
import type { Order, RestaurantTable, ServiceRequest, MenuItem } from '../types';
import { apiRequest } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { OrderCard } from '../features/orders/OrderCard';
import { ManualOrderModal } from '../features/orders/ManualOrderModal';
import { BillModal } from '../features/billing/BillModal';
import { TableGrid } from '../features/tables/TableGrid';
import { printViaHiddenIframe } from '../utils/printer';
import { 
  Bell, Volume2, VolumeX, ChefHat, RefreshCw, 
  Printer, Plus, Wifi, WifiOff 
} from 'lucide-react';

export const StaffDashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'orders' | 'tables' | 'requests'>('orders');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  
  const [soundActive, setSoundActive] = useState<boolean>(true);
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(true);
  const [isManualOrderOpen, setIsManualOrderOpen] = useState<boolean>(false);
  const [selectedBillOrder, setSelectedBillOrder] = useState<Order | null>(null);

  const fetchDashboardData = async () => {
    try {
      const [ordData, tblData, reqData, menuData] = await Promise.all([
        apiRequest<Order[]>('/api/orders'),
        apiRequest<RestaurantTable[]>('/api/tables'),
        apiRequest<ServiceRequest[]>('/api/service-requests'),
        apiRequest<MenuItem[]>('/api/menu?include_unavailable=false'),
      ]);

      if (Array.isArray(ordData)) setOrders(ordData);
      if (Array.isArray(tblData)) setTables(tblData);
      if (Array.isArray(reqData)) setServiceRequests(reqData);
      if (Array.isArray(menuData)) setMenuItems(menuData);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // 25 second fallback poll only (no spammy 3s poll)
    const interval = setInterval(fetchDashboardData, 25000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateOrderStatus = async (orderId: number, newStatus: string) => {
    try {
      await apiRequest(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      fetchDashboardData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolveServiceRequest = async (id: number) => {
    try {
      await apiRequest(`/api/service-requests/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'RESOLVED' }),
      });
      fetchDashboardData();
    } catch (e) {
      console.error(e);
    }
  };

  const filteredOrders = orders.filter(o => statusFilter === 'ALL' || o.status === statusFilter);
  const activeOrdersCount = orders.filter(o => ['RECEIVED', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.status)).length;
  const todayRevenue = orders
    .filter(o => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + (o.final_amount || 0), 0);

  return (
    <div className="min-h-screen bg-[#F3F1ED] text-[#282321] flex flex-col font-sans">
      {/* Top Bar */}
      <header className="bg-[#641C24] text-[#FFF9F0] px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-md border-b border-[#C49A52]">
        <div className="flex items-center gap-4">
          <EkdantLogo size="sm" variant="light" showSubtitle={false} />
          <div className="border-l border-[#C49A52]/50 pl-4 hidden sm:block">
            <span className="text-xs uppercase tracking-wider text-[#C49A52] font-semibold">Staff & Billing Desk</span>
            <p className="text-xs text-white/80">{currentUser?.full_name} ({currentUser?.role.toUpperCase()})</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              const next = !soundActive;
              setSoundActive(next);
              soundManager.setSoundEnabled(next);
              if (next) soundManager.enableAudio();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              soundActive ? 'bg-[#258451] text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            {soundActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{soundActive ? 'Alerts ON' : 'Muted'}</span>
          </button>

          <button
            onClick={() => setIsManualOrderOpen(true)}
            className="bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#C49A52]" />
            <span>+ New Order</span>
          </button>

          <button
            onClick={() => navigate('/kitchen')}
            className="bg-[#C49A52] hover:bg-[#D98B32] text-[#282321] font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
          >
            <ChefHat className="w-4 h-4" />
            <span className="hidden sm:inline">Kitchen Screen</span>
          </button>

          {['owner', 'manager'].includes(currentUser?.role || '') && (
            <button
              onClick={() => navigate('/admin')}
              className="bg-white/10 hover:bg-white/20 text-white font-medium px-3 py-1.5 rounded-lg text-xs cursor-pointer"
            >
              Admin Panel
            </button>
          )}

          <button onClick={logout} className="text-xs text-red-200 hover:text-white underline cursor-pointer ml-2">
            Logout
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 pt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-gray-200">
          <span className="text-[11px] text-gray-500 font-bold uppercase">Pending Active Orders</span>
          <p className="text-2xl font-bold text-[#641C24]">{activeOrdersCount}</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-gray-200">
          <span className="text-[11px] text-gray-500 font-bold uppercase">Today's Sales</span>
          <p className="text-2xl font-bold text-[#258451]">₹{todayRevenue.toFixed(0)}</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-gray-200">
          <span className="text-[11px] text-gray-500 font-bold uppercase">Active Tables</span>
          <p className="text-2xl font-bold text-amber-700">
            {tables.filter(t => t.status !== 'AVAILABLE').length} / 11
          </p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-gray-200">
          <span className="text-[11px] text-gray-500 font-bold uppercase">Waiter Calls</span>
          <p className="text-2xl font-bold text-rose-600">{serviceRequests.length}</p>
        </div>
      </div>

      {/* Main Tab Bar */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 pt-5">
        <div className="flex items-center justify-between border-b border-gray-300 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 font-bold text-sm rounded-xl cursor-pointer ${
                activeTab === 'orders' ? 'bg-[#641C24] text-white' : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              Orders ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab('tables')}
              className={`px-4 py-2 font-bold text-sm rounded-xl cursor-pointer ${
                activeTab === 'tables' ? 'bg-[#641C24] text-white' : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              11 Tables View
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`relative px-4 py-2 font-bold text-sm rounded-xl cursor-pointer ${
                activeTab === 'requests' ? 'bg-[#641C24] text-white' : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>Service Calls</span>
              {serviceRequests.length > 0 && (
                <span className="ml-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse">
                  {serviceRequests.length}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={fetchDashboardData}
            className="flex items-center gap-1 text-xs text-gray-600 bg-white border border-gray-300 px-3 py-1.5 rounded-lg cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-5 flex-1">
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
              {['ALL', 'RECEIVED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer shrink-0 ${
                    statusFilter === st ? 'bg-[#852D34] text-white' : 'bg-white text-gray-700 border border-gray-300'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onUpdateStatus={handleUpdateOrderStatus}
                  onOpenBillModal={o => setSelectedBillOrder(o)}
                  onReprintBill={o => printViaHiddenIframe(`/api/orders/${o.id}/receipt/html`)}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tables' && (
          <TableGrid tables={tables} onRefresh={fetchDashboardData} />
        )}

        {activeTab === 'requests' && (
          <div className="space-y-3">
            {serviceRequests.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-500 text-sm">
                No active waiter or service calls at the moment.
              </div>
            ) : (
              serviceRequests.map(req => (
                <div key={req.id} className="bg-white rounded-2xl p-4 border-l-4 border-l-red-600 border border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-red-600 animate-bounce" />
                    <div>
                      <h4 className="font-bold text-sm text-gray-900">{req.table_name} — {req.request_type.replace('_', ' ')}</h4>
                      <p className="text-xs text-gray-500">Requested at {req.created_at}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleResolveServiceRequest(req.id)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      <ManualOrderModal
        isOpen={isManualOrderOpen}
        onClose={() => setIsManualOrderOpen(false)}
        onSuccess={fetchDashboardData}
        menuItems={menuItems}
      />

      <BillModal
        order={selectedBillOrder}
        isOpen={!!selectedBillOrder}
        onClose={() => setSelectedBillOrder(null)}
        onSuccess={fetchDashboardData}
      />
    </div>
  );
};
