import React, { useState, useEffect } from 'react';
import { EkdantLogo } from './EkdantLogo';
import type { UserStaff, RestaurantInfo, MenuItem, MenuCategory, RestaurantTable, Reservation, InventoryItem } from '../types';
import { 
  BarChart3, Utensils, Settings, 
  CalendarCheck, FileSpreadsheet, Plus, Edit, 
  Trash2, Download, QrCode, Package, AlertTriangle 
} from 'lucide-react';

interface AdminProps {
  currentUser: UserStaff;
  onLogout: () => void;
  onOpenStaffView: () => void;
}

export const AdminPanel: React.FC<AdminProps> = ({
  currentUser,
  onLogout,
  onOpenStaffView
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'menu' | 'tables' | 'inventory' | 'reservations' | 'settings'>('overview');
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // Item form modal
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemFormData, setItemFormData] = useState({
    name: '',
    marathi_name: '',
    category_id: 1,
    description: '',
    price: 250,
    is_veg: true,
    food_type: 'veg',
    spice_level: 'Medium',
    image_url: ''
  });

  const fetchAdminData = async () => {
    try {
      const [restRes, sumRes, catRes, menuRes, tblRes, resRes, invRes] = await Promise.all([
        fetch('/api/restaurant'),
        fetch('/api/reports/summary'),
        fetch('/api/categories'),
        fetch('/api/menu?include_unavailable=true'),
        fetch('/api/tables'),
        fetch('/api/reservations'),
        fetch('/api/inventory')
      ]);

      setRestaurant(await restRes.json());
      setSummary(await sumRes.json());
      setCategories(await catRes.json());
      setMenuItems(await menuRes.json());
      setTables(await tblRes.json());
      setReservations(await resRes.json());
      setInventory(await invRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await fetch(`/api/menu/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(itemFormData)
        });
      } else {
        await fetch('/api/menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(itemFormData)
        });
      }
      setIsItemModalOpen(false);
      setEditingItem(null);
      fetchAdminData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this menu dish?')) return;
    try {
      await fetch(`/api/menu/${id}`, { method: 'DELETE' });
      fetchAdminData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateRestaurantSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;
    try {
      await fetch('/api/restaurant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(restaurant)
      });
      alert('Restaurant settings and tax configuration saved successfully!');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F1ED] text-[#282321] flex flex-col font-sans">
      {/* Top Header */}
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
            onClick={onOpenStaffView}
            className="bg-[#C49A52] text-[#282321] font-bold px-3 py-1.5 rounded-lg text-xs cursor-pointer"
          >
            Switch to Staff Desk
          </button>
          <button 
            onClick={onLogout}
            className="text-xs text-red-200 underline cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Nav Tabs */}
      <div className="bg-white border-b border-gray-300 px-6 flex items-center gap-4 overflow-x-auto">
        {[
          { id: 'overview', label: 'Business Overview', icon: BarChart3 },
          { id: 'menu', label: 'Menu Catalog', icon: Utensils },
          { id: 'tables', label: '11 Tables & QR Stands', icon: QrCode },
          { id: 'inventory', label: 'Raw Inventory Stock', icon: Package },
          { id: 'reservations', label: 'Table Reservations', icon: CalendarCheck },
          { id: 'settings', label: 'Restaurant & GST Settings', icon: Settings },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3.5 px-3 border-b-2 font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shrink-0 ${
                isActive 
                  ? 'border-[#641C24] text-[#641C24]' 
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full p-6 flex-1">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold font-serif-royal text-[#641C24]">Performance Analytics</h2>
                <p className="text-xs text-gray-500">Live generated from SQLite / PostgreSQL database transactions</p>
              </div>
              <a
                href="/api/reports/export.xlsx"
                download
                className="bg-[#258451] hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Download Excel Sales Report (.xlsx)</span>
              </a>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                <span className="text-xs text-gray-500 uppercase font-semibold">Today's Revenue</span>
                <p className="text-3xl font-black text-[#641C24] mt-1">₹{summary?.today_revenue || 0}</p>
                <span className="text-[10px] text-gray-400">Inclusive of CGST & SGST</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                <span className="text-xs text-gray-500 uppercase font-semibold">Orders Completed</span>
                <p className="text-3xl font-black text-gray-900 mt-1">{summary?.total_orders_today || 0}</p>
                <span className="text-[10px] text-emerald-600 font-bold">Live synchronized</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                <span className="text-xs text-gray-500 uppercase font-semibold">Avg. Order Value (AOV)</span>
                <p className="text-3xl font-black text-amber-700 mt-1">₹{summary?.avg_order_value || 0}</p>
                <span className="text-[10px] text-gray-400">Across AC & Non-AC</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                <span className="text-xs text-gray-500 uppercase font-semibold">Pending Bookings</span>
                <p className="text-3xl font-black text-blue-700 mt-1">{summary?.pending_reservations || 0}</p>
                <span className="text-[10px] text-gray-400">Awaiting owner confirm</span>
              </div>
            </div>

            {/* Weekly Sales Chart visualization */}
            {summary?.weekly_sales && (
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs">
                <h3 className="font-serif-royal font-bold text-base text-[#641C24] mb-4">Past 7 Days Sales Trend</h3>
                <div className="grid grid-cols-7 gap-2 items-end h-40 pt-6">
                  {summary.weekly_sales.map((day: any, i: number) => {
                    const maxRev = Math.max(...summary.weekly_sales.map((d: any) => d.revenue), 1000);
                    const barHeightPercent = Math.max(10, Math.min(100, (day.revenue / maxRev) * 100));

                    return (
                      <div key={i} className="flex flex-col items-center gap-2 h-full justify-end">
                        <span className="text-[10px] font-bold text-gray-700">₹{day.revenue}</span>
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

        {/* MENU CATALOG TAB */}
        {activeTab === 'menu' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold font-serif-royal text-[#641C24]">Menu Dishes & Pricing</h2>
                <p className="text-xs text-gray-500">Edit prices, descriptions, spice levels or toggle availability</p>
              </div>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setItemFormData({
                    name: '',
                    marathi_name: '',
                    category_id: categories[0]?.id || 1,
                    description: '',
                    price: 250,
                    is_veg: true,
                    food_type: 'veg',
                    spice_level: 'Medium',
                    image_url: ''
                  });
                  setIsItemModalOpen(true);
                }}
                className="bg-[#641C24] hover:bg-[#852D34] text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4 text-[#C49A52]" />
                <span>Add New Food Item</span>
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FFF9F0] border-b border-gray-200 text-gray-700 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">Dish Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Price</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {menuItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50/70">
                      <td className="p-3">
                        <strong className="text-gray-900 block">{item.name}</strong>
                        {item.marathi_name && <span className="text-[11px] text-gray-500 font-marathi">{item.marathi_name}</span>}
                      </td>
                      <td className="p-3 text-gray-600">{item.category_name}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.is_veg ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {item.food_type}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-gray-900">₹{item.price.toFixed(2)}</td>
                      <td className="p-3">
                        <button
                          onClick={async () => {
                            await fetch(`/api/menu/${item.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ is_available: !item.is_available })
                            });
                            fetchAdminData();
                          }}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                            item.is_available 
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' 
                              : 'bg-red-100 text-red-800 hover:bg-red-200'
                          }`}
                        >
                          {item.is_available ? 'In Stock (Available)' : 'Out of Stock (Hidden)'}
                        </button>
                      </td>
                      <td className="p-3 text-right space-x-1">
                        <button
                          onClick={async () => {
                            await fetch(`/api/menu/${item.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ is_special: !item.is_special })
                            });
                            fetchAdminData();
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                            item.is_special ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-gray-100 text-gray-500'
                          }`}
                          title="Toggle Chef's Special"
                        >
                          {item.is_special ? '★ Special' : 'Standard'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setItemFormData({
                              name: item.name,
                              marathi_name: item.marathi_name || '',
                              category_id: item.category_id,
                              description: item.description || '',
                              price: item.price,
                              is_veg: item.is_veg,
                              food_type: item.food_type,
                              spice_level: item.spice_level,
                              image_url: item.image_url || ''
                            });
                            setIsItemModalOpen(true);
                          }}
                          className="p-1 hover:text-[#641C24] cursor-pointer"
                          title="Edit Item"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 hover:text-red-600 cursor-pointer"
                          title="Delete Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 11 TABLES & QR STANDS TAB */}
        {activeTab === 'tables' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold font-serif-royal text-[#641C24]">Table Stands & QR Management</h2>
              <p className="text-xs text-gray-500">Total 11 tables. Download branded vector QR codes for physical table stands.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {tables.map(tbl => (
                <div key={tbl.id} className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-serif-royal font-bold text-base text-[#641C24]">{tbl.name}</h3>
                      <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded font-bold uppercase">{tbl.section}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">Capacity: {tbl.capacity} Seats</p>

                    {/* QR Code Preview */}
                    <div className="bg-[#FFF9F0] p-3 rounded-xl border border-[#C49A52]/30 flex flex-col items-center">
                      <img 
                        src={`/api/tables/${tbl.table_number}/qr.png`} 
                        alt={`QR Code Table ${tbl.table_number}`}
                        className="w-32 h-auto rounded shadow-2xs mb-2"
                      />
                      <span className="text-[10px] text-gray-500 font-mono">hotel-ekdant.com/menu?table={tbl.table_number}</span>
                    </div>
                  </div>

                  <a
                    href={`/api/tables/${tbl.table_number}/qr.png`}
                    download={`Hotel_Ekdant_Table_${tbl.table_number}_QR.png`}
                    className="mt-4 w-full bg-[#641C24] hover:bg-[#852D34] text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5 text-[#C49A52]" />
                    <span>Download Stand QR</span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RESERVATIONS TAB */}
        {activeTab === 'reservations' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold font-serif-royal text-[#641C24]">Guest Table Reservations</h2>
              <p className="text-xs text-gray-500">Manage incoming booking requests from customer website and WhatsApp</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FFF9F0] border-b border-gray-200 text-gray-700 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">Reference #</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Date & Time</th>
                    <th className="p-3">Party Size</th>
                    <th className="p-3">Section</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reservations.map(res => (
                    <tr key={res.id} className="hover:bg-gray-50/70">
                      <td className="p-3 font-mono font-bold text-[#641C24]">{res.booking_reference}</td>
                      <td className="p-3">
                        <strong className="text-gray-900 block">{res.customer_name}</strong>
                        <span className="text-[11px] text-gray-500">{res.mobile_number}</span>
                      </td>
                      <td className="p-3 text-gray-700">{res.booking_date} at {res.preferred_time}</td>
                      <td className="p-3 font-bold">{res.guests_count} Guests</td>
                      <td className="p-3 uppercase font-semibold">{res.seating_preference}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          res.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800' :
                          res.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {res.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1">
                        {res.status === 'PENDING' && (
                          <>
                            <button
                              onClick={async () => {
                                await fetch(`/api/reservations/${res.id}/status`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: 'CONFIRMED' })
                                });
                                fetchAdminData();
                              }}
                              className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={async () => {
                                await fetch(`/api/reservations/${res.id}/status`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: 'REJECTED' })
                                });
                                fetchAdminData();
                              }}
                              className="px-2.5 py-1 bg-red-100 text-red-700 rounded text-[11px] font-bold cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RAW INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold font-serif-royal text-[#641C24]">Raw Material & Ingredient Inventory</h2>
                <p className="text-xs text-gray-500">Track daily stock of Chicken, Mutton, Paneer, Basmati Rice, and Ghee with low-stock warnings.</p>
              </div>
              <button
                onClick={fetchAdminData}
                className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer"
              >
                Refresh Stock
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {inventory.map(item => (
                <div 
                  key={item.id} 
                  className={`bg-white rounded-2xl p-4 border transition-all flex flex-col justify-between ${
                    item.is_low_stock 
                      ? 'border-red-400 bg-red-50/40 ring-1 ring-red-300' 
                      : 'border-gray-200 shadow-2xs'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <h3 className="font-bold text-sm text-gray-900">{item.name}</h3>
                        {item.marathi_name && <span className="font-marathi text-xs text-gray-500">{item.marathi_name}</span>}
                      </div>
                      <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded font-bold uppercase">{item.category}</span>
                    </div>

                    <div className="my-3">
                      <span className="text-2xl font-black text-[#641C24]">
                        {item.current_stock.toFixed(1)} <span className="text-xs font-semibold text-gray-600">{item.unit}</span>
                      </span>
                      {item.is_low_stock && (
                        <p className="text-[11px] text-red-700 font-bold flex items-center gap-1 mt-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Below Min Alert ({item.min_alert_threshold} {item.unit})
                        </p>
                      )}
                    </div>

                    {item.supplier_info && (
                      <p className="text-[10px] text-gray-500">Supplier: {item.supplier_info}</p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center gap-1.5">
                    <button
                      onClick={async () => {
                        const added = prompt(`Add stock to ${item.name} in ${item.unit}:`, "10");
                        if (added && !isNaN(Number(added))) {
                          await fetch('/api/inventory', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: item.id, add_stock: Number(added) })
                          });
                          fetchAdminData();
                        }
                      }}
                      className="flex-1 bg-[#641C24] hover:bg-[#852D34] text-white py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      + Restock
                    </button>
                    <button
                      onClick={async () => {
                        const setVal = prompt(`Set exact current physical stock for ${item.name} in ${item.unit}:`, item.current_stock.toString());
                        if (setVal && !isNaN(Number(setVal))) {
                          await fetch('/api/inventory', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: item.id, current_stock: Number(setVal) })
                          });
                          fetchAdminData();
                        }
                      }}
                      className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Audit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SETTINGS & GST TAB */}
        {activeTab === 'settings' && restaurant && (
          <form onSubmit={handleUpdateRestaurantSettings} className="bg-white rounded-3xl p-6 border border-gray-200 shadow-2xs max-w-2xl space-y-4">
            <h2 className="font-serif-royal font-bold text-xl text-[#641C24]">Restaurant & Legal GST Information</h2>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Restaurant Trade Name</label>
                <input 
                  type="text" 
                  value={restaurant.name}
                  onChange={(e) => setRestaurant({ ...restaurant, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">GSTIN Number</label>
                <input 
                  type="text" 
                  value={restaurant.gstin}
                  onChange={(e) => setRestaurant({ ...restaurant, gstin: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">CGST Rate (%)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={restaurant.cgst_rate}
                  onChange={(e) => setRestaurant({ ...restaurant, cgst_rate: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">SGST Rate (%)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={restaurant.sgst_rate}
                  onChange={(e) => setRestaurant({ ...restaurant, sgst_rate: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Official Phone</label>
                <input 
                  type="text" 
                  value={restaurant.phone}
                  onChange={(e) => setRestaurant({ ...restaurant, phone: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">WhatsApp Business</label>
                <input 
                  type="text" 
                  value={restaurant.whatsapp}
                  onChange={(e) => setRestaurant({ ...restaurant, whatsapp: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="block font-bold text-gray-700 mb-1">Registered Address</label>
              <textarea 
                rows={2}
                value={restaurant.address}
                onChange={(e) => setRestaurant({ ...restaurant, address: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs"
              />
            </div>

            <button
              type="submit"
              className="bg-[#641C24] hover:bg-[#852D34] text-white font-bold px-6 py-3 rounded-xl text-xs cursor-pointer shadow-md"
            >
              Save Configuration
            </button>
          </form>
        )}
      </main>

      {/* Item Create / Edit Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#C49A52]/40">
            <h3 className="font-serif-royal font-bold text-lg text-[#641C24] mb-4">
              {editingItem ? 'Edit Menu Dish' : 'Add New Menu Dish'}
            </h3>

            <form onSubmit={handleSaveItem} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">English Name</label>
                  <input 
                    type="text" 
                    required
                    value={itemFormData.name}
                    onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Marathi Name</label>
                  <input 
                    type="text" 
                    value={itemFormData.marathi_name}
                    onChange={(e) => setItemFormData({ ...itemFormData, marathi_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Category</label>
                  <select
                    value={itemFormData.category_id}
                    onChange={(e) => setItemFormData({ ...itemFormData, category_id: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Price (₹)</label>
                  <input 
                    type="number" 
                    required
                    value={itemFormData.price}
                    onChange={(e) => setItemFormData({ ...itemFormData, price: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Food Diet</label>
                  <select
                    value={itemFormData.food_type}
                    onChange={(e) => {
                      const ft = e.target.value;
                      setItemFormData({
                        ...itemFormData,
                        food_type: ft,
                        is_veg: ft === 'veg'
                      });
                    }}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2"
                  >
                    <option value="veg">Vegetarian</option>
                    <option value="chicken">Chicken</option>
                    <option value="mutton">Mutton</option>
                    <option value="fish">Fish</option>
                    <option value="egg">Egg</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Description</label>
                <textarea 
                  rows={2}
                  value={itemFormData.description}
                  onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Image URL</label>
                <input 
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={itemFormData.image_url}
                  onChange={(e) => setItemFormData({ ...itemFormData, image_url: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#641C24] text-white rounded-xl font-bold cursor-pointer"
                >
                  Save Dish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
