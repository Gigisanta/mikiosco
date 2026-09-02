CREATE TABLE IF NOT EXISTS branch_ticket_counters (
  branch_id uuid PRIMARY KEY REFERENCES branches(id) ON DELETE CASCADE,
  next_value bigint NOT NULL DEFAULT 1 CHECK (next_value > 0)
);

ALTER TABLE sales ADD COLUMN IF NOT EXISTS idempotency_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS sales_branch_idempotency_idx
  ON sales(branch_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

INSERT INTO branch_ticket_counters (branch_id, next_value)
SELECT b.id, COALESCE(MAX(s.ticket_number), 0) + 1
FROM branches b
LEFT JOIN sales s ON s.branch_id = b.id
GROUP BY b.id
ON CONFLICT (branch_id) DO UPDATE
SET next_value = GREATEST(branch_ticket_counters.next_value, EXCLUDED.next_value);
