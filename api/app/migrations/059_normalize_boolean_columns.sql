-- Migration 058: Normalize all INTEGER boolean columns to BOOLEAN
--
-- The initial schema (001_initial_postgres_schema.sql) was authored with
-- SQLite-compatible INTEGER (0/1) for boolean columns. PostgreSQL-native
-- BOOLEAN columns were introduced from migration 040 onward. This migration
-- converts all remaining INTEGER boolean columns to proper BOOLEAN so that
-- queries using = TRUE / = FALSE work correctly without translation workarounds.
--
-- Pattern per column:
--   1. DROP DEFAULT  (PostgreSQL cannot auto-cast integer DEFAULT to boolean)
--   2. ALTER TYPE ... USING col::boolean  (0→false, 1→true, NULL→NULL)
--   3. SET DEFAULT true/false  (restore appropriate default)

-- admin_users
ALTER TABLE admin_users ALTER COLUMN is_active DROP DEFAULT;
ALTER TABLE admin_users ALTER COLUMN is_active TYPE BOOLEAN USING is_active::boolean;
ALTER TABLE admin_users ALTER COLUMN is_active SET DEFAULT true;

-- automatic_discounts
ALTER TABLE automatic_discounts ALTER COLUMN is_active DROP DEFAULT;
ALTER TABLE automatic_discounts ALTER COLUMN is_active TYPE BOOLEAN USING is_active::boolean;
ALTER TABLE automatic_discounts ALTER COLUMN is_active SET DEFAULT true;

-- bundles
ALTER TABLE bundles ALTER COLUMN is_active DROP DEFAULT;
ALTER TABLE bundles ALTER COLUMN is_active TYPE BOOLEAN USING is_active::boolean;
ALTER TABLE bundles ALTER COLUMN is_active SET DEFAULT true;

-- categories
ALTER TABLE categories ALTER COLUMN is_active DROP DEFAULT;
ALTER TABLE categories ALTER COLUMN is_active TYPE BOOLEAN USING is_active::boolean;
ALTER TABLE categories ALTER COLUMN is_active SET DEFAULT true;

-- collections
ALTER TABLE collections ALTER COLUMN is_active DROP DEFAULT;
ALTER TABLE collections ALTER COLUMN is_active TYPE BOOLEAN USING is_active::boolean;
ALTER TABLE collections ALTER COLUMN is_active SET DEFAULT true;

-- customer_addresses
ALTER TABLE customer_addresses ALTER COLUMN is_default DROP DEFAULT;
ALTER TABLE customer_addresses ALTER COLUMN is_default TYPE BOOLEAN USING is_default::boolean;
ALTER TABLE customer_addresses ALTER COLUMN is_default SET DEFAULT false;

-- customer_segments
ALTER TABLE customer_segments ALTER COLUMN is_auto DROP DEFAULT;
ALTER TABLE customer_segments ALTER COLUMN is_auto TYPE BOOLEAN USING is_auto::boolean;
ALTER TABLE customer_segments ALTER COLUMN is_auto SET DEFAULT false;

-- customers
ALTER TABLE customers ALTER COLUMN is_active DROP DEFAULT;
ALTER TABLE customers ALTER COLUMN is_active TYPE BOOLEAN USING is_active::boolean;
ALTER TABLE customers ALTER COLUMN is_active SET DEFAULT true;

-- gift_cards
ALTER TABLE gift_cards ALTER COLUMN is_active DROP DEFAULT;
ALTER TABLE gift_cards ALTER COLUMN is_active TYPE BOOLEAN USING is_active::boolean;
ALTER TABLE gift_cards ALTER COLUMN is_active SET DEFAULT true;

-- loyalty_rules
ALTER TABLE loyalty_rules ALTER COLUMN is_active DROP DEFAULT;
ALTER TABLE loyalty_rules ALTER COLUMN is_active TYPE BOOLEAN USING is_active::boolean;
ALTER TABLE loyalty_rules ALTER COLUMN is_active SET DEFAULT true;

-- newsletter_subscribers
ALTER TABLE newsletter_subscribers ALTER COLUMN is_active DROP DEFAULT;
ALTER TABLE newsletter_subscribers ALTER COLUMN is_active TYPE BOOLEAN USING is_active::boolean;
ALTER TABLE newsletter_subscribers ALTER COLUMN is_active SET DEFAULT true;

-- product_images
ALTER TABLE product_images ALTER COLUMN is_primary DROP DEFAULT;
ALTER TABLE product_images ALTER COLUMN is_primary TYPE BOOLEAN USING is_primary::boolean;
ALTER TABLE product_images ALTER COLUMN is_primary SET DEFAULT false;

-- product_variants
ALTER TABLE product_variants ALTER COLUMN is_active DROP DEFAULT;
ALTER TABLE product_variants ALTER COLUMN is_active TYPE BOOLEAN USING is_active::boolean;
ALTER TABLE product_variants ALTER COLUMN is_active SET DEFAULT true;

-- products
ALTER TABLE products ALTER COLUMN is_active DROP DEFAULT;
ALTER TABLE products ALTER COLUMN is_active TYPE BOOLEAN USING is_active::boolean;
ALTER TABLE products ALTER COLUMN is_active SET DEFAULT true;

ALTER TABLE products ALTER COLUMN is_featured DROP DEFAULT;
ALTER TABLE products ALTER COLUMN is_featured TYPE BOOLEAN USING is_featured::boolean;
ALTER TABLE products ALTER COLUMN is_featured SET DEFAULT false;

-- promo_codes
ALTER TABLE promo_codes ALTER COLUMN is_active DROP DEFAULT;
ALTER TABLE promo_codes ALTER COLUMN is_active TYPE BOOLEAN USING is_active::boolean;
ALTER TABLE promo_codes ALTER COLUMN is_active SET DEFAULT true;

-- size_guides
ALTER TABLE size_guides ALTER COLUMN is_default DROP DEFAULT;
ALTER TABLE size_guides ALTER COLUMN is_default TYPE BOOLEAN USING is_default::boolean;
ALTER TABLE size_guides ALTER COLUMN is_default SET DEFAULT false;

-- webhooks
ALTER TABLE webhooks ALTER COLUMN is_active DROP DEFAULT;
ALTER TABLE webhooks ALTER COLUMN is_active TYPE BOOLEAN USING is_active::boolean;
ALTER TABLE webhooks ALTER COLUMN is_active SET DEFAULT true;
