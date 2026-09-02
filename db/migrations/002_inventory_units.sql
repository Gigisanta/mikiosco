ALTER TABLE products
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'unidad',
  ADD COLUMN IF NOT EXISTS max_stock numeric(14,3) NOT NULL DEFAULT 0;

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_unit_check;
ALTER TABLE products ADD CONSTRAINT products_unit_check
  CHECK (unit IN ('unidad', 'kg', 'g', 'litro', 'ml', 'pack', 'caja', 'metro'));

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_stock_limits_check;
ALTER TABLE products ADD CONSTRAINT products_stock_limits_check
  CHECK (max_stock = 0 OR max_stock >= min_stock);
