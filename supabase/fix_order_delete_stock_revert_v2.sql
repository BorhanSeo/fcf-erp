-- ============================================================
-- FCF ERP: FIX — ORDER DELETE MUST RESTORE STOCK (ALL STATUSES)
-- ============================================================
-- Problem:
--   The old trigger only restored stock on DELETE if status = 'delivered'.
--   But stock may have been deducted at creation (old frontend bug) or
--   the order may have been delivered then status changed. Result: when
--   an order is deleted, stock is NOT restored.
--
-- Fix:
--   The DELETE handler now checks if any sale_out stock_movements exist
--   for this order. If they do, it reverts them — regardless of order status.
--   This is the safest approach because it reverts exactly what was deducted.
--
-- Run ONCE in: Supabase Dashboard → SQL Editor → New Query
-- SAFE TO RUN MULTIPLE TIMES (drops and recreates triggers)
-- ============================================================


-- ------------------------------------------------------------
-- STEP 1: Make sure 'sale_revert' is allowed in stock_movements
-- ------------------------------------------------------------
ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_movement_type_check
  CHECK (movement_type IN (
    'purchase_in',
    'sale_out',
    'sale_revert',
    'manual_in',
    'manual_out',
    'return_out'
  ));


-- ------------------------------------------------------------
-- STEP 2: Drop ALL old / competing triggers on `orders`
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS on_order_status_change       ON orders;
DROP TRIGGER IF EXISTS on_order_stock_sync_update   ON orders;
DROP TRIGGER IF EXISTS on_order_stock_sync_delete   ON orders;
DROP TRIGGER IF EXISTS trg_order_stock_update       ON orders;
DROP TRIGGER IF EXISTS trg_order_stock_delete       ON orders;
DROP TRIGGER IF EXISTS on_order_changed             ON orders;
DROP TRIGGER IF EXISTS fcf_trg_order_stock_ins_upd  ON orders;
DROP TRIGGER IF EXISTS fcf_trg_order_stock_del      ON orders;

DROP FUNCTION IF EXISTS handle_order_delivered()        CASCADE;
DROP FUNCTION IF EXISTS sync_order_stock()              CASCADE;
DROP FUNCTION IF EXISTS handle_order_stock_reversal()   CASCADE;
DROP FUNCTION IF EXISTS fcf_order_stock_sync()          CASCADE;


-- ------------------------------------------------------------
-- STEP 3: Unified stock-sync function (handles INSERT/UPDATE/DELETE)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fcf_order_stock_sync()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  cur_stock INTEGER;
  ord_number TEXT;
  ord_id UUID;
  movement RECORD;
BEGIN
  -- ============ DELETE ============
  -- When an order is deleted, check if ANY stock was deducted for it
  -- (via sale_out movements). If so, revert ALL of them.
  -- This works regardless of the order's current status.
  IF TG_OP = 'DELETE' THEN
    ord_id := OLD.id;
    ord_number := OLD.order_number;

    -- Approach 1: If status was 'delivered', revert via order_items
    -- (order_items still exist at BEFORE DELETE time)
    IF OLD.status = 'delivered' THEN
      FOR item IN
        SELECT oi.product_id, oi.quantity, p.stock_quantity
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ord_id
      LOOP
        cur_stock := item.stock_quantity;

        UPDATE products
          SET stock_quantity = stock_quantity + item.quantity,
              updated_at = NOW()
          WHERE id = item.product_id;

        INSERT INTO stock_movements
          (product_id, movement_type, quantity, stock_before, stock_after,
           reference_id, reference_type, note)
        VALUES
          (item.product_id, 'sale_revert', item.quantity,
           cur_stock, cur_stock + item.quantity,
           ord_id, 'order',
           'Order deleted (was Delivered): ' || ord_number);
      END LOOP;
    ELSE
      -- Approach 2: For non-delivered orders, check stock_movements
      -- for any sale_out entries tied to this order and revert them.
      -- This handles old frontend double-deduction or any other scenario.
      FOR movement IN
        SELECT sm.product_id, SUM(sm.quantity)::INTEGER AS total_qty
        FROM stock_movements sm
        WHERE sm.reference_id = ord_id
          AND sm.reference_type = 'order'
          AND sm.movement_type = 'sale_out'
        GROUP BY sm.product_id
      LOOP
        -- Check if a revert was already done for this order+product
        IF NOT EXISTS (
          SELECT 1 FROM stock_movements
          WHERE reference_id = ord_id
            AND product_id = movement.product_id
            AND movement_type = 'sale_revert'
        ) THEN
          SELECT stock_quantity INTO cur_stock
            FROM products WHERE id = movement.product_id;

          UPDATE products
            SET stock_quantity = stock_quantity + movement.total_qty,
                updated_at = NOW()
            WHERE id = movement.product_id;

          INSERT INTO stock_movements
            (product_id, movement_type, quantity, stock_before, stock_after,
             reference_id, reference_type, note)
          VALUES
            (movement.product_id, 'sale_revert', movement.total_qty,
             cur_stock, cur_stock + movement.total_qty,
             ord_id, 'order',
             'Order deleted (was ' || OLD.status || '): ' || ord_number);
        END IF;
      END LOOP;
    END IF;

    RETURN OLD;
  END IF;

  -- ============ INSERT (created as delivered) ============
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'delivered' THEN
      FOR item IN
        SELECT oi.product_id, oi.quantity, p.stock_quantity
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = NEW.id
      LOOP
        cur_stock := item.stock_quantity;

        UPDATE products
          SET stock_quantity = GREATEST(0, stock_quantity - item.quantity),
              updated_at = NOW()
          WHERE id = item.product_id;

        INSERT INTO stock_movements
          (product_id, movement_type, quantity, stock_before, stock_after,
           reference_id, reference_type, note)
        VALUES
          (item.product_id, 'sale_out', item.quantity,
           cur_stock, GREATEST(0, cur_stock - item.quantity),
           NEW.id, 'order',
           'Order Delivered: ' || NEW.order_number);
      END LOOP;
    END IF;

    RETURN NEW;
  END IF;

  -- ============ UPDATE ============
  IF TG_OP = 'UPDATE' THEN
    -- non-delivered → delivered: deduct stock
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF OLD.status <> 'delivered' AND NEW.status = 'delivered' THEN
        FOR item IN
          SELECT oi.product_id, oi.quantity, p.stock_quantity
          FROM order_items oi
          JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = NEW.id
        LOOP
          cur_stock := item.stock_quantity;

          UPDATE products
            SET stock_quantity = GREATEST(0, stock_quantity - item.quantity),
                updated_at = NOW()
            WHERE id = item.product_id;

          INSERT INTO stock_movements
            (product_id, movement_type, quantity, stock_before, stock_after,
             reference_id, reference_type, note)
          VALUES
            (item.product_id, 'sale_out', item.quantity,
             cur_stock, GREATEST(0, cur_stock - item.quantity),
             NEW.id, 'order',
             'Order Delivered: ' || NEW.order_number);
        END LOOP;

      -- delivered → anything else (cancelled / pending / confirmed): return stock
      ELSIF OLD.status = 'delivered' AND NEW.status <> 'delivered' THEN
        FOR item IN
          SELECT oi.product_id, oi.quantity, p.stock_quantity
          FROM order_items oi
          JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = NEW.id
        LOOP
          cur_stock := item.stock_quantity;

          UPDATE products
            SET stock_quantity = stock_quantity + item.quantity,
                updated_at = NOW()
            WHERE id = item.product_id;

          INSERT INTO stock_movements
            (product_id, movement_type, quantity, stock_before, stock_after,
             reference_id, reference_type, note)
          VALUES
            (item.product_id, 'sale_revert', item.quantity,
             cur_stock, cur_stock + item.quantity,
             NEW.id, 'order',
             'Order Status changed Delivered → ' || NEW.status || ': ' || NEW.order_number);
        END LOOP;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------
-- STEP 4: Customer total recompute (handles INSERT/UPDATE/DELETE)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fcf_sync_customer_totals()
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
    total_due = COALESCE((
      SELECT SUM(due_amount) FROM orders
      WHERE customer_id = cust_id AND status <> 'cancelled'
    ), 0),
    total_purchase = COALESCE((
      SELECT SUM(total_amount) FROM orders
      WHERE customer_id = cust_id AND status <> 'cancelled'
    ), 0),
    updated_at = NOW()
  WHERE id = cust_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------
-- STEP 5: Replace old customer-due trigger from schema_part2
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS on_order_created    ON orders;
DROP TRIGGER IF EXISTS on_order_totals_sync ON orders;
DROP FUNCTION IF EXISTS handle_order_due() CASCADE;


-- ------------------------------------------------------------
-- STEP 6: Drop and re-create the FINAL triggers
-- ------------------------------------------------------------

-- Drop all first to make this script re-runnable
DROP TRIGGER IF EXISTS fcf_trg_order_stock_ins_upd    ON orders;
DROP TRIGGER IF EXISTS fcf_trg_order_stock_del        ON orders;
DROP TRIGGER IF EXISTS fcf_trg_customer_totals_ins_upd ON orders;
DROP TRIGGER IF EXISTS fcf_trg_customer_totals_del    ON orders;

-- Stock sync: BEFORE DELETE so order_items are still readable;
-- AFTER INSERT/UPDATE so NEW row is committed first.
CREATE TRIGGER fcf_trg_order_stock_ins_upd
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION fcf_order_stock_sync();

CREATE TRIGGER fcf_trg_order_stock_del
  BEFORE DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION fcf_order_stock_sync();

-- Customer totals sync: any time orders change.
CREATE TRIGGER fcf_trg_customer_totals_ins_upd
  AFTER INSERT OR UPDATE OF status, due_amount, total_amount ON orders
  FOR EACH ROW EXECUTE FUNCTION fcf_sync_customer_totals();

CREATE TRIGGER fcf_trg_customer_totals_del
  AFTER DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION fcf_sync_customer_totals();


-- ------------------------------------------------------------
-- STEP 7: One-time backfill customer totals
-- ------------------------------------------------------------
UPDATE customers c
SET
  total_due = COALESCE((
    SELECT SUM(due_amount) FROM orders
    WHERE customer_id = c.id AND status <> 'cancelled'
  ), 0),
  total_purchase = COALESCE((
    SELECT SUM(total_amount) FROM orders
    WHERE customer_id = c.id AND status <> 'cancelled'
  ), 0);

-- Done! Now order DELETE will always restore stock properly.
