-- ============================================================
-- FCF ERP: ONE-TIME FIX — RESTORE FCF 84 MATH STOCK BY 45 PCS
-- ============================================================
-- Problem: Order of 45 pcs FCF 84 Math was deleted but stock
-- was not restored. Current stock shows 3 instead of 48.
--
-- Run ONCE in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

DO $$
DECLARE
  prod_id UUID;
  cur_stock INTEGER;
BEGIN
  -- Find FCF 84 Math product
  SELECT id, stock_quantity INTO prod_id, cur_stock
  FROM products
  WHERE name = 'Fcf 84' AND subject = 'Math'
  LIMIT 1;

  IF prod_id IS NULL THEN
    RAISE NOTICE 'Product FCF 84 Math not found!';
    RETURN;
  END IF;

  -- Only fix if stock is currently 3 (to prevent running twice)
  IF cur_stock <> 3 THEN
    RAISE NOTICE 'Stock is %, not 3. Skipping fix to avoid double-correction.', cur_stock;
    RETURN;
  END IF;

  -- Restore the 45 pcs
  UPDATE products
    SET stock_quantity = stock_quantity + 45,
        updated_at = NOW()
    WHERE id = prod_id;

  INSERT INTO stock_movements
    (product_id, movement_type, quantity, stock_before, stock_after,
     reference_id, reference_type, note)
  VALUES
    (prod_id, 'manual_in', 45,
     cur_stock, cur_stock + 45,
     NULL, 'system',
     'Manual fix: restore 45 pcs lost from deleted order (stock was not reverted)');

  RAISE NOTICE 'Fixed! FCF 84 Math stock restored from % to %', cur_stock, cur_stock + 45;
END $$;
