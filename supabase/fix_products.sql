-- ============================================================
-- FCF Products — Delete old & Insert correct products
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Step 1: Delete old products (safe — no orders yet)
DELETE FROM products;

-- Step 2: Insert correct FCF products
INSERT INTO products (product_code, name, name_bn, subject, pages, unit, purchase_price, selling_price, stock_quantity, category_id) VALUES

  ('FCF-124-BN', 'FCF 124', 'এফসিএফ ১২৪', 'Bangla',   124, 'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Standard')),
  ('FCF-124-MT', 'FCF 124', 'এফসিএফ ১২৪', 'Math',     124, 'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Standard')),
  ('FCF-124-EN', 'FCF 124', 'এফসিএফ ১২৪', 'English',  124, 'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Standard')),

  -- FCF 84 Series (Standard)
  ('FCF-084-BN', 'FCF 84',  'এফসিএফ ৮৪',  'Bangla',   84,  'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Standard')),
  ('FCF-084-MT', 'FCF 84',  'এফসিএফ ৮৪',  'Math',     84,  'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Standard')),
  ('FCF-084-EN', 'FCF 84',  'এফসিএফ ৮৪',  'English',  84,  'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Standard')),

  -- FCF 56 Series (Standard)
  ('FCF-056-BN', 'FCF 56',  'এফসিএফ ৫৬',  'Bangla',   56,  'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Standard')),
  ('FCF-056-MT', 'FCF 56',  'এফসিএফ ৫৬',  'Math',     56,  'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Standard')),
  ('FCF-056-EN', 'FCF 56',  'এফসিএফ ৫৬',  'English',  56,  'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Standard')),

  -- FCF Kidz 124 Series (Kidz)
  ('FCF-K124-BN', 'FCF Kidz 124', 'এফসিএফ কিডজ ১২৪', 'Bangla',   124, 'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Kidz')),
  ('FCF-K124-MT', 'FCF Kidz 124', 'এফসিএফ কিডজ ১২৪', 'Math',     124, 'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Kidz')),
  ('FCF-K124-EN', 'FCF Kidz 124', 'এফসিএফ কিডজ ১২৪', 'English',  124, 'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Kidz')),

  -- FCF Kidz (single)
  ('FCF-KIDZ', 'FCF Kidz', 'এফসিএফ কিডজ', NULL, NULL, 'pcs', 0, 0, 0, (SELECT id FROM product_categories WHERE name = 'Kidz'));
