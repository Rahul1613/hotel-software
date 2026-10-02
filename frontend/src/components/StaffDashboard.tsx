import React, { useState, useEffect } from 'react';
import { EkdantLogo } from './EkdantLogo';
import { soundManager } from '../utils/soundManager';
import type { Order, RestaurantTable, ServiceRequest, UserStaff } from '../types';
import { 
  Bell, Volume2, VolumeX, CheckCircle, Clock, 
  ChefHat, Utensils, IndianRupee, RefreshCw, 
  CheckCheck, AlertTriangle, FileText, Printer, Eye 
} from 'lucide-react';

interface StaffDashboardProps {
  currentUser: UserStaff;
  onLogout: () => void;
  onOpenKitchenView: () => void;
  onOpenAdmin: () => void;
}

export const StaffDashboard: React.FC<StaffDashboardProps> = ({
  currentUser,
  onLogout,
  onOpenKitchenView,
  onOpenAdmin
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'tables' | 'requests'>('orders');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [soundActive, setSoundActive] = useState<boolean>(true);
  const [lastOrderCount, setLastOrderCount] = useState<number>(0);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);

  // Bill Generation modal state
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [isGeneratingBill, setIsGeneratingBill] = useState<boolean>(false);

  const fetchDashboardData = async () => {
    try {
      const [ordRes, tblRes, reqRes] = await Promise.all([
        fetch('/api/orders'),
        fetch('/api/tables'),
        fetch('/api/service-requests')
      ]);

      const [ordData, tblData, reqData] = await Promise.all([
        ordRes.json(),
        tblRes.json(),
        reqRes.json()
      ]);

      if (Array.isArray(ordData)) {
        if (lastOrderCount > 0 && ordData.length > lastOrderCount) {
          // Play loud chime
          soundManager.playNewOrderAlert();
        }
        setLastOrderCount(ordData.length);
        setOrders(ordData);
      }

      if (Array.isArray(tblData)) setTables(tblData);
      if (Array.isArray(reqData)) {
        if (reqData.length > 0) {
          // Play notification chime
          soundManager.playWaiterCallAlert();
        }
        setServiceRequests(reqData);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 3500);
    return () => clearInterval(interval);
  }, [lastOrderCount]);

  const handleToggleSound = () => {
    const next = !soundActive;
    setSoundActive(next);
    soundManager.setSoundEnabled(next);
    if (next) soundManager.enableAudio();
  };

  const handleUpdateOrderStatus = async (orderId: number, newStatus: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) fetchDashboardData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolveServiceRequest = async (id: number) => {
    try {
      await fetch('/api/service-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'RESOLVED' })
      });
      fetchDashboardData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!selectedInvoiceOrder) return;
    setIsGeneratingBill(true);

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: selectedInvoiceOrder.id,
          discount_amount: discountAmount,
          payment_method: paymentMethod,
          payment_status: 'PAID'
        })
      });
      const data = await res.json();
      if (res.ok) {
        // Open PDF in new tab
        window.open(`/api/invoices/${data.invoice_id}/pdf?format=A4`, '_blank');
        setSelectedInvoiceOrder(null);
        fetchDashboardData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingBill(false);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter(o => {
    if (statusFilter === 'ALL') return true;
    return o.status === statusFilter;
  });

  // Calculate live stats
  const activeOrdersCount = orders.filter(o => ['RECEIVED', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.status)).length;
  const todayRevenue = orders
    .filter(o => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + o.final_amount, 0);

  return (
    <div className="min-h-screen bg-[#F3F1ED] text-[#282321] flex flex-col">
      {/* Top Bar */}
      <header className="bg-[#641C24] text-[#FFF9F0] px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-md border-b border-[#C49A52]">
        <div className="flex items-center gap-4">
          <EkdantLogo size="sm" variant="light" showSubtitle={false} />
          <div className="border-l border-[#C49A52]/50 pl-4 hidden sm:block">
            <span className="text-xs uppercase tracking-wider text-[#C49A52] font-semibold">Live Staff & Order Desk</span>
            <p className="text-xs text-white/80">{currentUser.full_name} ({currentUser.role.toUpperCase()})</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button 
            onClick={handleToggleSound}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              soundActive ? 'bg-[#258451] text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            {soundActive ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{soundActive ? 'Sound Alerts ON' : 'Muted'}</span>
          </button>

          <button 
            onClick={onOpenKitchenView}
            className="bg-[#C49A52] hover:bg-[#D98B32] text-[#282321] font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
          >
            <ChefHat className="w-4 h-4" />
            <span className="hidden sm:inline">Kitchen Screen</span>
          </button>

          {['owner', 'manager', 'admin'].includes(currentUser.role) && (
            <button 
              onClick={onOpenAdmin}
              className="bg-white/10 hover:bg-white/20 text-white font-medium px-3 py-1.5 rounded-lg text-xs cursor-pointer"
            >
              Admin Panel
            </button>
          )}

          <button 
            onClick={onLogout}
            className="text-xs text-red-200 hover:text-white underline cursor-pointer ml-2"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 pt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] text-gray-500 font-bold uppercase">Pending Active Orders</span>
          <p className="text-2xl font-bold text-[#641C24]">{activeOrdersCount}</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] text-gray-500 font-bold uppercase">Today's Sales</span>
          <p className="text-2xl font-bold text-[#258451]">₹{todayRevenue.toFixed(0)}</p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] text-gray-500 font-bold uppercase">Active Tables</span>
          <p className="text-2xl font-bold text-amber-700">
            {tables.filter(t => t.status !== 'AVAILABLE').length} / 11
          </p>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] text-gray-500 font-bold uppercase">Waiter Calls</span>
          <p className="text-2xl font-bold text-rose-600">{serviceRequests.length}</p>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 pt-5">
        <div className="flex items-center justify-between border-b border-gray-300 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 font-bold text-sm rounded-xl cursor-pointer transition-all ${
                activeTab === 'orders' ? 'bg-[#641C24] text-white shadow-xs' : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              Orders ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab('tables')}
              className={`px-4 py-2 font-bold text-sm rounded-xl cursor-pointer transition-all ${
                activeTab === 'tables' ? 'bg-[#641C24] text-white shadow-xs' : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              11 Tables View
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`relative px-4 py-2 font-bold text-sm rounded-xl cursor-pointer transition-all ${
                activeTab === 'requests' ? 'bg-[#641C24] text-white shadow-xs' : 'text-gray-600 hover:bg-gray-200'
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
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-black cursor-pointer bg-white border border-gray-300 px-3 py-1.5 rounded-lg"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-5 flex-1">
        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div>
            {/* Status filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-4">
              {['ALL', 'RECEIVED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors ${
                    statusFilter === st 
                      ? 'bg-[#852D34] text-white' 
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Orders Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOrders.map(order => {
                const isNew = order.status === 'RECEIVED';
                return (
                  <div 
                    key={order.id}
                    className={`bg-white rounded-2xl p-4 border transition-all flex flex-col justify-between ${
                      isNew 
                        ? 'border-red-500 ring-2 ring-red-300 shadow-md animate-pulse-subtle' 
                        : 'border-gray-200 shadow-xs'
                    }`}
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-[#641C24] text-white text-xs font-bold px-2.5 py-1 rounded-lg">
                            Table {order.table_number}
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            {order.order_number}
                          </span>
                        </div>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          order.status === 'RECEIVED' ? 'bg-red-100 text-red-800' :
                          order.status === 'ACCEPTED' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'PREPARING' ? 'bg-amber-100 text-amber-800' :
                          order.status === 'READY' ? 'bg-emerald-100 text-emerald-800' :
                          order.status === 'SERVED' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status}
                        </span>
                      </div>

                      {/* Customer info */}
                      <p className="text-xs text-gray-600 mb-2">
                        Guest: <strong className="text-gray-800">{order.customer_name}</strong> {order.customer_phone ? `(${order.customer_phone})` : ''}
                      </p>

                      {/* Items */}
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
                            <span className="font-bold text-gray-700">₹{it.total_price.toFixed(0)}</span>
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
                        <span className="text-base text-[#641C24]">₹{order.final_amount.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Order Action Buttons */}
                    <div className="pt-2 border-t border-gray-100 space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {order.status === 'RECEIVED' && (
                          <>
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'ACCEPTED')}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg cursor-pointer"
                            >
                              Accept Order
                            </button>
                            <button
                              onClick={() => handleUpdateOrderStatus(order.id, 'CANCELLED')}
                              className="bg-red-100 hover:bg-red-200 text-red-700 font-bold py-2 rounded-lg cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {order.status !== 'CANCELLED' && (
                          <div className="col-span-2 flex justify-end pb-1">
                            <button
                              onClick={() => window.open(`/api/orders/${order.id}/kot/html`, '_blank')}
                              className="text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-2 py-1 rounded flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5 text-[#641C24]" />
                              <span>Print KOT Ticket</span>
                            </button>
                          </div>
                        )}

                        {order.status === 'ACCEPTED' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, 'PREPARING')}
                            className="col-span-2 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded-lg cursor-pointer flex items-center justify-center gap-1"
                          >
                            <ChefHat className="w-4 h-4" />
                            <span>Mark Cooking (Preparing)</span>
                          </button>
                        )}

                        {order.status === 'PREPARING' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, 'READY')}
                            className="col-span-2 bg-[#258451] hover:bg-emerald-800 text-white font-bold py-2 rounded-lg cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Utensils className="w-4 h-4" />
                            <span>Mark Food Ready</span>
                          </button>
                        )}

                        {order.status === 'READY' && (
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, 'SERVED')}
                            className="col-span-2 bg-purple-700 hover:bg-purple-800 text-white font-bold py-2 rounded-lg cursor-pointer flex items-center justify-center gap-1"
                          >
                            <CheckCheck className="w-4 h-4" />
                            <span>Mark Served to Table</span>
                          </button>
                        )}

                        {order.status === 'SERVED' && (
                          <button
                            onClick={() => setSelectedInvoiceOrder(order)}
                            className="col-span-2 bg-[#641C24] hover:bg-[#852D34] text-white font-bold py-2 rounded-lg cursor-pointer flex items-center justify-center gap-1"
                          >
                            <FileText className="w-4 h-4 text-[#C49A52]" />
                            <span>Generate Bill & GST Invoice</span>
                          </button>
                        )}

                        {order.status === 'COMPLETED' && (
                          <div className="col-span-2 flex items-center justify-between text-xs text-gray-500">
                            <span className="text-emerald-700 font-bold">Paid & Closed</span>
                            <button
                              onClick={() => setSelectedInvoiceOrder(order)}
                              className="text-[#641C24] underline font-semibold cursor-pointer"
                            >
                              Reprint Bill
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 11 TABLES VIEW */}
        {activeTab === 'tables' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {tables.map(tbl => {
              const statusColors = {
                AVAILABLE: 'border-emerald-300 bg-emerald-50/50 text-emerald-900',
                ORDERING: 'border-amber-300 bg-amber-50/50 text-amber-900',
                PREPARING: 'border-orange-300 bg-orange-50/50 text-orange-900',
                OCCUPIED: 'border-purple-300 bg-purple-50/50 text-purple-900',
                RESERVED: 'border-blue-300 bg-blue-50/50 text-blue-900',
                NEEDS_ATTENTION: 'border-red-400 bg-red-50 text-red-900',
              }[tbl.status] || 'border-gray-200 bg-white text-gray-800';

              return (
                <div 
                  key={tbl.id}
                  className={`rounded-2xl p-4 border-2 transition-all flex flex-col justify-between ${statusColors}`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-serif-royal font-bold text-lg">{tbl.name}</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 border border-gray-300 uppercase">
                        {tbl.section}
                      </span>
                    </div>

                    <p className="text-xs mb-3 font-semibold">
                      Status: <span className="underline">{tbl.status}</span>
                    </p>
                    <p className="text-[11px] text-gray-600 mb-2">Capacity: {tbl.capacity} Guests</p>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-black/10 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <a
                        href={`/menu?table=${tbl.table_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#641C24] font-bold underline flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> Open QR
                      </a>
                      <button
                        onClick={() => {
                          const newSt = tbl.status === 'AVAILABLE' ? 'OCCUPIED' : 'AVAILABLE';
                          fetch(`/api/tables/${tbl.id}/status`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: newSt })
                          }).then(() => fetchDashboardData());
                        }}
                        className="px-2 py-1 rounded bg-white font-bold border border-gray-300 text-[11px] cursor-pointer"
                      >
                        Toggle Status
                      </button>
                    </div>

                    {tbl.status !== 'AVAILABLE' && (
                      <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-black/5">
                        <button
                          onClick={async () => {
                            const dest = prompt(`Shift active dining orders from Table ${tbl.table_number} to which Table (e.g. 02, 06)?`);
                            if (dest) {
                              const res = await fetch('/api/tables/shift', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ from_table: tbl.table_number, to_table: dest })
                              });
                              const data = await res.json();
                              alert(data.message || data.error);
                              fetchDashboardData();
                            }
                          }}
                          className="bg-white/90 hover:bg-white text-gray-800 border border-gray-300 py-1 rounded font-bold text-[10px] cursor-pointer"
                        >
                          ⇄ Shift Table
                        </button>

                        <button
                          onClick={async () => {
                            const sec = prompt(`Merge another table into Table ${tbl.table_number} (e.g. enter table number to merge from):`);
                            if (sec) {
                              const res = await fetch('/api/tables/merge', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ primary_table: tbl.table_number, secondary_table: sec })
                              });
                              const data = await res.json();
                              alert(data.message || data.error);
                              fetchDashboardData();
                            }
                          }}
                          className="bg-white/90 hover:bg-white text-gray-800 border border-gray-300 py-1 rounded font-bold text-[10px] cursor-pointer"
                        >
                          ⇥ Merge Table
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SERVICE REQUESTS TAB */}
        {activeTab === 'requests' && (
          <div className="space-y-3">
            {serviceRequests.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-500 text-sm">
                No active waiter or service calls at the moment.
              </div>
            ) : (
              serviceRequests.map(req => (
                <div 
                  key={req.id}
                  className="bg-white rounded-2xl p-4 border-l-4 border-l-red-600 border border-gray-200 shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold">
                      <Bell className="w-5 h-5 animate-bounce" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-gray-900">
                        {req.table_name} — {req.request_type.replace('_', ' ')}
                      </h4>
                      <p className="text-xs text-gray-500">Requested at {req.created_at}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleResolveServiceRequest(req.id)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer"
                  >
                    Acknowledge & Clear
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* INVOICE & BILL GENERATION MODAL */}
      {selectedInvoiceOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#C49A52]/40 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h3 className="font-serif-royal font-bold text-lg text-[#641C24]">
                Generate Bill: Table {selectedInvoiceOrder.table_number}
              </h3>
              <button 
                onClick={() => setSelectedInvoiceOrder(null)}
                className="text-gray-400 hover:text-black font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#FFF9F0] p-3 rounded-xl border border-[#C49A52]/30 space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Items Subtotal:</span>
                <span className="font-semibold">₹{selectedInvoiceOrder.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>CGST (2.5%):</span>
                <span>₹{selectedInvoiceOrder.cgst_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST (2.5%):</span>
                <span>₹{selectedInvoiceOrder.sgst_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-[#C49A52]/30 text-[#641C24]">
                <span>Total Amount:</span>
                <span>₹{selectedInvoiceOrder.final_amount.toFixed(2)}</span>
              </div>
            </div>

            {/* Discount input */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Authorized Discount (₹)
              </label>
              <input 
                type="number"
                min="0"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#641C24]"
                placeholder="0"
              />
            </div>

            {/* Payment Received at Counter */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Payment Collected at Counter:
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#641C24] font-medium"
              >
                <option value="CASH">Counter Cash</option>
                <option value="UPI">Counter GPay / UPI QR Stand</option>
                <option value="CARD">Counter Card POS Machine</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={handleGenerateInvoice}
                disabled={isGeneratingBill}
                className="w-full bg-[#641C24] hover:bg-[#852D34] text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4 text-[#C49A52]" />
                <span>A4 Tax Invoice (PDF)</span>
              </button>

              <button
                onClick={async () => {
                  if (!selectedInvoiceOrder) return;
                  setIsGeneratingBill(true);
                  try {
                    const res = await fetch('/api/invoices', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        order_id: selectedInvoiceOrder.id,
                        discount_amount: discountAmount,
                        payment_method: paymentMethod,
                        payment_status: 'PAID'
                      })
                    });
                    const data = await res.json();
                    if (res.ok) {
                      window.open(`/api/invoices/${data.invoice_id}/receipt/html`, '_blank');
                      setSelectedInvoiceOrder(null);
                      fetchDashboardData();
                    }
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setIsGeneratingBill(false);
                  }
                }}
                disabled={isGeneratingBill}
                className="w-full bg-[#258451] hover:bg-emerald-800 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer shadow-md"
              >
                <Printer className="w-4 h-4 text-emerald-200" />
                <span>1-Click 80mm Thermal Bill</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
