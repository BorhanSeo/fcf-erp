-- ============================================================
-- FCF ERP: AUTOMATIC STOCK ADJUSTMENT ON ORDER CANCELLATION/DELETION
-- This ensures that if an order is delivered, cancelling or 
-- deleting it will automatically return the items to stock.
-- ============================================================

-- 1. Function to handle stock changes based on order status
CREATE OR REPLACE FUNCTION handle_order_stock_reversal()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  current_stock INTEGER;
BEGIN
  -- A. STATUS CHANGE: Revert stock if order is no longer 'delivered'
  -- This covers changing status to 'cancelled' or 'pending'
  IF (TG_OP = 'UPDATE') THEN
    IF (OLD.status = 'delivered' AND NEW.status != 'delivered') THEN
      FOR item IN 
        SELECT oi.product_id, oi.quantity, p.stock_quantity 
        FROM order_items oi 
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = NEW.id
      LOOP
        UPDATE products 
        SET stock_quantity = stock_quantity + item.quantity
        WHERE id = item.product_id;

        INSERT INTO stock_movements (product_id, movement_type, quantity, stock_before, stock_after, reference_id, reference_type, note)
        VALUES (item.product_id, 'sale_revert', item.quantity, item.stock_quantity, item.stock_quantity + item.quantity, NEW.id, 'order', 'Status changed from Delivered to ' || NEW.status);
      END LOOP;
    
    -- Also handle the reverse: marked as delivered (deduct stock)
    -- This is already handled by schema_part2, but we unify it here for safety
    ELSIF (OLD.status != 'delivered' AND NEW.status = 'delivered') THEN
      FOR item IN 
        SELECT oi.product_id, oi.quantity, p.stock_quantity 
        FROM order_items oi 
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = NEW.id
      LOOP
        UPDATE products 
        SET stock_quantity = GREATEST(0, stock_quantity - item.quantity)
        WHERE id = item.product_id;

        INSERT INTO stock_movements (product_id, movement_type, quantity, stock_before, stock_after, reference_id, reference_type, note)
        VALUES (item.product_id, 'sale_out', item.quantity, item.stock_quantity, GREATEST(0, item.stock_quantity - item.quantity), NEW.id, 'order', 'Order status set to Delivered');
      END LOOP;
    END IF;
  END IF;

  -- B. DELETION: Revert stock if a delivered order is deleted
  -- Note: We use a BEFORE DELETE trigger on 'orders' so we can still access order_items
  IF (TG_OP = 'DELETE') THEN
    IF (OLD.status = 'delivered') THEN
      FOR item IN 
        SELECT oi.product_id, oi.quantity, p.stock_quantity 
        FROM order_items oi 
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = OLD.id
      LOOP
        UPDATE products 
        SET stock_quantity = stock_quantity + item.quantity
        WHERE id = item.product_id;

        INSERT INTO stock_movements (product_id, movement_type, quantity, stock_before, stock_after, reference_id, reference_type, note)
        VALUES (item.product_id, 'sale_revert', item.quantity, item.stock_quantity, item.stock_quantity + item.quantity, OLD.id, 'order', 'Order deleted (was Delivered)');
      END LOOP;
    END IF;
  END IF;

  IF (TG_OP = 'DELETE') THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing stock status trigger to avoid conflicts
DROP TRIGGER IF EXISTS on_order_status_change ON orders;

-- 3. Create unified triggers
CREATE TRIGGER trg_order_stock_update
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION handle_order_stock_reversal();

CREATE TRIGGER trg_order_stock_delete
  BEFORE DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION handle_order_stock_reversal();


-- 4. Sync Customer totals also on Deletion (Robust version)
-- This ensures total_due and total_purchase are always correct
CREATE OR REPLACE FUNCTION sync_customer_stats_on_order()
RETURNS TRIGGER AS $$
DECLARE
  cust_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN cust_id := OLD.customer_id;
  ELSE cust_id := NEW.customer_id; END IF;

  UPDATE customers
  SET 
    total_due = (SELECT COALESCE(SUM(due_amount), 0) FROM orders WHERE customer_id = cust_id AND status != 'cancelled'),
    total_purchase = (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE customer_id = cust_id AND status != 'cancelled')
  WHERE id = cust_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_order_changed ON orders;
CREATE TRIGGER on_order_changed
  AFTER INSERT OR UPDATE OF due_amount, total_amount, status OR DELETE
  ON orders
  FOR EACH ROW EXECUTE FUNCTION sync_customer_stats_on_order();
