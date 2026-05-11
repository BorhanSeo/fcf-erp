-- ============================================================
-- FCF STATIONERY HOUSE ERP — SUPABASE SCHEMA (PART 1: TABLES)
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES (linked to Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. PRODUCT CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO product_categories (name) VALUES ('Standard'), ('Kidz') ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_bn TEXT,
  category_id UUID REFERENCES product_categories(id),
  subject TEXT,
  pages INTEGER,
  unit TEXT NOT NULL DEFAULT 'pcs',
  purchase_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FCF products seed data (13 products)
INSERT INTO products (product_code, name, name_bn, subject, pages, unit, purchase_price, selling_price, stock_quantity, category_id) VALUES
  -- FCF 124 Series (Standard)
  ('FCF-124-BN', 'FCF 124', 'এফসিএফ ১২৪', 'Bangla',    124, 'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Standard')),
  ('FCF-124-MT', 'FCF 124', 'এফসিএফ ১২৪', 'Math',      124, 'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Standard')),
  ('FCF-124-EN', 'FCF 124', 'এফসিএফ ১২৪', 'English',   124, 'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Standard')),

  -- FCF 84 Series (Standard)
  ('FCF-084-BN', 'FCF 84',  'এফসিএফ ৮৪',  'Bangla',    84,  'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Standard')),
  ('FCF-084-MT', 'FCF 84',  'এফসিএফ ৮৪',  'Math',      84,  'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Standard')),
  ('FCF-084-EN', 'FCF 84',  'এফসিএফ ৮৪',  'English',   84,  'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Standard')),

  -- FCF 56 Series (Standard)
  ('FCF-056-BN', 'FCF 56',  'এফসিএফ ৫৬',  'Bangla',    56,  'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Standard')),
  ('FCF-056-MT', 'FCF 56',  'এফসিএফ ৫৬',  'Math',      56,  'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Standard')),
  ('FCF-056-EN', 'FCF 56',  'এফসিএফ ৫৬',  'English',   56,  'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Standard')),

  -- FCF Kidz 124 Series (Kidz)
  ('FCF-K124-BN','FCF Kidz 124', 'এফসিএফ কিডজ ১২৪', 'Bangla',  124, 'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Kidz')),
  ('FCF-K124-MT','FCF Kidz 124', 'এফসিএফ কিডজ ১২৪', 'Math',    124, 'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Kidz')),
  ('FCF-K124-EN','FCF Kidz 124', 'এফসিএফ কিডজ ১২৪', 'English', 124, 'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Kidz')),

  -- FCF Kidz (Kidz — single)
  ('FCF-KIDZ',   'FCF Kidz',     'এফসিএফ কিডজ',       NULL,     NULL,'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Kidz'))
ON CONFLICT (product_code) DO NOTHING;

-- ============================================================
-- 4. CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  area TEXT,
  total_due NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_purchase NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. SUPPLIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT NOT NULL,
  address TEXT,
  total_due NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','delivered','cancelled')),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','due','partial')),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  note TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. ORDER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT UNIQUE NOT NULL,
  order_id UUID UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  total_amount NUMERIC(12,2) NOT NULL,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. PAYMENTS (customer payments received)
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_number TEXT UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','bkash','nagad','bank')),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. PURCHASES
-- ============================================================
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_number TEXT UNIQUE NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('pending','received','partial','returned')),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','due','partial')),
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. PURCHASE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  line_total NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 12. SUPPLIER PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS supplier_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_number TEXT UNIQUE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','bkash','nagad','bank')),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. STOCK MOVEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase_in','sale_out','manual_in','manual_out','return_out')),
  quantity INTEGER NOT NULL,
  stock_before INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  note TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 14. NOTIFICATION TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO notification_templates (type, name, body) VALUES
  ('order_confirm', 'অর্ডার নিশ্চিতকরণ', 'আস-সালামু আলাইকুম {{customer_name}} ভাই,

আপনার অর্ডার নিশ্চিত হয়েছে! 🎉

অর্ডার নং: {{order_number}}
মোট পরিমাণ: ৳{{total_amount}}
পরিশোধিত: ৳{{paid_amount}}
বাকি: ৳{{due_amount}}

ধন্যবাদ — FCF Stationery House'),
  ('due_reminder', 'বাকি রিমাইন্ডার', 'আস-সালামু আলাইকুম {{customer_name}} ভাই,

আপনার কাছে আমাদের মোট বাকি পাওনা: ৳{{due_amount}}

অনুগ্রহ করে শীঘ্রই পরিশোধ করুন।

ধন্যবাদ — FCF Stationery House'),
  ('invoice', 'ইনভয়েস বার্তা', 'আস-সালামু আলাইকুম {{customer_name}} ভাই,

আপনার ইনভয়েস প্রস্তুত হয়েছে।

ইনভয়েস নং: {{order_number}}
মোট: ৳{{total_amount}}

ধন্যবাদ — FCF Stationery House'),
  ('low_stock', 'কম স্টক সতর্কতা', 'সতর্কতা! ⚠️

পণ্য: {{product_name}}
বর্তমান স্টক: {{stock_quantity}} টি

স্টক দ্রুত শেষ হয়ে যাচ্ছে। ক্রয়ের ব্যবস্থা করুন।

— FCF ERP System')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 15. NOTIFICATION LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id),
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('sent','failed','pending')),
  message TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 16. SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO settings (key, value) VALUES
  ('company_name', 'FCF Stationery House'),
  ('company_phone', ''),
  ('company_address', 'Wholesale Stationery Dokan, Bangladesh'),
  ('company_email', ''),
  ('order_prefix', 'ORD'),
  ('invoice_prefix', 'INV'),
  ('purchase_prefix', 'PUR'),
  ('low_stock_threshold', '10'),
  ('whatsapp_enabled', 'false'),
  ('whatsapp_api_key', ''),
  ('whatsapp_from_number', ''),
  ('currency_symbol', '৳')
ON CONFLICT DO NOTHING;
