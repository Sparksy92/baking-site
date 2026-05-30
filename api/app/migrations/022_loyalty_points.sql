-- Loyalty / points program

ALTER TABLE customers ADD COLUMN loyalty_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN lifetime_points INTEGER NOT NULL DEFAULT 0;

CREATE TABLE loyalty_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,  -- positive = earned, negative = redeemed
    reason TEXT NOT NULL,     -- 'purchase', 'redemption', 'bonus', 'adjustment'
    order_id INTEGER REFERENCES orders(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE loyalty_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    points_per_dollar INTEGER NOT NULL DEFAULT 1,  -- Points earned per dollar spent
    redemption_rate_cents INTEGER NOT NULL DEFAULT 1,  -- Cents per point when redeeming
    minimum_points_redeem INTEGER NOT NULL DEFAULT 100,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_loyalty_transactions_customer ON loyalty_transactions(customer_id);
