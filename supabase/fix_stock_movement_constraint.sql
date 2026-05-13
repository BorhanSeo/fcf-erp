-- ============================================================
-- FCF ERP: FIX stock_movements_movement_type_check CONSTRAINT
-- Problem: Trigger uses 'sale_revert' but constraint doesn't allow it
-- Solution: Drop old constraint, add new one that includes 'sale_revert'
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Step 1: Drop the old restrictive constraint
ALTER TABLE stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;

-- Step 2: Add new constraint that includes 'sale_revert'
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

-- Done! Now orders can be deleted/reverted without constraint errors.
