-- Promo / Discount Codes

CREATE TABLE promo_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    description TEXT,
    discount_type TEXT NOT NULL DEFAULT 'percent',  -- 'percent' | 'fixed_cents'
    discount_value INTEGER NOT NULL,                -- percent (10 = 10%) or cents (500 = $5.00)
    minimum_order_cents INTEGER DEFAULT 0,
    max_uses INTEGER,                               -- NULL = unlimited
    times_used INTEGER NOT NULL DEFAULT 0,
    starts_at TEXT,                                  -- NULL = immediately
    expires_at TEXT,                                 -- NULL = never
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_promo_code ON promo_codes(code);
CREATE INDEX idx_promo_active ON promo_codes(is_active, starts_at, expires_at);

-- Track which orders used which promo
ALTER TABLE orders ADD COLUMN promo_code TEXT;
ALTER TABLE orders ADD COLUMN discount_cents INTEGER NOT NULL DEFAULT 0;
