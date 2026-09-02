CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES branches(id),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  user_id uuid NOT NULL REFERENCES users(id),
  reference text,
  status text NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('DRAFT', 'RECEIVED', 'CANCELLED')),
  total numeric(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  paid_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_cost numeric(14,2) NOT NULL CHECK (unit_cost >= 0),
  total numeric(14,2) NOT NULL CHECK (total >= 0)
);

CREATE INDEX IF NOT EXISTS purchases_branch_created_idx
  ON purchase_orders(branch_id, created_at DESC);
