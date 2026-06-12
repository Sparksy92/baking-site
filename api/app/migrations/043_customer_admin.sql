-- Admin customer management and email marketing readiness.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT 'registered';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS marketing_email_status TEXT NOT NULL DEFAULT 'non_subscribed';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS marketing_email_consented_at TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS marketing_email_source TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS internal_note TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_verified_at TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_source TEXT NOT NULL DEFAULT 'account';

CREATE TABLE IF NOT EXISTS customer_tags (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS customer_tag_members (
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES customer_tags(id) ON DELETE CASCADE,
    added_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    PRIMARY KEY (customer_id, tag_id)
);

CREATE TABLE IF NOT EXISTS customer_notes (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS customer_consent_events (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'email',
    status TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'admin',
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(customer_type);
CREATE INDEX IF NOT EXISTS idx_customers_marketing_email ON customers(marketing_email_status);
CREATE INDEX IF NOT EXISTS idx_customer_tag_members_customer ON customer_tag_members(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_customer ON customer_notes(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_customer_consent_customer ON customer_consent_events(customer_id, created_at);
