-- ============================================================
-- FCF ERP: FINAL FIX — DYNAMIC STOCK REVERT ON ORDER DELETE
-- ============================================================
-- Purpose:
--   1. Order DELETE  → if it was 'delivered', return stock automatically
--   2. Order UPDATE  → if status changes delivered ↔ non-delivered, sync stock
--   3. Customer totals (total_due, total_purchase) stay in sync on any change
--
-- This script is SAFE TO RUN MULTIPLE TIMES. It drops every old/competing
-- trigger that previous fix attempts may have created.
--
-- Run in: Supabase Dashboard → SQL Editor → New Query
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

DROP FUNCTION IF EXISTS handle_order_delivered()        CASCADE;
DROP FUNCTION IF EXISTS sync_order_stock()              CASCADE;
DROP FUNCTION IF EXISTS handle_order_stock_reversal()   CASCADE;
DROP FUNCTION IF EXISTS sync_customer_stats_on_order()  CASCADE;


-- ------------------------------------------------------------
-- STEP 3: Unified stock-sync function (handles UPDATE + DELETE)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fcf_order_stock_sync()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  cur_stock INTEGER;
  ord_number TEXT;
  ord_id UUID;
BEGIN
  -- ============ DELETE ============
  -- A delivered order is being deleted → return its items to stock.
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'delivered' THEN
      ord_id := OLD.id;
      ord_number := OLD.order_number;

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
--         (handle_order_due) so we have ONE consistent source of truth.
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS on_order_created    ON orders;
DROP TRIGGER IF EXISTS on_order_totals_sync ON orders;
DROP FUNCTION IF EXISTS handle_order_due() CASCADE;


-- ------------------------------------------------------------
-- STEP 6: Create the FINAL triggers
-- ------------------------------------------------------------

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
-- STEP 7: One-time backfill so existing data is consistent
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

-- Done.
