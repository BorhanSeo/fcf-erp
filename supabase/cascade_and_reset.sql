-- ============================================================
-- FCF ERP — CASCADE DELETE FIX + FULL RESET SCRIPT
-- ============================================================

-- ============================================================
-- PART A: CASCADE DELETE সেটআপ
-- (একবার চালান — এরপর auto-cascade কাজ করবে)
-- ============================================================

-- Orders → order_items, invoices cascade (already set in schema)
-- কিন্তু customers → orders cascade add করতে হবে

-- Drop existing constraints and re-add with CASCADE

-- customers → orders
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

-- orders → order_items
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- orders → invoices
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_order_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- customers → invoices
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_customer_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

-- customers → payments
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_customer_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

-- suppliers → purchases
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_supplier_id_fkey;
ALTER TABLE purchases ADD CONSTRAINT purchases_supplier_id_fkey
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;

-- purchases → purchase_items
ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS purchase_items_purchase_id_fkey;
ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_purchase_id_fkey
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE;

-- suppliers → supplier_payments
ALTER TABLE supplier_payments DROP CONSTRAINT IF EXISTS supplier_payments_supplier_id_fkey;
ALTER TABLE supplier_payments ADD CONSTRAINT supplier_payments_supplier_id_fkey
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;

-- products → order_items
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

-- products → stock_movements
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_product_id_fkey;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- customers → notification_logs
ALTER TABLE notification_logs DROP CONSTRAINT IF EXISTS notification_logs_customer_id_fkey;
ALTER TABLE notification_logs ADD CONSTRAINT notification_logs_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;


-- ============================================================
-- PART B: FULL RESET (সব data মুছুন — fresh start)
-- শুধু তখনই চালান যখন সব data পরিষ্কার করতে চান
-- ============================================================

/*
  নিচের block uncomment করে চালান:

  TRUNCATE TABLE
    notification_logs,
    supplier_payments,
    stock_movements,
    purchase_items,
    purchases,
    payments,
    invoices,
    order_items,
    orders,
    customers,
    suppliers
  RESTART IDENTITY CASCADE;

  -- Admin profile বাদে সব profiles মুছুন (optional):
  -- DELETE FROM profiles WHERE role != 'admin';
*/
