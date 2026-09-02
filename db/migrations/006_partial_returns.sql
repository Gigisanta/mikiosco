CREATE TABLE IF NOT EXISTS sale_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id),
  user_id uuid NOT NULL REFERENCES users(id),
  total numeric(14,2) NOT NULL CHECK (total > 0),
  refund_method payment_method NOT NULL DEFAULT 'CASH',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sale_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_return_id uuid NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
  sale_item_id uuid NOT NULL REFERENCES sale_items(id),
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  total numeric(14,2) NOT NULL CHECK (total > 0)
);

CREATE INDEX IF NOT EXISTS sale_returns_sale_idx ON sale_returns(sale_id, created_at DESC);
