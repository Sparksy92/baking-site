-- Customer segments for targeted marketing

CREATE TABLE customer_segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    rules_json TEXT,  -- JSON rules for auto-segmentation (e.g. order_count > 3, total_spent > 10000)
    is_auto INTEGER NOT NULL DEFAULT 0,  -- 1 = auto-populated from rules, 0 = manual
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE customer_segment_members (
    segment_id INTEGER NOT NULL REFERENCES customer_segments(id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (segment_id, customer_id)
);

CREATE INDEX idx_segment_members_customer ON customer_segment_members(customer_id);
