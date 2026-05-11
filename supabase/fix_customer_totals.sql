-- ============================================================
-- FCF ERP: FIX CUSTOMER TOTALS SYNCHRONIZATION
-- This script ensures customers.total_due and total_purchase
-- strictly match the active orders (ignoring manual payments).
-- ============================================================

-- 1. Create a function to dynamically sync customer totals
CREATE OR REPLACE FUNCTION sync_customer_totals()
RETURNS TRIGGER AS $$
DECLARE
  cust_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    cust_id := OLD.customer_id;
  ELSE
    cust_id := NEW.customer_id;
  END IF;

  UPDATE customers
  SET 
    total_due = (SELECT COALESCE(SUM(due_amount), 0) FROM orders WHERE customer_id = cust_id AND status != 'cancelled'),
    total_purchase = (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE customer_id = cust_id AND status != 'cancelled')
  WHERE id = cust_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the old trigger that only ran on INSERT
DROP TRIGGER IF EXISTS on_order_created ON orders;

-- 3. Create a comprehensive trigger for INSERT, UPDATE, DELETE
DROP TRIGGER IF EXISTS on_order_changed ON orders;
CREATE TRIGGER on_order_changed
  AFTER INSERT OR UPDATE OF due_amount, total_amount, status OR DELETE
  ON orders
  FOR EACH ROW EXECUTE FUNCTION sync_customer_totals();

-- 4. Retroactively fix all existing customers
UPDATE customers c
SET 
  total_due = COALESCE((SELECT SUM(due_amount) FROM orders o WHERE o.customer_id = c.id AND o.status != 'cancelled'), 0),
  total_purchase = COALESCE((SELECT SUM(total_amount) FROM orders o WHERE o.customer_id = c.id AND o.status != 'cancelled'), 0);
