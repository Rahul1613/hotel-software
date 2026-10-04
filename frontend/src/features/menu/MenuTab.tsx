import React, { useState } from 'react';
import type { MenuItem, MenuCategory } from '../../types';
import { formatINR } from '../../utils/money';
import { apiRequest } from '../../api';
import { Modal } from '../../components/common/Modal';
import { Plus, Edit, Trash2 } from 'lucide-react';

interface MenuTabProps {
  menuItems: MenuItem[];
  categories: MenuCategory[];
  onRefresh: () => void;
}

export const MenuTab: React.FC<MenuTabProps> = ({ menuItems, categories, onRefresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    marathi_name: '',
    category_id: categories[0]?.id || 1,
    description: '',
    price: 250,
    preparation_cost: 95,
    is_veg: true,
    food_type: 'veg',
    spice_level: 'Medium',
    image_url: '',
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await apiRequest(`/api/menu/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        await apiRequest('/api/menu', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Archive this menu item? (Soft delete)')) return;
    try {
      await apiRequest(`/api/menu/${id}`, { method: 'DELETE' });
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-serif-royal text-[#641C24]">Menu Catalog & Pricing</h2>
          <p className="text-xs text-gray-500">Edit prices, food prep costs, descriptions, spice levels, or soft delete items.</p>
        </div>
        <button
          onClick={() => {
            setEditingItem(null);
            setFormData({
              name: '',
              marathi_name: '',
              category_id: categories[0]?.id || 1,
              description: '',
              price: 250,
              preparation_cost: 95,
              is_veg: true,
              food_type: 'veg',
              spice_level: 'Medium',
              image_url: '',
            });
            setIsModalOpen(true);
          }}
          className="bg-[#641C24] hover:bg-[#852D34] text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#C49A52]" />
          <span>Add Food Dish</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#FFF9F0] border-b border-gray-200 text-gray-700 font-bold uppercase text-[10px]">
            <tr>
              <th className="p-3">Dish Name</th>
              <th className="p-3">Category</th>
              <th className="p-3">Diet</th>
              <th className="p-3">Sale Price</th>
              <th className="p-3">Prep Cost</th>
              <th className="p-3">Est. Margin</th>
              <th className="p-3">Availability</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {menuItems.map(item => {
              const prepCost = item.preparation_cost ?? 0;
              const margin = item.price > 0 ? Math.round(((item.price - prepCost) / item.price) * 100) : 0;
              return (
              <tr key={item.id} className="hover:bg-gray-50/70">
                <td className="p-3">
                  <strong className="text-gray-900 block">{item.name}</strong>
                  {item.marathi_name && <span className="text-[11px] text-gray-500 font-marathi">{item.marathi_name}</span>}
                </td>
                <td className="p-3 text-gray-600">{item.category_name}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${item.is_veg ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {item.food_type}
                  </span>
                </td>
                <td className="p-3 font-bold text-gray-900">{formatINR(item.price)}</td>
                <td className="p-3 text-gray-600">{formatINR(prepCost)}</td>
                <td className="p-3">
                  <span className={`font-semibold ${margin >= 40 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {margin}%
                  </span>
                </td>
                <td className="p-3">
                  <button
                    onClick={async () => {
                      await apiRequest(`/api/menu/${item.id}`, {
                        method: 'PUT',
                        body: JSON.stringify({ is_available: !item.is_available }),
                      });
                      onRefresh();
                    }}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer ${item.is_available ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}
                  >
                    {item.is_available ? 'Available' : 'Sold Out'}
                  </button>
                </td>
                <td className="p-3 text-right space-x-1">
                  <button
                    onClick={() => {
                      setEditingItem(item);
                      setFormData({
                        name: item.name,
                        marathi_name: item.marathi_name || '',
                        category_id: item.category_id,
                        description: item.description || '',
                        price: item.price,
                        preparation_cost: item.preparation_cost ?? Math.round(item.price * 0.38),
                        is_veg: item.is_veg,
                        food_type: item.food_type,
                        spice_level: item.spice_level,
                        image_url: item.image_url || '',
                      });
                      setIsModalOpen(true);
                    }}
                    className="p-1 hover:text-[#641C24] cursor-pointer"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Dish' : 'Add Dish'}>
        <form onSubmit={handleSave} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-gray-700 mb-1">English Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 rounded-xl p-2"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Marathi Name</label>
              <input
                type="text"
                value={formData.marathi_name}
                onChange={e => setFormData({ ...formData, marathi_name: e.target.value })}
                className="w-full border border-gray-300 rounded-xl p-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Category</label>
              <select
                value={formData.category_id}
                onChange={e => setFormData({ ...formData, category_id: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-xl p-2"
              >
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Sale Price (₹)</label>
              <input
                type="number"
                required
                value={formData.price}
                onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-xl p-2 font-bold text-[#641C24]"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Prep Cost (₹)</label>
              <input
                type="number"
                value={formData.preparation_cost}
                onChange={e => setFormData({ ...formData, preparation_cost: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-xl p-2 font-medium text-emerald-800"
                title="Estimated preparation/raw material cost for internal P&L"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Diet</label>
              <select
                value={formData.food_type}
                onChange={e => {
                  const ft = e.target.value;
                  setFormData({ ...formData, food_type: ft as any, is_veg: ft === 'veg' });
                }}
                className="w-full border border-gray-300 rounded-xl p-2"
              >
                <option value="veg">Veg</option>
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
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded-xl p-2"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#641C24] hover:bg-[#852D34] text-white font-bold py-2.5 rounded-xl cursor-pointer"
          >
            Save Dish
          </button>
        </form>
      </Modal>
    </div>
  );
};
