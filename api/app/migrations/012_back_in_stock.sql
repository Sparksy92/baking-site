-- Back-in-stock notification subscriptions
-- Customers (or guest emails) subscribe to be notified when a variant is restocked

CREATE TABLE back_in_stock_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    notified_at TEXT,          -- NULL until notification sent
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(email, variant_id)  -- One subscription per email per variant
);

CREATE INDEX idx_bis_variant ON back_in_stock_subscriptions(variant_id, notified_at);
CREATE INDEX idx_bis_email ON back_in_stock_subscriptions(email);
