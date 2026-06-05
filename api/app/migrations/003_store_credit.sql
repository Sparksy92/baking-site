-- Store credit ledger
-- Adds a balance to each customer and a full transaction history.
-- Replaces the silent no-op when returns are resolved as 'store_credit'.

ALTER TABLE customers ADD COLUMN store_credit_cents INTEGER NOT NULL DEFAULT 0;

CREATE TABLE store_credit_transactions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL,        -- positive = credit issued, negative = redeemed
    balance_after_cents INTEGER NOT NULL, -- snapshot for auditing
    reason TEXT NOT NULL,                 -- 'return', 'manual', 'redemption', 'adjustment'
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    return_request_id INTEGER REFERENCES return_requests(id) ON DELETE SET NULL,
    issued_by TEXT,                       -- admin username for manual credits
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX idx_store_credit_customer ON store_credit_transactions(customer_id, created_at);
CREATE INDEX idx_store_credit_order ON store_credit_transactions(order_id);
