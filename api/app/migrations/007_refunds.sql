-- Track refund details on orders
ALTER TABLE orders ADD COLUMN refund_amount_cents INTEGER;
ALTER TABLE orders ADD COLUMN stripe_refund_id TEXT;
ALTER TABLE orders ADD COLUMN refunded_at TEXT;
ALTER TABLE orders ADD COLUMN refund_reason TEXT;
