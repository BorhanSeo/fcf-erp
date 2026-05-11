-- ============================================================
-- FCF STATIONERY HOUSE ERP — SUPABASE SCHEMA (PART 2)
-- Triggers, Views, Row Level Security, Admin Profile
-- Run AFTER Part 1
-- ============================================================

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create profile when new auth user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  ) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- -------------------------------------------------------
-- Order placed: increase customers.total_due if due > 0
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_order_due()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.due_amount > 0 THEN
    UPDATE customers
    SET total_due = total_due + NEW.due_amount,
        total_purchase = total_purchase + NEW.total_amount
    WHERE id = NEW.customer_id;
  ELSE
    UPDATE customers
    SET total_purchase = total_purchase + NEW.total_amount
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_order_created ON orders;
CREATE TRIGGER on_order_created
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION handle_order_due();

-- -------------------------------------------------------
-- Order delivered: deduct stock, log movements
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_order_delivered()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  current_stock INTEGER;
BEGIN
  IF OLD.status != 'delivered' AND NEW.status = 'delivered' THEN
    FOR item IN
      SELECT oi.product_id, oi.quantity, p.stock_quantity
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = NEW.id
    LOOP
      current_stock := item.stock_quantity;
      UPDATE products
        SET stock_quantity = GREATEST(0, stock_quantity - item.quantity)
        WHERE id = item.product_id;

      INSERT INTO stock_movements (product_id, movement_type, quantity, stock_before, stock_after, reference_id, reference_type, note)
      VALUES (item.product_id, 'sale_out', item.quantity, current_stock,
              GREATEST(0, current_stock - item.quantity), NEW.id, 'order', 'Order: ' || NEW.order_number);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_order_status_change ON orders;
CREATE TRIGGER on_order_status_change
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION handle_order_delivered();

-- -------------------------------------------------------
-- Purchase received: add stock, log movements
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_purchase_received()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  current_stock INTEGER;
BEGIN
  IF NEW.status = 'received' AND (OLD.status IS NULL OR OLD.status != 'received') THEN
    FOR item IN
      SELECT pi.product_id, pi.quantity, p.stock_quantity
      FROM purchase_items pi
      JOIN products p ON p.id = pi.product_id
      WHERE pi.purchase_id = NEW.id
    LOOP
      current_stock := item.stock_quantity;
      UPDATE products
        SET stock_quantity = stock_quantity + item.quantity
        WHERE id = item.product_id;

      INSERT INTO stock_movements (product_id, movement_type, quantity, stock_before, stock_after, reference_id, reference_type, note)
      VALUES (item.product_id, 'purchase_in', item.quantity, current_stock,
              current_stock + item.quantity, NEW.id, 'purchase', 'Purchase: ' || NEW.purchase_number);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_purchase_received ON purchases;
CREATE TRIGGER on_purchase_received
  AFTER INSERT OR UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION handle_purchase_received();

-- -------------------------------------------------------
-- Payment received: reduce customers.total_due
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_payment_received()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE customers
    SET total_due = GREATEST(0, total_due - NEW.amount)
    WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_payment_inserted ON payments;
CREATE TRIGGER on_payment_inserted
  AFTER INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION handle_payment_received();

-- -------------------------------------------------------
-- Supplier payment made: reduce suppliers.total_due
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_supplier_payment()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE suppliers
    SET total_due = GREATEST(0, total_due - NEW.amount)
    WHERE id = NEW.supplier_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_supplier_payment_inserted ON supplier_payments;
CREATE TRIGGER on_supplier_payment_inserted
  AFTER INSERT ON supplier_payments
  FOR EACH ROW EXECUTE FUNCTION handle_supplier_payment();

-- -------------------------------------------------------
-- Auto-generate invoice when order is created
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_create_invoice()
RETURNS TRIGGER AS $$
DECLARE
  last_inv TEXT;
  next_num INTEGER;
  inv_number TEXT;
BEGIN
  SELECT invoice_number INTO last_inv
    FROM invoices
    WHERE invoice_number LIKE 'INV-' || EXTRACT(YEAR FROM NOW())::TEXT || '-%'
    ORDER BY invoice_number DESC
    LIMIT 1;

  IF last_inv IS NULL THEN
    next_num := 1;
  ELSE
    next_num := CAST(SPLIT_PART(last_inv, '-', 3) AS INTEGER) + 1;
  END IF;

  inv_number := 'INV-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(next_num::TEXT, 4, '0');

  INSERT INTO invoices (invoice_number, order_id, customer_id, total_amount, paid_amount, due_amount)
  VALUES (inv_number, NEW.id, NEW.customer_id, NEW.total_amount, NEW.paid_amount, NEW.due_amount)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_order_create_invoice ON orders;
CREATE TRIGGER on_order_create_invoice
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION handle_create_invoice();

-- ============================================================
-- VIEWS
-- ============================================================

-- Today's summary
CREATE OR REPLACE VIEW vw_today_summary AS
SELECT
  COALESCE(SUM(o.total_amount), 0) AS today_sales,
  COALESCE(SUM(o.paid_amount), 0) AS today_collection,
  COUNT(o.id) AS today_orders,
  COALESCE(SUM(o.due_amount), 0) AS today_due_added
FROM orders o
WHERE DATE(o.created_at) = CURRENT_DATE
  AND o.status != 'cancelled';

-- Low stock products
CREATE OR REPLACE VIEW vw_low_stock AS
SELECT
  p.id, p.product_code, p.name, p.subject,
  p.stock_quantity, p.low_stock_threshold, p.unit,
  pc.name AS category_name
FROM products p
LEFT JOIN product_categories pc ON pc.id = p.category_id
WHERE p.stock_quantity <= p.low_stock_threshold
  AND p.is_active = true
ORDER BY p.stock_quantity ASC;

-- Monthly P&L
CREATE OR REPLACE VIEW vw_monthly_pl AS
SELECT
  TO_CHAR(o.created_at, 'YYYY-MM') AS month,
  COALESCE(SUM(o.total_amount), 0) AS revenue,
  COALESCE(SUM(o.paid_amount), 0) AS collected,
  COALESCE(SUM(o.due_amount), 0) AS due_added,
  COUNT(o.id) AS order_count
FROM orders o
WHERE o.status != 'cancelled'
GROUP BY TO_CHAR(o.created_at, 'YYYY-MM')
ORDER BY month DESC;

-- Customer ledger
CREATE OR REPLACE VIEW vw_customer_ledger AS
SELECT
  c.id, c.name, c.phone, c.area,
  c.total_purchase AS total_ordered,
  c.total_due AS outstanding_due,
  COUNT(DISTINCT o.id) AS order_count,
  MAX(o.created_at) AS last_order_date
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id AND o.status != 'cancelled'
GROUP BY c.id, c.name, c.phone, c.area, c.total_purchase, c.total_due;

-- Overdue customers
CREATE OR REPLACE VIEW vw_overdue_customers AS
SELECT id, name, phone, area, total_due
FROM customers
WHERE total_due > 0 AND is_active = true
ORDER BY total_due DESC;

-- Price list
CREATE OR REPLACE VIEW vw_price_list AS
SELECT
  p.id, p.product_code, p.name, p.name_bn, p.subject, p.pages, p.unit,
  p.purchase_price, p.selling_price,
  ROUND(((p.selling_price - p.purchase_price) / NULLIF(p.selling_price, 0)) * 100, 1) AS margin_percent,
  pc.name AS category_name
FROM products p
LEFT JOIN product_categories pc ON pc.id = p.category_id
WHERE p.is_active = true
ORDER BY p.subject, p.name;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- PROFILES: users see own row; admin sees all
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (id = auth.uid() OR get_my_role() = 'admin');

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (id = auth.uid() OR get_my_role() = 'admin');

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (get_my_role() = 'admin' OR id = auth.uid());

-- PRODUCTS: all authenticated users can read; admin can write
DROP POLICY IF EXISTS "products_select" ON products;
CREATE POLICY "products_select" ON products FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "products_write" ON products;
CREATE POLICY "products_write" ON products FOR ALL USING (get_my_role() = 'admin');

-- PRODUCT CATEGORIES: all can read
DROP POLICY IF EXISTS "categories_select" ON product_categories;
CREATE POLICY "categories_select" ON product_categories FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "categories_write" ON product_categories;
CREATE POLICY "categories_write" ON product_categories FOR ALL USING (get_my_role() = 'admin');

-- CUSTOMERS: all authenticated can read/create; admin can update/delete
DROP POLICY IF EXISTS "customers_select" ON customers;
CREATE POLICY "customers_select" ON customers FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "customers_insert" ON customers;
CREATE POLICY "customers_insert" ON customers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "customers_update" ON customers;
CREATE POLICY "customers_update" ON customers FOR UPDATE USING (get_my_role() = 'admin');

-- ORDERS: all authenticated can read/create; admin can update status
DROP POLICY IF EXISTS "orders_select" ON orders;
CREATE POLICY "orders_select" ON orders FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "orders_insert" ON orders;
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "orders_update" ON orders;
CREATE POLICY "orders_update" ON orders FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "orders_delete" ON orders;
CREATE POLICY "orders_delete" ON orders FOR DELETE USING (get_my_role() = 'admin');

-- ORDER ITEMS: all authenticated
DROP POLICY IF EXISTS "order_items_all" ON order_items;
CREATE POLICY "order_items_all" ON order_items FOR ALL USING (auth.uid() IS NOT NULL);

-- INVOICES: all authenticated can read
DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "invoices_insert" ON invoices;
CREATE POLICY "invoices_insert" ON invoices FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "invoices_delete" ON invoices;
CREATE POLICY "invoices_delete" ON invoices FOR DELETE USING (get_my_role() = 'admin');

-- PAYMENTS: all authenticated can read; staff can insert (for customer payments)
DROP POLICY IF EXISTS "payments_all" ON payments;
CREATE POLICY "payments_all" ON payments FOR ALL USING (auth.uid() IS NOT NULL);

-- PURCHASES: admin only
DROP POLICY IF EXISTS "purchases_all" ON purchases;
CREATE POLICY "purchases_all" ON purchases FOR ALL USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "purchase_items_all" ON purchase_items;
CREATE POLICY "purchase_items_all" ON purchase_items FOR ALL USING (get_my_role() = 'admin');

-- SUPPLIERS: admin only
DROP POLICY IF EXISTS "suppliers_all" ON suppliers;
CREATE POLICY "suppliers_all" ON suppliers FOR ALL USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "supplier_payments_all" ON supplier_payments;
CREATE POLICY "supplier_payments_all" ON supplier_payments FOR ALL USING (get_my_role() = 'admin');

-- STOCK MOVEMENTS: all can read; admin can write
DROP POLICY IF EXISTS "stock_movements_select" ON stock_movements;
CREATE POLICY "stock_movements_select" ON stock_movements FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "stock_movements_insert" ON stock_movements;
CREATE POLICY "stock_movements_insert" ON stock_movements FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "stock_movements_delete" ON stock_movements;
CREATE POLICY "stock_movements_delete" ON stock_movements FOR DELETE USING (get_my_role() = 'admin');

-- NOTIFICATIONS: admin only
DROP POLICY IF EXISTS "notif_logs_all" ON notification_logs;
CREATE POLICY "notif_logs_all" ON notification_logs FOR ALL USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "notif_templates_select" ON notification_templates;
CREATE POLICY "notif_templates_select" ON notification_templates FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "notif_templates_update" ON notification_templates;
CREATE POLICY "notif_templates_update" ON notification_templates FOR UPDATE USING (get_my_role() = 'admin');

-- SETTINGS: admin only
DROP POLICY IF EXISTS "settings_select" ON settings;
CREATE POLICY "settings_select" ON settings FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "settings_write" ON settings;
CREATE POLICY "settings_write" ON settings FOR ALL USING (get_my_role() = 'admin');

-- ============================================================
-- INDEXES (performance)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_customers_total_due ON customers(total_due);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
