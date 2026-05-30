-- Index for webhook lookups by stripe_session_id
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id);

-- Track Stripe event IDs for webhook idempotency
ALTER TABLE orders ADD COLUMN stripe_event_id TEXT;

-- Track when orders are cancelled/expired
ALTER TABLE orders ADD COLUMN cancelled_at TEXT;
