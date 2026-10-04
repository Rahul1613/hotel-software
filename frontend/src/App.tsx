import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

import { CustomerWelcome } from './components/CustomerWelcome';
import { DigitalMenu } from './components/DigitalMenu';
import { OrderTracking } from './components/OrderTracking';
import { TableBooking } from './components/TableBooking';
import { CustomerReviewsPage } from './components/CustomerReviewsPage';
import { StaffDashboard } from './components/StaffDashboard';
import { KitchenDisplaySystem } from './components/KitchenDisplaySystem';
import { AdminPanel } from './components/AdminPanel';
import { StaffLoginModal } from './components/StaffLoginModal';
import { CartCheckoutModal } from './components/CartCheckoutModal';
import { ActiveDiningBar } from './components/common/ActiveDiningBar';

import type { RestaurantInfo, MenuCategory, MenuItem, CartItem } from './types';
import { apiRequest, setTableSessionToken } from './api';
import type { Language } from './utils/i18n';

function AppContent() {
  const navigate = useNavigate();

  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('ekdant_language');
    if (saved === 'mr' || saved === 'en') return saved;
    return 'en'; // Primary default order/customer language is English
  });

  const handleToggleLanguage = () => {
    setLanguage(prev => {
      const next = prev === 'en' ? 'mr' : 'en';
      localStorage.setItem('ekdant_language', next);
      return next;
    });
  };

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('ekdant_language', lang);
  };

  // Load Table token or dev parameter on boot
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('t') || params.get('token');
    const tableParam = params.get('table') || params.get('tbl');

    const verifyTable = async () => {
      try {
        let url = '';
        if (tokenParam) {
          url = `/api/tables/verify?token=${tokenParam}`;
        } else if (tableParam) {
          url = `/api/tables/verify?table=${tableParam}`;
        }

        if (url) {
          const res = await apiRequest(url);
          setTableNumber(res.table_number);
          setTableSessionToken(res.table_session_token);
          localStorage.setItem('ekdant_active_table', res.table_number);
        }
      } catch (e) {
        console.warn('Table verify failed:', e);
      }
    };

    if (tokenParam || tableParam) {
      verifyTable();
    } else {
      const saved = localStorage.getItem('ekdant_active_table');
      if (saved) setTableNumber(saved);
    }

    // Parallel initial data load
    Promise.all([
      apiRequest<RestaurantInfo>('/api/restaurant'),
      apiRequest<MenuCategory[]>('/api/categories'),
      apiRequest<MenuItem[]>('/api/menu'),
    ]).then(([rest, cats, items]) => {
      setRestaurant(rest);
      setCategories(cats);
      setMenuItems(items);
    }).catch(err => console.error('Data load error:', err));
  }, []);

  const handleUpdateCartQty = (item: MenuItem, delta: number) => {
    setCart(prev => {
      const idx = prev.findIndex(ci => ci.item.id === item.id);
      if (idx === -1) {
        if (delta > 0) return [...prev, { item, quantity: 1, selected_addons: [] }];
        return prev;
      }
      const updated = [...prev];
      const nextQty = updated[idx].quantity + delta;
      if (nextQty <= 0) {
        updated.splice(idx, 1);
      } else {
        updated[idx].quantity = nextQty;
      }
      return updated;
    });
  };

  const handleRemoveCartItem = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleOrderSuccess = (orderData: any) => {
    if (orderData.order_token) {
      localStorage.setItem(`order_token_${orderData.order_id}`, orderData.order_token);
    }
    localStorage.setItem('ekdant_active_order_id', String(orderData.order_id));
    if (orderData.table_number) {
      localStorage.setItem('ekdant_active_table', orderData.table_number);
    }
    setCart([]);
    setIsCartOpen(false);
    navigate(`/track/${orderData.order_id}`);
  };

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <CustomerWelcome
              restaurant={restaurant}
              tableNumber={tableNumber}
              language={language}
              onToggleLanguage={handleToggleLanguage}
              onSelectTable={num => {
                setTableNumber(num);
                if (num) localStorage.setItem('ekdant_active_table', num);
                else localStorage.removeItem('ekdant_active_table');
              }}
            />
          }
        />
        <Route
          path="/menu"
          element={
            <DigitalMenu
              restaurant={restaurant}
              categories={categories}
              items={menuItems}
              cart={cart}
              tableNumber={tableNumber}
              language={language}
              onChangeLanguage={handleSetLanguage}
              onToggleLanguage={handleToggleLanguage}
              onAddToCart={(item, addons, custom) => handleUpdateCartQty(item, 1)}
              onUpdateCartQty={handleUpdateCartQty}
              onOpenCart={() => setIsCartOpen(true)}
              onBackToHome={() => navigate('/')}
              onRequestService={() => {}}
              onSelectTable={t => setTableNumber(t)}
            />
          }
        />
        <Route path="/track/:orderId" element={<OrderTracking language={language} onToggleLanguage={handleToggleLanguage} />} />
        <Route path="/book" element={<TableBooking restaurant={restaurant} onBack={() => navigate('/')} />} />
        <Route path="/reviews" element={<CustomerReviewsPage onBack={() => navigate('/')} />} />
        <Route path="/login" element={<StaffLoginModal />} />

        {/* Protected Staff & Admin Routes */}
        <Route
          path="/staff"
          element={
            <ProtectedRoute allowedRoles={['waiter', 'cashier', 'manager', 'owner']}>
              <StaffDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kitchen"
          element={
            <ProtectedRoute allowedRoles={['chef', 'manager', 'owner']}>
              <KitchenDisplaySystem />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['manager', 'owner']}>
              <AdminPanel />
            </ProtectedRoute>
          }
        />
      </Routes>

      {/* Cart Modal */}
      {isCartOpen && (
        <CartCheckoutModal
          restaurant={restaurant}
          tableNumber={tableNumber}
          language={language}
          cart={cart}
          onToggleLanguage={handleToggleLanguage}
          onUpdateCartQty={handleUpdateCartQty}
          onRemoveItem={handleRemoveCartItem}
          onCloseCart={() => setIsCartOpen(false)}
          onOrderSuccess={handleOrderSuccess}
          onSelectTable={t => setTableNumber(t)}
        />
      )}
      {/* Persistent Active Order & Running Bill Bar */}
      <ActiveDiningBar language={language} />
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
