-- ============================================================
-- FCF ERP: DYNAMIC STOCK ADJUSTMENT FOR ORDERS
-- This script ensures stock is reverted when an order is 
-- cancelled or deleted after being marked as delivered.
-- ============================================================

-- 1. Unified function to handle stock sync for orders
CREATE OR REPLACE FUNCTION sync_order_stock()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  current_stock INTEGER;
BEGIN
  -- CASE A: Order marked as 'delivered' (Deduct Stock)
  -- This happens on INSERT (if created as delivered) or UPDATE (status change)
  IF (TG_OP = 'INSERT' AND NEW.status = 'delivered') OR 
     (TG_OP = 'UPDATE' AND OLD.status != 'delivered' AND NEW.status = 'delivered') THEN
    
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
              GREATEST(0, current_stock - item.quantity), NEW.id, 'order', 'Order Delivered: ' || NEW.order_number);
    END LOOP;

  -- CASE B: Order status changed FROM 'delivered' TO something else (Revert Stock)
  -- e.g., Cancelled or reverted to Pending
  ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'delivered' AND NEW.status != 'delivered') THEN
    
    FOR item IN
      SELECT oi.product_id, oi.quantity, p.stock_quantity
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = NEW.id
    LOOP
      current_stock := item.stock_quantity;
      UPDATE products
        SET stock_quantity = stock_quantity + item.quantity
        WHERE id = item.product_id;

      INSERT INTO stock_movements (product_id, movement_type, quantity, stock_before, stock_after, reference_id, reference_type, note)
      VALUES (item.product_id, 'sale_revert', item.quantity, current_stock,
              current_stock + item.quantity, NEW.id, 'order', 'Order Status Changed from Delivered: ' || NEW.order_number);
    END LOOP;

  -- CASE C: Order is DELETED and it was 'delivered' (Revert Stock)
  ELSIF (TG_OP = 'DELETE' AND OLD.status = 'delivered') THEN
    
    FOR item IN
      SELECT oi.product_id, oi.quantity, p.stock_quantity
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = OLD.id
    LOOP
      current_stock := item.stock_quantity;
      UPDATE products
        SET stock_quantity = stock_quantity + item.quantity
        WHERE id = item.product_id;

      INSERT INTO stock_movements (product_id, movement_type, quantity, stock_before, stock_after, reference_id, reference_type, note)
      VALUES (item.product_id, 'sale_revert', item.quantity, current_stock,
              current_stock + item.quantity, OLD.id, 'order', 'Order Deleted (was Delivered): ' || OLD.order_number);
    END LOOP;

  END IF;

  -- For BEFORE DELETE, we must return OLD to allow deletion
  -- For others, return NEW
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop old triggers
DROP TRIGGER IF EXISTS on_order_status_change ON orders;

-- 3. Create comprehensive trigger for stock sync
-- Using BEFORE DELETE to ensure order_items are still accessible
CREATE TRIGGER on_order_stock_sync_update
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION sync_order_stock();

CREATE TRIGGER on_order_stock_sync_delete
  BEFORE DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION sync_order_stock();
