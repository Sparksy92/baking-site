-- Gift cards

CREATE TABLE gift_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    initial_balance_cents INTEGER NOT NULL,
    current_balance_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CAD',
    purchaser_email TEXT,
    recipient_email TEXT,
    recipient_name TEXT,
    message TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE gift_card_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gift_card_id INTEGER NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL,  -- negative = redemption, positive = load
    order_id INTEGER REFERENCES orders(id),
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_gift_cards_code ON gift_cards(code);
CREATE INDEX idx_gc_transactions_card ON gift_card_transactions(gift_card_id);
