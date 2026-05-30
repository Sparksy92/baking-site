-- Server-side cart persistence for abandoned cart recovery
-- Carts are created when a customer starts checkout or is logged in

CREATE TABLE carts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cart_token TEXT NOT NULL UNIQUE,                 -- UUID token stored in cookie
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    customer_email TEXT,                             -- Captured early in checkout flow
    customer_name TEXT,
    status TEXT NOT NULL DEFAULT 'active',           -- 'active' | 'abandoned' | 'recovered' | 'converted'
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    reminder_sent_1h INTEGER NOT NULL DEFAULT 0,    -- Flag: 1h reminder sent
    reminder_sent_24h INTEGER NOT NULL DEFAULT 0,   -- Flag: 24h reminder sent
    reminder_sent_72h INTEGER NOT NULL DEFAULT 0,   -- Flag: 72h reminder sent
    last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(cart_id, variant_id)
);

CREATE INDEX idx_carts_token ON carts(cart_token);
CREATE INDEX idx_carts_customer ON carts(customer_id);
CREATE INDEX idx_carts_status ON carts(status, last_activity_at);
CREATE INDEX idx_carts_abandoned ON carts(status, reminder_sent_1h, last_activity_at);
CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);
