-- Staff roles and permissions
-- Roles: owner (all), editor (products/collections/content), fulfillment (orders/shipping only)

ALTER TABLE admin_users ADD COLUMN permissions TEXT NOT NULL DEFAULT 'all';
-- permissions is a comma-separated list or 'all'
-- Valid permissions: products, orders, collections, categories, promos, settings, customers, reports

-- Add staff invite tracking
ALTER TABLE admin_users ADD COLUMN invited_by INTEGER REFERENCES admin_users(id);
ALTER TABLE admin_users ADD COLUMN invite_accepted_at TEXT;
