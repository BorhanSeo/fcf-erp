-- ============================================================
-- FCF ERP: Add missing DELETE policy for customers table
-- Run this in Supabase SQL Editor
-- ============================================================

-- Allow admin to delete customers
DROP POLICY IF EXISTS "customers_delete" ON customers;
CREATE POLICY "customers_delete" ON customers 
  FOR DELETE USING (get_my_role() = 'admin');
