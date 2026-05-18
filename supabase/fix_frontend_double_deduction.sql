-- ============================================================
-- FCF ERP: ONE-TIME FIX — REVERT FRONTEND DOUBLE-DEDUCTION
-- ============================================================
-- Background:
--   The old NewOrderClient.tsx manually deducted stock at order
--   CREATION time (logged as "Sale: ORD-YYYY-NNNN") and then the
--   DB trigger ALSO deducted stock when the order was marked as
--   delivered (logged as "Order status set to Delivered" / "Order
--   Delivered: ORD-YYYY-NNNN"). Result: every order that has ever
--   been delivered was deducted twice. Even pending/cancelled
--   orders had one phantom deduction from the frontend.
--
--   The frontend code is now removed, so going forward stock will
--   only deduct via the trigger. This script repairs the historic
--   damage by adding back the frontend's deduction.
--
-- Run ONCE in: Supabase Dashboard → SQL Editor → New Query
-- Safe-guard: refuses to run twice (checks for its own log entries).
-- ============================================================

DO $$
DECLARE
  rec RECORD;
  cur_stock INTEGER;
  fixed_count INTEGER := 0;
BEGIN
  -- Refuse to run twice
  IF EXISTS (
    SELECT 1 FROM stock_movements
    WHERE note LIKE 'Bugfix: revert frontend double-deduction%'
  ) THEN
    RAISE NOTICE 'Bugfix already applied — skipping.';
    RETURN;
  END IF;

  -- ----------------------------------------------------------
  -- PART A: orders that still exist
  -- For each live order_item, add its qty back to product stock.
  -- ----------------------------------------------------------
  FOR rec IN
    SELECT oi.product_id, SUM(oi.quantity)::INTEGER AS qty
    FROM order_items oi
    GROUP BY oi.product_id
  LOOP
    SELECT stock_quantity INTO cur_stock
      FROM products WHERE id = rec.product_id;

    UPDATE products
      SET stock_quantity = stock_quantity + rec.qty,
          updated_at = NOW()
      WHERE id = rec.product_id;

    INSERT INTO stock_movements
      (product_id, movement_type, quantity, stock_before, stock_after,
       reference_id, reference_type, note)
    VALUES
      (rec.product_id, 'manual_in', rec.qty,
       cur_stock, cur_stock + rec.qty,
       NULL, 'system',
       'Bugfix: revert frontend double-deduction (live orders)');

    fixed_count := fixed_count + 1;
  END LOOP;

  -- ----------------------------------------------------------
  -- PART B: orders that were already deleted
  -- Find frontend-style "Sale: ORD-..." stock_out entries whose
  -- parent order no longer exists, and revert them too.
  -- ----------------------------------------------------------
  FOR rec IN
    SELECT sm.product_id, SUM(sm.quantity)::INTEGER AS qty
    FROM stock_movements sm
    WHERE sm.note LIKE 'Sale: ORD-%'
      AND sm.movement_type = 'sale_out'
      AND sm.reference_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM orders o WHERE o.id = sm.reference_id
      )
    GROUP BY sm.product_id
  LOOP
    SELECT stock_quantity INTO cur_stock
      FROM products WHERE id = rec.product_id;

    UPDATE products
      SET stock_quantity = stock_quantity + rec.qty,
          updated_at = NOW()
      WHERE id = rec.product_id;

    INSERT INTO stock_movements
      (product_id, movement_type, quantity, stock_before, stock_after,
       reference_id, reference_type, note)
    VALUES
      (rec.product_id, 'manual_in', rec.qty,
       cur_stock, cur_stock + rec.qty,
       NULL, 'system',
       'Bugfix: revert frontend double-deduction (deleted orders)');

    fixed_count := fixed_count + 1;
  END LOOP;

  RAISE NOTICE 'Bugfix applied. Adjusted % product(s).', fixed_count;
END $$;
