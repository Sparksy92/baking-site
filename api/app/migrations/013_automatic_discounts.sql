-- Automatic discounts — applied without a code based on rules
-- Types: percentage_off, fixed_off, buy_x_get_y

CREATE TABLE automatic_discounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    discount_type TEXT NOT NULL DEFAULT 'percentage',  -- 'percentage' | 'fixed_cents' | 'buy_x_get_y'
    discount_value INTEGER NOT NULL,                   -- percent (10 = 10%) or cents (500 = $5.00)
    buy_quantity INTEGER,                              -- For buy_x_get_y: buy this many
    get_quantity INTEGER,                              -- For buy_x_get_y: get this many free/discounted
    applies_to TEXT NOT NULL DEFAULT 'all',            -- 'all' | 'collection' | 'category' | 'product'
    applies_to_id INTEGER,                            -- ID of collection/category/product (NULL = all)
    minimum_quantity INTEGER DEFAULT 0,               -- Min items in cart for discount to apply
    minimum_order_cents INTEGER DEFAULT 0,            -- Min subtotal for discount to apply
    max_discount_cents INTEGER,                       -- Cap on discount amount (NULL = unlimited)
    starts_at TEXT,
    expires_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 0,              -- Higher = applied first (stacking order)
    stackable INTEGER NOT NULL DEFAULT 0,            -- Can combine with other discounts?
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_auto_discount_active ON automatic_discounts(is_active, starts_at, expires_at);
CREATE INDEX idx_auto_discount_applies ON automatic_discounts(applies_to, applies_to_id);
