-- ============================================================
-- FCF ERP: REMOVE SINGLE ITEM FROM ORDER
-- ============================================================
-- Adds the ability for admin to delete a single line item from
-- any order. Behaviour:
--
--   1. When an `order_items` row is deleted:
--        - if its parent order is 'delivered', the item's quantity
--          is returned to product stock (logged in stock_movements)
--        - the parent order's subtotal / total / due are recomputed
--   2. When the parent order itself is deleted, the per-item revert
--      is now driven by cascade (single source of truth — no more
--      double-revert from the old orders-level loop).
--
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- Safe to run multiple times.
-- ============================================================


-- ------------------------------------------------------------
-- STEP 1: Refactor orders DELETE handler — stop doing the loop
--         here; per-item trigger will do it via cascade.
--         Also mark deletion in a session var so the recompute
--         trigger can skip the doomed parent row.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fcf_order_stock_sync()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  cur_stock INTEGER;
BEGIN
  -- ============ DELETE ============
  -- Just mark the order as "being deleted" so child triggers can
  -- skip recomputing totals. Per-item stock revert is handled by
  -- fcf_order_item_delete_handler during cascade.
  IF TG_OP = 'DELETE' THEN
    PERFORM set_config('fcf.deleting_order_id', OLD.id::text, true);
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
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      -- non-delivered → delivered: deduct stock
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

      -- delivered → anything else: revert stock
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
-- STEP 2: Per-item BEFORE DELETE — revert stock if parent
--         order is delivered. Works for both:
--           - direct deletion (admin removes a single item)
--           - cascade deletion (admin deletes the whole order)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fcf_order_item_delete_handler()
RETURNS TRIGGER AS $$
DECLARE
  parent_status TEXT;
  parent_order_number TEXT;
  cur_stock INTEGER;
BEGIN
  SELECT status, order_number
    INTO parent_status, parent_order_number
    FROM orders WHERE id = OLD.order_id;

  -- If parent row already gone (shouldn't normally happen — cascade
  -- keeps it around until children are deleted), bail.
  IF parent_status IS NULL THEN
    RETURN OLD;
  END IF;

  IF parent_status = 'delivered' THEN
    SELECT stock_quantity INTO cur_stock
      FROM products WHERE id = OLD.product_id;

    UPDATE products
      SET stock_quantity = stock_quantity + OLD.quantity,
          updated_at = NOW()
      WHERE id = OLD.product_id;

    INSERT INTO stock_movements
      (product_id, movement_type, quantity, stock_before, stock_after,
       reference_id, reference_type, note)
    VALUES
      (OLD.product_id, 'sale_revert', OLD.quantity,
       cur_stock, cur_stock + OLD.quantity,
       OLD.order_id, 'order',
       CASE
         WHEN current_setting('fcf.deleting_order_id', true) = OLD.order_id::text
           THEN 'Order deleted (was Delivered): ' || parent_order_number
         ELSE 'Item removed from Delivered Order: ' || parent_order_number
       END);
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------
-- STEP 3: Recompute parent order's totals when items change.
--         Skipped if the parent order is being deleted.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fcf_recompute_order_totals()
RETURNS TRIGGER AS $$
DECLARE
  ord_id UUID;
  new_subtotal NUMERIC;
  new_total NUMERIC;
  cur_discount NUMERIC;
  cur_paid NUMERIC;
  new_due NUMERIC;
  new_method TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    ord_id := OLD.order_id;
  ELSE
    ord_id := NEW.order_id;
  END IF;

  -- Skip if the parent order is being deleted (cascade path)
  IF current_setting('fcf.deleting_order_id', true) = ord_id::text THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Parent must still exist
  IF NOT EXISTS (SELECT 1 FROM orders WHERE id = ord_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(line_total), 0) INTO new_subtotal
    FROM order_items WHERE order_id = ord_id;

  SELECT discount_amount, paid_amount
    INTO cur_discount, cur_paid
    FROM orders WHERE id = ord_id;

  new_total := GREATEST(0, new_subtotal - COALESCE(cur_discount, 0));

  -- Clamp paid_amount so it never exceeds the new total
  IF cur_paid > new_total THEN
    cur_paid := new_total;
  END IF;

  new_due := GREATEST(0, new_total - cur_paid);

  IF new_due = 0 THEN
    new_method := 'cash';
  ELSIF cur_paid > 0 THEN
    new_method := 'partial';
  ELSE
    new_method := 'due';
  END IF;

  UPDATE orders
  SET
    subtotal = new_subtotal,
    total_amount = new_total,
    paid_amount = cur_paid,
    due_amount = new_due,
    payment_method = new_method,
    updated_at = NOW()
  WHERE id = ord_id;

  -- Keep invoice numbers in sync too
  UPDATE invoices
  SET
    total_amount = new_total,
    paid_amount = cur_paid,
    due_amount = new_due
  WHERE order_id = ord_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------
-- STEP 4: Wire up the triggers
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS fcf_trg_order_item_delete       ON order_items;
DROP TRIGGER IF EXISTS fcf_trg_order_item_totals_sync  ON order_items;

CREATE TRIGGER fcf_trg_order_item_delete
  BEFORE DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION fcf_order_item_delete_handler();

CREATE TRIGGER fcf_trg_order_item_totals_sync
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION fcf_recompute_order_totals();


-- ------------------------------------------------------------
-- STEP 5: RLS policy — admin can delete order_items
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "order_items_delete" ON order_items;
CREATE POLICY "order_items_delete" ON order_items
  FOR DELETE USING (get_my_role() = 'admin');

-- Done.
