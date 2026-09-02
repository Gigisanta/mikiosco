ALTER TABLE cash_sessions
  ADD COLUMN IF NOT EXISTS expected_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS difference numeric(14,2);
