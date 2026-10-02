import React, { useState, useEffect } from 'react';
import type { RestaurantInfo, MenuItem, MenuCategory, CartItem, UserStaff } from './types';
import { CustomerWelcome } from './components/CustomerWelcome';
import { DigitalMenu } from './components/DigitalMenu';
import { CartCheckoutModal } from './components/CartCheckoutModal';
import { OrderTracking } from './components/OrderTracking';
import { TableBooking } from './components/TableBooking';
import { StaffDashboard } from './components/StaffDashboard';
import { KitchenDisplaySystem } from './components/KitchenDisplaySystem';
import { AdminPanel } from './components/AdminPanel';
import { StaffLoginModal } from './components/StaffLoginModal';
import { CustomerReviewsPage } from './components/CustomerReviewsPage';

export const App: React.FC = () => {
  // Navigation View State
  const [currentView, setCurrentView] = useState<'welcome' | 'menu' | 'tracking' | 'booking' | 'reviews' | 'staff' | 'kitchen' | 'admin'>('welcome');
  
  // Table identifier extracted from URL query or persisted localStorage
  const [tableNumber, setTableNumber] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const tblParam = params.get('table') || params.get('tbl') || params.get('t');
    if (tblParam) {
      const formatted = tblParam.padStart(2, '0');
      try { localStorage.setItem('ekdant_active_table', formatted); } catch {}
      return formatted;
    }
    try {
      return localStorage.getItem('ekdant_active_table') || null;
    } catch {
      return null;
    }
  });

  const handleSelectTable = (tbl: string | null) => {
    if (tbl) {
      const formatted = tbl.padStart(2, '0');
      setTableNumber(formatted);
      try { localStorage.setItem('ekdant_active_table', formatted); } catch {}
    } else {
      setTableNumber(null);
      try { localStorage.removeItem('ekdant_active_table'); } catch {}
    }
  };

  // App core state
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);

  // Auth state initialized from localStorage
  const [currentUser, setCurrentUser] = useState<UserStaff | null>(() => {
    try {
      const saved = localStorage.getItem('ekdant_staff_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // PWA standalone installation listener
  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Detect table from URL param or direct route on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tblParam = params.get('table') || params.get('tbl') || params.get('t');
    if (tblParam) {
      const formatted = tblParam.padStart(2, '0');
      handleSelectTable(formatted);
      setCurrentView('welcome');
    }

    // Direct routing support e.g. pathname /staff, /admin, /kitchen, /login
    const path = window.location.pathname.toLowerCase();
    const savedUser = localStorage.getItem('ekdant_staff_user');

    if (path.includes('staff')) {
      setCurrentView('staff');
      if (!savedUser) setIsLoginModalOpen(true);
    } else if (path.includes('kitchen')) {
      setCurrentView('kitchen');
    } else if (path.includes('admin')) {
      setCurrentView('admin');
      if (!savedUser) setIsLoginModalOpen(true);
    } else if (path.includes('login')) {
      setIsLoginModalOpen(true);
    }
  }, []);

  // Fetch initial restaurant info, categories and menu items
  const fetchData = async () => {
    try {
      const [restRes, catRes, menuRes] = await Promise.all([
        fetch('/api/restaurant'),
        fetch('/api/categories'),
        fetch('/api/menu')
      ]);
      if (restRes.ok) setRestaurant(await restRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (menuRes.ok) {
        const data = await menuRes.json();
        if (Array.isArray(data)) setMenuItems(data);
      }
    } catch (err) {
      console.error('Failed to fetch restaurant data', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Cart operations
  const handleAddToCart = (item: MenuItem, addons: any[] = [], customization?: string) => {
    setCart(prev => {
      const existingIdx = prev.findIndex(ci => ci.item.id === item.id);
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx].quantity += 1;
        return updated;
      } else {
        return [...prev, { item, quantity: 1, selected_addons: addons, customization }];
      }
    });
  };

  const handleUpdateCartQty = (item: MenuItem, delta: number) => {
    setCart(prev => {
      const existingIdx = prev.findIndex(ci => ci.item.id === item.id);
      if (existingIdx === -1) return prev;
      const updated = [...prev];
      const newQty = updated[existingIdx].quantity + delta;
      if (newQty <= 0) {
        updated.splice(existingIdx, 1);
      } else {
        updated[existingIdx].quantity = newQty;
      }
      return updated;
    });
  };

  const handleRemoveCartIndex = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleOrderSuccess = (orderData: any) => {
    setActiveOrderId(orderData.order_id);
    setCart([]);
    setIsCartOpen(false);
    setCurrentView('tracking');
  };

  const handleRequestService = async (type: 'CALL_WAITER' | 'WATER_REQUEST' | 'BILL_REQUEST') => {
    if (!tableNumber) return;
    try {
      await fetch('/api/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_number: tableNumber,
          request_type: type
        })
      });
      alert(`Staff notified! A waiter will attend Table ${tableNumber} shortly.`);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF9F0] text-[#282321] selection:bg-[#C49A52] selection:text-white">
      {/* Quick Staff & App Controls */}
      <div className="fixed top-2 right-2 z-50 flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
        {deferredPrompt && (
          <button
            onClick={() => {
              deferredPrompt.prompt();
              deferredPrompt.userChoice.then((choice: any) => {
                if (choice.outcome === 'accepted') setDeferredPrompt(null);
              });
            }}
            className="bg-[#258451] hover:bg-emerald-800 text-white text-[10px] font-bold px-2.5 py-1 rounded-md shadow flex items-center gap-1 cursor-pointer"
          >
            <span>📥 Install App</span>
          </button>
        )}
        <button
          onClick={() => {
            if (!currentUser) setIsLoginModalOpen(true);
            else setCurrentView('staff');
          }}
          className="bg-black/80 hover:bg-black text-white text-[10px] font-bold px-2 py-1 rounded shadow cursor-pointer"
        >
          {currentUser ? `${currentUser.role.toUpperCase()} Desk` : 'Staff Login'}
        </button>
      </div>

      {/* VIEW ROUTING */}
      {currentView === 'welcome' && (
        <CustomerWelcome 
          restaurant={restaurant}
          tableNumber={tableNumber}
          onViewMenu={() => {
            fetchData();
            setCurrentView('menu');
          }}
          onBookTable={() => setCurrentView('booking')}
          onCallWaiter={() => handleRequestService('CALL_WAITER')}
          onViewReviews={() => setCurrentView('reviews')}
          onOpenStaffLogin={() => setIsLoginModalOpen(true)}
          onSelectTable={handleSelectTable}
        />
      )}

      {currentView === 'reviews' && (
        <CustomerReviewsPage 
          onBack={() => setCurrentView('welcome')}
        />
      )}

      {currentView === 'menu' && (
        <DigitalMenu 
          restaurant={restaurant}
          tableNumber={tableNumber}
          categories={categories}
          items={menuItems}
          cart={cart}
          onAddToCart={handleAddToCart}
          onUpdateCartQty={handleUpdateCartQty}
          onOpenCart={() => setIsCartOpen(true)}
          onBackToHome={() => setCurrentView('welcome')}
          onRequestService={handleRequestService}
          onRefreshMenu={fetchData}
          onSelectTable={handleSelectTable}
        />
      )}

      {currentView === 'tracking' && activeOrderId && (
        <OrderTracking 
          orderId={activeOrderId}
          onOrderMore={() => setCurrentView('menu')}
          onRequestService={handleRequestService}
        />
      )}

      {currentView === 'booking' && (
        <TableBooking 
          restaurant={restaurant}
          onBack={() => setCurrentView('welcome')}
        />
      )}

      {currentView === 'staff' && (
        currentUser ? (
          <StaffDashboard 
            currentUser={currentUser}
            onLogout={() => { 
              localStorage.removeItem('ekdant_staff_user');
              setCurrentUser(null); 
              setCurrentView('welcome'); 
            }}
            onOpenKitchenView={() => setCurrentView('kitchen')}
            onOpenAdmin={() => setCurrentView('admin')}
          />
        ) : (
          <StaffLoginModal 
            onLoginSuccess={(user) => {
              setCurrentUser(user);
              if (['chef', 'cook'].includes(user.role)) {
                setCurrentView('kitchen');
              } else if (user.role === 'admin') {
                setCurrentView('admin');
              } else {
                setCurrentView('staff');
              }
            }}
            onCancel={() => setCurrentView('welcome')}
          />
        )
      )}

      {currentView === 'kitchen' && (
        <KitchenDisplaySystem 
          onBack={() => setCurrentView(currentUser ? 'staff' : 'welcome')}
        />
      )}

      {currentView === 'admin' && (
        currentUser ? (
          <AdminPanel 
            currentUser={currentUser}
            onLogout={() => { 
              localStorage.removeItem('ekdant_staff_user');
              setCurrentUser(null); 
              setCurrentView('welcome'); 
            }}
            onOpenStaffView={() => setCurrentView('staff')}
          />
        ) : (
          <StaffLoginModal 
            onLoginSuccess={(user) => {
              setCurrentUser(user);
              setCurrentView('admin');
            }}
            onCancel={() => setCurrentView('welcome')}
          />
        )
      )}

      {/* MODALS */}
      {isCartOpen && (
        <CartCheckoutModal 
          restaurant={restaurant}
          tableNumber={tableNumber}
          cart={cart}
          onUpdateCartQty={handleUpdateCartQty}
          onRemoveItem={handleRemoveCartIndex}
          onCloseCart={() => setIsCartOpen(false)}
          onOrderSuccess={handleOrderSuccess}
          onSelectTable={handleSelectTable}
        />
      )}

      {isLoginModalOpen && (
        <StaffLoginModal 
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            setIsLoginModalOpen(false);
            if (['chef', 'cook'].includes(user.role)) {
              setCurrentView('kitchen');
            } else if (user.role === 'admin') {
              setCurrentView('admin');
            } else {
              setCurrentView('staff');
            }
          }}
          onCancel={() => setIsLoginModalOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
