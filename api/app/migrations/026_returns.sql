-- Return / exchange requests

CREATE TABLE return_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    customer_id INTEGER REFERENCES customers(id),
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'received', 'refunded'
    reason TEXT NOT NULL,
    details TEXT,
    admin_notes TEXT,
    resolution TEXT,  -- 'refund', 'exchange', 'store_credit'
    refund_amount_cents INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_request_id INTEGER NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
    order_item_id INTEGER NOT NULL REFERENCES order_items(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    reason TEXT
);

CREATE INDEX idx_return_requests_order ON return_requests(order_id);
CREATE INDEX idx_return_requests_status ON return_requests(status);
CREATE INDEX idx_return_items_request ON return_items(return_request_id);
