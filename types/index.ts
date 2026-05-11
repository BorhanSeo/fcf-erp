// ============================================================
// FCF Stationery House ERP — TypeScript Types
// Matching Supabase database schema exactly
// ============================================================

export type UserRole = "admin" | "staff";
export type OrderStatus = "pending" | "confirmed" | "delivered" | "cancelled";
export type PaymentMethod = "cash" | "due" | "partial" | "bkash" | "nagad" | "bank";
export type PurchaseStatus = "pending" | "received" | "returned" | "partial";
export type StockMovementType = "purchase_in" | "sale_out" | "manual_in" | "manual_out" | "return_out";
export type NotificationChannel = "whatsapp" | "sms";
export type NotificationStatus = "sent" | "failed" | "pending";
export type NotificationType = "order_confirm" | "invoice" | "due_reminder" | "low_stock" | "custom";

// ============================================================
// TABLE TYPES
// ============================================================

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductCategory {
  id: string;
  name: string; // Standard, Kidz
  created_at: string;
}

export interface Product {
  id: string;
  product_code: string; // e.g. FCF-124-BN
  name: string;
  name_bn: string | null;
  subject: string | null; // Bangla/Math/English/General
  category_id: string;
  category?: ProductCategory;
  pages: number | null;
  unit: string; // Dozen/Rim/Piece
  purchase_price: number;
  selling_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  area: string | null;
  total_due: number;
  total_purchase: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  company: string | null;
  phone: string;
  address: string | null;
  total_due: number; // what we owe them
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string; // ORD-YYYY-NNNN
  customer_id: string;
  customer?: Customer;
  status: OrderStatus;
  payment_method: PaymentMethod;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
  invoices?: Invoice[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product?: Product;
  quantity: number;
  unit_price: number;
  discount: number;
  line_total: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string; // INV-YYYY-NNNN
  order_id: string;
  order?: Order;
  created_at: string;
}

export interface Payment {
  id: string;
  payment_number: string; // PAY-YYYY-NNNN
  customer_id: string;
  customer?: Customer;
  amount: number;
  payment_method: string;
  payment_date: string;
  note: string | null;
  created_by: string;
  created_at: string;
}

export interface Purchase {
  id: string;
  purchase_number: string; // PUR-YYYY-NNNN
  supplier_id: string;
  supplier?: Supplier;
  status: PurchaseStatus;
  payment_method: PaymentMethod;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  purchase_date: string;
  note: string | null;
  created_by: string;
  created_at: string;
  purchase_items?: PurchaseItem[];
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  product?: Product;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface SupplierPayment {
  id: string;
  supplier_id: string;
  supplier?: Supplier;
  amount: number;
  payment_method: string;
  payment_date: string;
  note: string | null;
  created_by: string;
  created_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  product?: Product;
  movement_type: StockMovementType;
  quantity: number;
  stock_before: number;
  stock_after: number;
  reference_id: string | null;
  reference_type: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface NotificationLog {
  id: string;
  channel: NotificationChannel;
  recipient_phone: string;
  recipient_name: string | null;
  notification_type: NotificationType;
  message: string;
  status: NotificationStatus;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  body: string;
  variables: string[]; // e.g. ["customer_name", "due_amount"]
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id: string;
  key: string;
  value: string;
  label: string;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  expense_date: string;
  category: string;
  amount: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

// ============================================================
// VIEW TYPES
// ============================================================

export interface TodaySummary {
  today_sales: number;
  today_orders: number;
  today_collection: number;
}

export interface LowStockItem {
  id: string;
  product_code: string;
  name: string;
  subject: string | null;
  category: string;
  unit: string;
  stock_quantity: number;
  low_stock_threshold: number;
}

export interface MonthlyPL {
  month: string;
  year: number;
  revenue: number;
  purchase_cost: number;
  gross_profit: number;
}

export interface CustomerLedger {
  customer_id: string;
  name: string;
  phone: string;
  area: string | null;
  total_orders: number;
  total_purchase: number;
  total_paid: number;
  total_due: number;
}

export interface PriceListItem {
  id: string;
  product_code: string;
  name: string;
  subject: string | null;
  category: string;
  pages: number | null;
  unit: string;
  purchase_price: number;
  selling_price: number;
  margin_percent: number;
}

// ============================================================
// FORM TYPES
// ============================================================

export interface OrderItemForm {
  product_id: string;
  product?: Product;
  quantity: number;
  unit_price: number;
  discount: number;
  line_total: number;
}

export interface NewOrderForm {
  customer_id: string;
  items: OrderItemForm[];
  discount: number;
  payment_method: PaymentMethod;
  paid_amount: number;
  note: string;
}

export interface NewPurchaseForm {
  supplier_id: string;
  purchase_date: string;
  items: {
    product_id: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
  payment_method: PaymentMethod;
  paid_amount: number;
  note: string;
}

// ============================================================
// DATABASE TYPE (for Supabase client typing)
// ============================================================

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, "created_at" | "updated_at">; Update: Partial<Profile> };
      product_categories: { Row: ProductCategory; Insert: Omit<ProductCategory, "id" | "created_at">; Update: Partial<ProductCategory> };
      products: { Row: Product; Insert: Omit<Product, "id" | "created_at" | "updated_at">; Update: Partial<Product> };
      customers: { Row: Customer; Insert: Omit<Customer, "id" | "created_at" | "updated_at">; Update: Partial<Customer> };
      suppliers: { Row: Supplier; Insert: Omit<Supplier, "id" | "created_at" | "updated_at">; Update: Partial<Supplier> };
      orders: { Row: Order; Insert: Omit<Order, "id" | "created_at" | "updated_at">; Update: Partial<Order> };
      order_items: { Row: OrderItem; Insert: Omit<OrderItem, "id" | "created_at">; Update: Partial<OrderItem> };
      invoices: { Row: Invoice; Insert: Omit<Invoice, "id" | "created_at">; Update: Partial<Invoice> };
      payments: { Row: Payment; Insert: Omit<Payment, "id" | "created_at">; Update: Partial<Payment> };
      purchases: { Row: Purchase; Insert: Omit<Purchase, "id" | "created_at">; Update: Partial<Purchase> };
      purchase_items: { Row: PurchaseItem; Insert: Omit<PurchaseItem, "id" | "created_at">; Update: Partial<PurchaseItem> };
      supplier_payments: { Row: SupplierPayment; Insert: Omit<SupplierPayment, "id" | "created_at">; Update: Partial<SupplierPayment> };
      stock_movements: { Row: StockMovement; Insert: Omit<StockMovement, "id" | "created_at">; Update: Partial<StockMovement> };
      notification_logs: { Row: NotificationLog; Insert: Omit<NotificationLog, "id" | "created_at">; Update: Partial<NotificationLog> };
      notification_templates: { Row: NotificationTemplate; Insert: Omit<NotificationTemplate, "id" | "created_at" | "updated_at">; Update: Partial<NotificationTemplate> };
      settings: { Row: Settings; Insert: Omit<Settings, "id" | "created_at" | "updated_at">; Update: Partial<Settings> };
      expenses: { Row: Expense; Insert: Omit<Expense, "id" | "created_at">; Update: Partial<Expense> };
    };
    Views: {
      vw_today_summary: { Row: TodaySummary };
      vw_low_stock: { Row: LowStockItem };
      vw_monthly_pl: { Row: MonthlyPL };
      vw_customer_ledger: { Row: CustomerLedger };
      vw_overdue_customers: { Row: CustomerLedger };
      vw_price_list: { Row: PriceListItem };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
