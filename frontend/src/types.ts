export interface RestaurantInfo {
  id: number;
  name: string;
  tagline: string;
  address: string;
  phone: string;
  whatsapp: string;
  gstin: string;
  fssai: string;
  opening_hours: string;
  cgst_rate: number;
  sgst_rate: number;
  service_charge_rate: number;
  sound_alerts_enabled: boolean;
}

export interface MenuItemAddon {
  id: number;
  name: string;
  price: number;
}

export interface MenuItem {
  id: number;
  category_id: number;
  category_name: string;
  name: string;
  marathi_name?: string;
  description?: string;
  price: number;
  is_veg: boolean;
  food_type: 'veg' | 'chicken' | 'mutton' | 'fish' | 'egg';
  spice_level: 'Mild' | 'Medium' | 'Spicy' | 'Kolhapuri Tikhat';
  is_available: boolean;
  is_special: boolean;
  is_featured: boolean;
  image_url?: string;
  preparation_time_mins: number;
  addons?: MenuItemAddon[];
}

export interface MenuCategory {
  id: number;
  name: string;
  description?: string;
  is_veg_category: boolean;
  is_non_veg_category: boolean;
  display_order: number;
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
  selected_addons: MenuItemAddon[];
  customization?: string;
}

export interface OrderItem {
  id: number;
  item_id: number;
  item_name: string;
  price: number;
  quantity: number;
  is_veg: boolean;
  customization?: string;
  selected_addons?: MenuItemAddon[];
  total_price: number;
  item_status: string;
}

export interface Order {
  id: number;
  order_number: string;
  table_id: number;
  table_number: string;
  table_name: string;
  section: string;
  customer_name: string;
  customer_phone?: string;
  status: 'RECEIVED' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'SERVED' | 'COMPLETED' | 'CANCELLED';
  special_instructions?: string;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  cgst_amount: number;
  sgst_amount: number;
  final_amount: number;
  created_at: string;
  items: OrderItem[];
}

export interface RestaurantTable {
  id: number;
  table_number: string;
  name: string;
  section: 'AC' | 'NON_AC';
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'ORDERING' | 'PREPARING' | 'RESERVED' | 'NEEDS_ATTENTION';
  qr_code_token: string;
  is_active: boolean;
  active_order_count: number;
  active_order_ids: number[];
}

export interface Reservation {
  id: number;
  booking_reference: string;
  customer_name: string;
  mobile_number: string;
  booking_date: string;
  preferred_time: string;
  guests_count: number;
  seating_preference: 'AC' | 'NON_AC';
  special_requests?: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
  assigned_table?: string;
}

export interface ServiceRequest {
  id: number;
  table_number: string;
  table_name: string;
  request_type: 'CALL_WAITER' | 'WATER_REQUEST' | 'BILL_REQUEST' | 'CLEANING';
  status: 'PENDING' | 'ACKNOWLEDGED' | 'RESOLVED';
  created_at: string;
}

export interface Review {
  id: number;
  customer_name: string;
  rating: number;
  food_rating: number;
  service_rating: number;
  cleanliness_rating: number;
  comment?: string;
  reply?: string;
  created_at: string;
}

export interface UserStaff {
  id: number;
  username: string;
  full_name: string;
  role: 'owner' | 'manager' | 'waiter' | 'chef' | 'cook' | 'admin' | 'cashier';
  phone?: string;
  is_active: boolean;
}

export interface InventoryItem {
  id: number;
  name: string;
  marathi_name?: string;
  category: string;
  current_stock: number;
  unit: string;
  min_alert_threshold: number;
  is_low_stock: boolean;
  supplier_info?: string;
  last_restocked: string;
}
