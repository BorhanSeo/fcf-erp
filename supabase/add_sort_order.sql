-- Add sort_order column to products table for drag & drop reordering
ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Set initial sort_order based on current name order
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) AS rn
  FROM products
)
UPDATE products
SET sort_order = numbered.rn
FROM numbered
WHERE products.id = numbered.id;
