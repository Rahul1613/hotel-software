import React, { useState, useMemo } from 'react';
import { EkdantLogo } from './EkdantLogo';
import { FoodBadge } from './FoodBadge';
import type { MenuItem, MenuCategory, CartItem, RestaurantInfo } from '../types';
import { 
  Search, ShoppingBag, Plus, Minus, Flame, 
  Clock, X, Check, ArrowLeft, BellRing, Sparkles 
} from 'lucide-react';

import { translations, type Language } from '../utils/i18n';

interface MenuProps {
  restaurant: RestaurantInfo | null;
  tableNumber: string | null;
  categories: MenuCategory[];
  items: MenuItem[];
  cart: CartItem[];
  language?: Language;
  onChangeLanguage?: (lang: Language) => void;
  onToggleLanguage?: () => void;
  onAddToCart: (item: MenuItem, addons?: any[], customization?: string) => void;
  onUpdateCartQty: (item: MenuItem, delta: number) => void;
  onOpenCart: () => void;
  onBackToHome: () => void;
  onRequestService: (type: 'CALL_WAITER' | 'WATER_REQUEST' | 'BILL_REQUEST') => void;
  onRefreshMenu?: () => void;
  onSelectTable?: (tbl: string) => void;
}

export const DigitalMenu: React.FC<MenuProps> = ({
  restaurant,
  tableNumber,
  categories,
  items,
  cart,
  language = 'en',
  onChangeLanguage,
  onToggleLanguage,
  onAddToCart,
  onUpdateCartQty,
  onOpenCart,
  onBackToHome,
  onRequestService,
  onRefreshMenu,
  onSelectTable
}) => {
  const currentLang: Language = language || 'en';
  const t = translations[currentLang];
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [activeDietFilter, setActiveDietFilter] = useState<'all' | 'veg' | 'non_veg'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemDetail, setSelectedItemDetail] = useState<MenuItem | null>(null);

  // Detail Modal state
  const [modalSpice, setModalSpice] = useState<string>('Medium');
  const [modalCustomization, setModalCustomization] = useState<string>('');
  const [modalSelectedAddons, setModalSelectedAddons] = useState<number[]>([]);

  // Cart summary
  const totalCartCount = cart.reduce((sum, ci) => sum + ci.quantity, 0);
  const totalCartSubtotal = cart.reduce((sum, ci) => {
    const addonsTotal = ci.selected_addons.reduce((aSum, a) => aSum + a.price, 0);
    return sum + (ci.item.price + addonsTotal) * ci.quantity;
  }, 0);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(it => {
      // Category filter
      if (selectedCatId && it.category_id !== selectedCatId) return false;
      // Diet filter
      if (activeDietFilter === 'veg' && !it.is_veg) return false;
      if (activeDietFilter === 'non_veg' && it.is_veg) return false;
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = it.name.toLowerCase().includes(query);
        const matchesDesc = it.description?.toLowerCase().includes(query);
        const matchesMarathi = it.marathi_name?.includes(query);
        if (!matchesName && !matchesDesc && !matchesMarathi) return false;
      }
      return true;
    });
  }, [items, selectedCatId, activeDietFilter, searchQuery]);

  // Open item detail
  const handleOpenDetail = (item: MenuItem) => {
    setSelectedItemDetail(item);
    setModalSpice(item.spice_level);
    setModalCustomization('');
    setModalSelectedAddons([]);
  };

  const handleAddFromModal = () => {
    if (!selectedItemDetail) return;
    const addons = (selectedItemDetail.addons || []).filter(a => modalSelectedAddons.includes(a.id));
    onAddToCart(selectedItemDetail, addons, `${modalSpice ? modalSpice + ' spice; ' : ''}${modalCustomization}`);
    setSelectedItemDetail(null);
  };

  return (
    <div className="min-h-screen bg-[#FFF9F0] pb-28 text-[#282321]">
      {/* Sticky App Header */}
      <header className="sticky top-0 z-30 bg-[#FFF9F0]/95 backdrop-blur-md border-b border-[#C49A52]/30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBackToHome}
              className="p-1.5 rounded-lg hover:bg-[#641C24]/10 text-[#641C24] transition-colors cursor-pointer"
              title="Return to welcome"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <EkdantLogo size="sm" showSubtitle={false} />
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="flex bg-[#641C24]/10 rounded-lg p-0.5 border border-[#C49A52]/40 text-xs font-semibold">
              <button
                type="button"
                onClick={() => onChangeLanguage ? onChangeLanguage('en') : onToggleLanguage && onToggleLanguage()}
                className={`px-2.5 py-1 rounded cursor-pointer transition-all ${
                  currentLang === 'en' ? 'bg-[#641C24] text-white shadow-2xs font-bold' : 'text-[#641C24] hover:bg-white/60'
                }`}
              >
                ENG
              </button>
              <button
                type="button"
                onClick={() => onChangeLanguage ? onChangeLanguage('mr') : onToggleLanguage && onToggleLanguage()}
                className={`px-2.5 py-1 rounded cursor-pointer font-marathi transition-all ${
                  currentLang === 'mr' ? 'bg-[#641C24] text-white shadow-2xs font-bold' : 'text-[#641C24] hover:bg-white/60'
                }`}
              >
                मराठी
              </button>
            </div>

            {tableNumber ? (
              <span className="bg-[#641C24] text-[#FFF9F0] text-xs font-bold px-3 py-1.5 rounded-lg border border-[#C49A52] flex items-center gap-1 shadow-2xs">
                <span>T-{tableNumber}</span>
              </span>
            ) : onSelectTable ? (
              <button
                type="button"
                onClick={() => {
                  const input = window.prompt('Enter your Table Number (01 to 11):', '01');
                  if (input && input.trim()) onSelectTable(input.trim());
                }}
                className="bg-amber-100 hover:bg-amber-200 text-[#641C24] border border-[#C49A52] text-xs font-bold px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors shadow-2xs"
                title="Choose your table"
              >
                + Table
              </button>
            ) : null}
            <button 
              onClick={onOpenCart}
              className="relative p-2 rounded-xl bg-[#641C24] text-[#FFF9F0] hover:bg-[#852D34] transition-colors cursor-pointer shadow-sm"
              title="View Cart"
            >
              <ShoppingBag className="w-5 h-5" />
              {totalCartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#C49A52] text-[#282321] text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-scale">
                  {totalCartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="max-w-4xl mx-auto px-4 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder={t.search_placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white pl-10 pr-4 py-2 text-sm rounded-xl border border-gray-300 focus:outline-none focus:border-[#641C24] focus:ring-1 focus:ring-[#641C24] shadow-xs"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Veg / Non-Veg Diet Filter Bar */}
        <div className="max-w-4xl mx-auto px-4 pb-2 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveDietFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeDietFilter === 'all' 
                  ? 'bg-[#641C24] text-white shadow-xs' 
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {t.all_dishes}
            </button>
            <button
              onClick={() => setActiveDietFilter('veg')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeDietFilter === 'veg' 
                  ? 'bg-[#258451] text-white shadow-xs' 
                  : 'bg-white text-[#258451] border border-[#258451]/40 hover:bg-emerald-50'
              }`}
            >
              <FoodBadge isVeg={true} size="sm" />
              <span>{t.veg_only}</span>
            </button>
            <button
              onClick={() => setActiveDietFilter('non_veg')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeDietFilter === 'non_veg' 
                  ? 'bg-[#C83E3E] text-white shadow-xs' 
                  : 'bg-white text-[#C83E3E] border border-[#C83E3E]/40 hover:bg-rose-50'
              }`}
            >
              <FoodBadge isVeg={false} size="sm" />
              <span>{t.non_veg_only}</span>
            </button>
          </div>

          {/* Quick Waiter Call on Mobile */}
          {tableNumber && (
            <button 
              onClick={() => onRequestService('CALL_WAITER')}
              className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-[#852D34] bg-white border border-[#C49A52]/40 px-2.5 py-1 rounded-full hover:bg-amber-50 cursor-pointer"
            >
              <BellRing className="w-3 h-3 text-[#C49A52]" />
              <span>{t.call_waiter}</span>
            </button>
          )}
        </div>

        {/* Category Pills Horizon Scroll */}
        <div className="max-w-4xl mx-auto px-4 pb-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedCatId(null)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
              selectedCatId === null 
                ? 'bg-[#C49A52] text-[#282321] font-bold shadow-xs' 
                : 'bg-white/80 text-gray-700 hover:bg-white border border-gray-200'
            }`}
          >
            {t.all_categories}
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCatId(cat.id)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                selectedCatId === cat.id 
                  ? 'bg-[#641C24] text-[#FFF9F0] font-bold shadow-xs' 
                  : 'bg-white/80 text-gray-700 hover:bg-white border border-gray-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </header>

      {/* Main Dishes Listing */}
      <main className="max-w-4xl mx-auto px-4 pt-5">
        {items.length === 0 ? (
          <div className="text-center py-16 bg-white/75 rounded-3xl border border-[#C49A52]/30 mt-4 shadow-sm p-6">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-[#641C24] flex items-center justify-center mx-auto mb-3 animate-pulse">
              <Sparkles className="w-6 h-6 text-[#C49A52]" />
            </div>
            <h3 className="font-serif-royal font-bold text-lg text-[#641C24] mb-1">
              {currentLang === 'mr' ? 'हॉटेल एकदंत मेनू लोड होत आहे...' : 'Loading Hotel Ekdant Menu...'}
            </h3>
            <p className="text-gray-600 text-xs mb-4">
              {currentLang === 'mr' 
                ? 'किचन कॅटलॉगशी जोडले जात आहे. कृपया प्रतीक्षा करा किंवा खालील बटण दाबा.' 
                : 'Connecting to live kitchen catalog. If dishes do not load automatically, tap below.'}
            </p>
            {onRefreshMenu && (
              <button 
                onClick={onRefreshMenu}
                className="bg-[#641C24] hover:bg-[#852D34] text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md cursor-pointer transition-all active:scale-95 inline-flex items-center gap-2"
              >
                <span>🔄 Reload Menu (मेनू रीलोड करा)</span>
              </button>
            )}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-white/70 rounded-3xl border border-gray-200 mt-4 shadow-xs p-6">
            <p className="text-gray-700 font-medium text-sm mb-1">
              {currentLang === 'mr' ? 'या शोधाशी किंवा फिल्टरशी जुळणारे पदार्थ सापडले नाहीत.' : 'No dishes match your active search or diet filter.'}
            </p>
            <p className="text-gray-500 text-xs mb-4">
              {items.length} {currentLang === 'mr' ? 'पदार्थ उपलब्ध आहेत.' : 'dishes available in total catalog.'}
            </p>
            <button 
              onClick={() => { setSelectedCatId(null); setActiveDietFilter('all'); setSearchQuery(''); }}
              className="bg-[#C49A52] hover:bg-[#D98B32] text-[#282321] text-xs font-bold px-5 py-2.5 rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
            >
              Show All {items.length} Dishes / सर्व {items.length} पदार्थ दाखवा
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredItems.map(item => {
              const inCart = cart.find(ci => ci.item.id === item.id);
              const qty = inCart ? inCart.quantity : 0;

              return (
                <div 
                  key={item.id}
                  className="bg-white rounded-2xl p-3.5 border border-[#C49A52]/20 hover:border-[#C49A52]/60 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="flex gap-3">
                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <FoodBadge isVeg={item.is_veg} foodType={item.food_type} size="sm" />
                        {item.is_special && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                            <Sparkles className="w-2.5 h-2.5" /> Chef's Special
                          </span>
                        )}
                      </div>

                      <h3 
                        onClick={() => handleOpenDetail(item)}
                        className={`font-bold text-[#641C24] text-base leading-snug hover:underline cursor-pointer ${
                          currentLang === 'mr' ? 'font-marathi text-lg' : 'font-serif-royal'
                        }`}
                      >
                        {currentLang === 'mr' && item.marathi_name ? item.marathi_name : item.name}
                      </h3>
                      {currentLang === 'mr' ? (
                        <p className="text-xs text-gray-500 mb-1">{item.name}</p>
                      ) : (
                        item.marathi_name && <p className="font-marathi text-xs text-gray-500 mb-1">{item.marathi_name}</p>
                      )}

                      <p className="text-xs text-gray-600 line-clamp-2 mt-1 leading-relaxed">
                        {item.description}
                      </p>

                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        {item.spice_level && (
                          <span className="flex items-center gap-1 text-[11px] text-orange-700">
                            <Flame className="w-3 h-3" /> {item.spice_level}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[11px]">
                          <Clock className="w-3 h-3 text-gray-400" /> {item.preparation_time_mins}m
                        </span>
                      </div>
                    </div>

                    {/* Food Image */}
                    <div className="relative shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-gray-100">
                      <img 
                        src={item.image_url || 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=300&q=80'} 
                        alt={item.name}
                        loading="lazy"
                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => handleOpenDetail(item)}
                      />
                    </div>
                  </div>

                  {/* Price and Cart Button Action Row */}
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-bold text-[#282321]">₹{item.price.toFixed(0)}</span>
                      <span className="text-[10px] text-gray-400 font-normal">+ 5% GST</span>
                    </div>

                    {qty > 0 ? (
                      <div className="flex items-center bg-[#641C24] text-white rounded-lg px-2 py-1 gap-2 shadow-xs">
                        <button 
                          onClick={() => onUpdateCartQty(item, -1)}
                          className="p-1 hover:bg-black/20 rounded cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-bold text-xs min-w-4 text-center">{qty}</span>
                        <button 
                          onClick={() => onUpdateCartQty(item, 1)}
                          className="p-1 hover:bg-black/20 rounded cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleOpenDetail(item)}
                        className="bg-[#FFF9F0] hover:bg-[#641C24] text-[#641C24] hover:text-[#FFF9F0] border-2 border-[#641C24] font-semibold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>ADD</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar */}
      {totalCartCount > 0 && (
        <div className="fixed bottom-3 inset-x-0 z-40 px-4 max-w-lg mx-auto">
          <div className="bg-[#641C24] text-[#FFF9F0] rounded-2xl p-3.5 shadow-2xl border-2 border-[#C49A52] flex items-center justify-between animate-bounce-subtle">
            <div className="flex flex-col">
              <span className="text-[11px] text-[#C49A52] font-semibold tracking-wider uppercase">
                {totalCartCount} {currentLang === 'mr' ? 'पदार्थ' : `item${totalCartCount > 1 ? 's' : ''}`}
              </span>
              <span className="text-lg font-bold">₹{totalCartSubtotal.toFixed(2)}</span>
            </div>
            <button 
              onClick={onOpenCart}
              className="bg-[#C49A52] hover:bg-[#D98B32] text-[#282321] font-bold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 cursor-pointer shadow-md transition-colors"
            >
              <span>{t.view_cart}</span>
              <ShoppingBag className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Item Customization & Details Modal */}
      {selectedItemDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-[#FFF9F0] w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto p-5 shadow-2xl border border-[#C49A52]/40 relative">
            <button 
              onClick={() => setSelectedItemDetail(null)}
              className="absolute top-4 right-4 z-10 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Image */}
            <div className="relative -mx-5 -mt-5 h-48 bg-gray-200 overflow-hidden mb-4 rounded-t-3xl sm:rounded-t-3xl">
              <img 
                src={selectedItemDetail.image_url || 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80'} 
                alt={selectedItemDetail.name} 
                className="w-full h-full object-cover"
              />
              <div className="absolute top-4 left-4">
                <FoodBadge isVeg={selectedItemDetail.is_veg} foodType={selectedItemDetail.food_type} />
              </div>
            </div>

            <div className="flex items-baseline justify-between mb-1">
              <h2 className="font-serif-royal font-bold text-[#641C24] text-xl">
                {selectedItemDetail.name}
              </h2>
              <span className="text-xl font-bold text-[#282321]">
                ₹{selectedItemDetail.price.toFixed(2)}
              </span>
            </div>

            {selectedItemDetail.marathi_name && (
              <p className="font-marathi text-sm text-gray-500 mb-2">
                {selectedItemDetail.marathi_name}
              </p>
            )}

            <p className="text-xs text-gray-700 mb-4 leading-relaxed">
              {selectedItemDetail.description}
            </p>

            {/* Spice Level Selection */}
            <div className="mb-4 bg-white p-3 rounded-xl border border-gray-200">
              <label className="block text-xs font-bold text-gray-700 mb-2">
                Choose Spice Level:
              </label>
              <div className="grid grid-cols-4 gap-1.5 text-xs">
                {(['Mild', 'Medium', 'Spicy', 'Kolhapuri Tikhat'] as const).map(sp => (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => setModalSpice(sp)}
                    className={`py-1.5 px-1 rounded-lg font-medium text-center transition-all cursor-pointer text-[11px] ${
                      modalSpice === sp 
                        ? 'bg-[#641C24] text-white font-bold' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {sp}
                  </button>
                ))}
              </div>
            </div>

            {/* Addons if any */}
            {selectedItemDetail.addons && selectedItemDetail.addons.length > 0 && (
              <div className="mb-4 bg-white p-3 rounded-xl border border-gray-200">
                <label className="block text-xs font-bold text-gray-700 mb-2">
                  Optional Add-ons & Extra Portions:
                </label>
                <div className="space-y-2">
                  {selectedItemDetail.addons.map(ad => {
                    const isChecked = modalSelectedAddons.includes(ad.id);
                    return (
                      <div 
                        key={ad.id}
                        onClick={() => {
                          setModalSelectedAddons(prev => 
                            isChecked ? prev.filter(id => id !== ad.id) : [...prev, ad.id]
                          );
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                          isChecked ? 'border-[#641C24] bg-[#641C24]/5 font-semibold' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded flex items-center justify-center border ${isChecked ? 'bg-[#641C24] border-[#641C24] text-white' : 'border-gray-400'}`}>
                            {isChecked && <Check className="w-3 h-3" />}
                          </div>
                          <span>{ad.name}</span>
                        </div>
                        <span className="text-[#852D34] font-bold">+₹{ad.price.toFixed(0)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Special Instructions */}
            <div className="mb-5">
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Kitchen Instructions (Optional):
              </label>
              <input 
                type="text" 
                placeholder="e.g. Less oil, extra crispy, no garlic..."
                value={modalCustomization}
                onChange={(e) => setModalCustomization(e.target.value)}
                className="w-full bg-white px-3 py-2 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-[#641C24]"
              />
            </div>

            {/* Modal Add to Cart Button */}
            <button
              onClick={handleAddFromModal}
              className="w-full bg-[#641C24] hover:bg-[#852D34] text-[#FFF9F0] py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#C49A52]" />
              <span>{t.add_to_cart}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
