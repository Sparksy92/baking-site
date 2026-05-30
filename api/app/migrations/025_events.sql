-- Server-side event log for analytics / conversion funnel

CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,  -- 'product_viewed', 'add_to_cart', 'checkout_started', 'checkout_completed'
    session_id TEXT,
    customer_id INTEGER,
    product_id INTEGER,
    variant_id INTEGER,
    order_id INTEGER,
    metadata_json TEXT,  -- arbitrary JSON payload
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_events_type ON events(event_type, created_at);
CREATE INDEX idx_events_session ON events(session_id);
CREATE INDEX idx_events_created ON events(created_at);
