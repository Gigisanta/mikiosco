CREATE TABLE IF NOT EXISTS customer_account_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id),
  user_id uuid NOT NULL REFERENCES users(id),
  cash_session_id uuid REFERENCES cash_sessions(id),
  method payment_method NOT NULL DEFAULT 'CASH',
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  user_id uuid NOT NULL REFERENCES users(id),
  cash_session_id uuid REFERENCES cash_sessions(id),
  method payment_method NOT NULL DEFAULT 'CASH',
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_payments_customer_idx
  ON customer_account_payments(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS supplier_payments_supplier_idx
  ON supplier_payments(supplier_id, created_at DESC);
