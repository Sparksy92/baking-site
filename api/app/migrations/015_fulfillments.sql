-- Partial fulfillment support: multiple shipments per order

CREATE TABLE fulfillments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    tracking_number TEXT,
    tracking_carrier TEXT,
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'shipped' | 'delivered'
    shipped_at TEXT,
    delivered_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE fulfillment_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fulfillment_id INTEGER NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
    order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    UNIQUE(fulfillment_id, order_item_id)
);

CREATE INDEX idx_fulfillments_order ON fulfillments(order_id);
CREATE INDEX idx_fulfillment_items_fulfillment ON fulfillment_items(fulfillment_id);
