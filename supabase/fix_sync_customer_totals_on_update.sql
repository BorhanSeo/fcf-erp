-- ============================================================
-- FCF ERP: FIX CUSTOMER TOTALS SYNCHRONIZATION ON CUSTOMER UPDATE
-- This script updates the sync_customer_totals() trigger function
-- to ensure that if an order's customer is changed, the old customer's
-- totals are also updated, preventing dangling due/purchase balances.
-- ============================================================

CREATE OR REPLACE FUNCTION sync_customer_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Update the new customer's totals
  UPDATE customers
  SET 
    total_due = (SELECT COALESCE(SUM(due_amount), 0) FROM orders WHERE customer_id = NEW.customer_id AND status != 'cancelled'),
    total_purchase = (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE customer_id = NEW.customer_id AND status != 'cancelled')
  WHERE id = NEW.customer_id;

  -- 2. If it was an UPDATE and customer_id changed, update the old customer's totals too
  IF TG_OP = 'UPDATE' AND OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
    UPDATE customers
    SET 
      total_due = (SELECT COALESCE(SUM(due_amount), 0) FROM orders WHERE customer_id = OLD.customer_id AND status != 'cancelled'),
      total_purchase = (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE customer_id = OLD.customer_id AND status != 'cancelled')
    WHERE id = OLD.customer_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
