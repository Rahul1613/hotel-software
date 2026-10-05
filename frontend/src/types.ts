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
  service_charge_enabled: boolean;
  discount_limit_cashier: number;
  invoice_prefix: string;
  upi_id: string;
  sound_alerts_enabled: boolean;
  takeaway_enabled: boolean;
}

export interface MenuItemAddon {
  id: number;
  name: string;
  price: number; // in rupees
  price_paise?: number;
}

export interface MenuItem {
  id: number;
  category_id: number;
  category_name: string;
  kitchen_station?: string;
  name: string;
  marathi_name?: string;
  description?: string;
  price: number; // in rupees
  price_paise: number;
  is_veg: boolean;
  food_type: 'veg' | 'chicken' | 'mutton' | 'fish' | 'egg';
  spice_level: 'Mild' | 'Medium' | 'Spicy' | 'Kolhapuri Tikhat';
  is_available: boolean;
  is_special: boolean;
  is_featured: boolean;
  image_url?: string;
  preparation_time_mins: number;
  preparation_cost?: number; // in rupees (visible only to owner/manager)
  addons?: MenuItemAddon[];
}

export interface MenuCategory {
  id: number;
  name: string;
  description?: string;
  kitchen_station?: string;
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
  kitchen_station?: string;
  customization?: string;
  selected_addons?: MenuItemAddon[];
  total_price: number;
  item_status: string;
}

export interface Order {
  id: number;
  order_number: string;
  table_id?: number | null;
  table_number?: string | null;
  table_name?: string;
  section?: string;
  session_id: number;
  order_type: 'DINE_IN' | 'TAKEAWAY';
  source: 'CUSTOMER_QR' | 'STAFF';
  customer_name: string;
  customer_phone?: string;
  status: 'RECEIVED' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'SERVED' | 'COMPLETED' | 'CANCELLED';
  special_instructions?: string;
  estimated_wait_minutes?: number;
  subtotal: number;
  subtotal_paise?: number;
  cgst_amount: number;
  sgst_amount: number;
  final_amount: number;
  final_amount_paise?: number;
  invoice_id?: number | null;
  invoice_number?: string | null;
  created_at: string;
  items: OrderItem[];
}

export interface RestaurantTable {
  id: number;
  table_number: string;
  name: string;
  section: 'AC' | 'NON_AC';
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'ORDERING' | 'PREPARING' | 'RESERVED' | 'NEEDS_ATTENTION' | 'DISABLED';
  manual_status_override?: string | null;
  is_active: boolean;
  active_session_id?: number | null;
  active_order_count: number;
  active_order_ids: number[];
}

export interface Invoice {
  id: number;
  invoice_number: string;
  financial_year: string;
  table_number?: string;
  customer_name: string;
  subtotal: number;
  discount_amount: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  round_off: number;
  final_payable: number;
  final_payable_paise: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
}

export interface Reservation {
  id: number;
  booking_reference: string;
  customer_name: string;
  mobile_number: string;
  reserved_for: string; // ISO datetime
  duration_minutes: number;
  guests_count: number;
  seating_preference: 'AC' | 'NON_AC';
  special_requests?: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  assigned_table_id?: number | null;
  assigned_table_name?: string | null;
  whatsapp_link?: string;
  created_at: string;
}

export interface ServiceRequest {
  id: number;
  table_id: number;
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
  manager_reply?: string;
  replied_at?: string;
  is_approved?: boolean;
  created_at: string;
}

export interface UserStaff {
  id: number;
  username: string;
  full_name: string;
  role: 'owner' | 'manager' | 'cashier' | 'waiter' | 'chef';
  phone?: string;
  is_active: boolean;
  must_change_password?: boolean;
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

export interface AuditLog {
  id: number;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_value?: any;
  new_value?: any;
  created_at: string;
}

// --- DUAL BILLING & INTERNAL MANAGEMENT TYPES ---

export interface InternalBillItem {
  item_name: string;
  quantity: number;
  selling_price_unit: number;
  selling_total: number;
  cost_price_unit: number;
  cost_total: number;
  gross_profit: number;
  margin_pct: number;
}

export interface InternalBillAdjustment {
  id: number;
  note_type: 'REMARK' | 'ADJUSTMENT' | 'REFUND' | 'CORRECTION';
  amount: number;
  reason: string;
  created_by: string;
  created_at: string;
}

export interface PrintHistoryEntry {
  print_type: string;
  printed_by: string;
  created_at: string;
}

export interface InternalBillData {
  invoice_number: string;
  table_number: string;
  customer_name: string;
  date: string;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  discount_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  final_payable: number;
  total_food_cost: number;
  gross_profit: number;
  profit_margin_pct: number;
  net_adjustments: number;
  net_profit: number;
  items: InternalBillItem[];
  adjustments: InternalBillAdjustment[];
  print_history: PrintHistoryEntry[];
}

export interface InternalFinancialReport {
  period: string;
  from: string;
  to: string;
  invoices_count: number;
  total_revenue: number;
  total_discount_given: number;
  total_cgst: number;
  total_sgst: number;
  total_tax: number;
  total_food_cost: number;
  gross_profit: number;
  profit_margin_pct: number;
  net_adjustments: number;
  net_profit: number;
  payment_breakdown: Record<string, number>;
}

