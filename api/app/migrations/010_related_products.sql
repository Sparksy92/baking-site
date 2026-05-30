-- Related products (manual picks + algorithmic via co-purchase)
-- Admin can manually set related products; system also auto-generates from order data

CREATE TABLE related_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    related_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'co_purchase' | 'same_category'
    score REAL NOT NULL DEFAULT 1.0,               -- Higher = more relevant (for sorting)
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(product_id, related_product_id)
);

CREATE INDEX idx_related_product ON related_products(product_id, score DESC);
CREATE INDEX idx_related_type ON related_products(relation_type);
