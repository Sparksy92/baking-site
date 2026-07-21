-- From 001_initial_schema.sql
-- Initial schema for clothing-ecommerce-baseline
-- 10 tables: categories, products, product_variants, product_images,
-- collections, collection_products, orders, order_items, admin_users, audit_log

-- ── Categories ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active, sort_order);

-- ── Products ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    category_id INTEGER REFERENCES categories(id),
    is_active INTEGER NOT NULL DEFAULT 1,
    is_featured INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured, is_active);

-- ── Product Variants (Size × Color) ────────────────────────────

CREATE TABLE IF NOT EXISTS product_variants (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    size TEXT NOT NULL,
    color TEXT NOT NULL,
    color_hex TEXT,
    price_cents INTEGER NOT NULL,
    compare_at_price_cents INTEGER,
    sku TEXT UNIQUE,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id, is_active);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(sku);

-- ── Product Images ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_images (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    alt_text TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_primary INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_images_product ON product_images(product_id, sort_order);

-- ── Collections ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS collections (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_collections_slug ON collections(slug);
CREATE INDEX IF NOT EXISTS idx_collections_active ON collections(is_active, sort_order);

-- ── Collection ↔ Products (many-to-many) ────────────────────────

CREATE TABLE IF NOT EXISTS collection_products (
    collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (collection_id, product_id)
);

-- ── Orders ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'received',
    payment_method TEXT NOT NULL DEFAULT 'stripe',
    payment_status TEXT NOT NULL DEFAULT 'pending',
    stripe_session_id TEXT,
    stripe_payment_intent_id TEXT,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    shipping_address_line1 TEXT NOT NULL,
    shipping_address_line2 TEXT,
    shipping_address_city TEXT NOT NULL,
    shipping_address_province TEXT NOT NULL,
    shipping_address_postal TEXT NOT NULL,
    shipping_address_country TEXT NOT NULL DEFAULT 'CA',
    subtotal_cents INTEGER NOT NULL,
    shipping_cents INTEGER NOT NULL DEFAULT 0,
    tax_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL,
    tracking_number TEXT,
    tracking_carrier TEXT,
    customer_notes TEXT,
    admin_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email);

-- ── Order Items ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    variant_size TEXT NOT NULL,
    variant_color TEXT NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    line_total_cents INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ── Admin Users ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'admin',
    is_active INTEGER NOT NULL DEFAULT 1,
    last_login TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ── Audit Log ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES admin_users(id),
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    old_value TEXT,
    new_value TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);

-- ── Settings (key-value store) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_by TEXT,
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

INSERT INTO settings (key, value) VALUES
    ('store_announcement', ''),
    ('order_number_prefix', 'ELD'),
    ('shipping_flat_rate_cents', '1200'),
    ('shipping_free_threshold_cents', '15000'),
    ('tax_rate', '0');


-- From 002_promo_codes.sql
-- Promo / Discount Codes

CREATE TABLE IF NOT EXISTS promo_codes (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE ,
    description TEXT,
    discount_type TEXT NOT NULL DEFAULT 'percent',  -- 'percent' | 'fixed_cents'
    discount_value INTEGER NOT NULL,                -- percent (10 = 10%) or cents (500 = $5.00)
    minimum_order_cents INTEGER DEFAULT 0,
    max_uses INTEGER,                               -- NULL = unlimited
    times_used INTEGER NOT NULL DEFAULT 0,
    starts_at TEXT,                                  -- NULL = immediately
    expires_at TEXT,                                 -- NULL = never
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_promo_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_active ON promo_codes(is_active, starts_at, expires_at);

-- Track which orders used which promo
ALTER TABLE orders ADD COLUMN promo_code TEXT;
ALTER TABLE orders ADD COLUMN discount_cents INTEGER NOT NULL DEFAULT 0;


-- From 003_newsletter.sql
-- Newsletter subscribers

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE ,
    is_active INTEGER NOT NULL DEFAULT 1,
    source TEXT NOT NULL DEFAULT 'website',
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_active ON newsletter_subscribers(is_active, created_at);


-- From 004_analytics.sql
-- Analytics measurement ID (GA4, e.g. G-XXXXXXXXXX)
INSERT INTO settings (key, value) VALUES ('analytics_id', '') ON CONFLICT (key) DO NOTHING;


-- From 005_order_enhancements.sql
-- Index for webhook lookups by stripe_session_id
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id);

-- Track Stripe event IDs for webhook idempotency
ALTER TABLE orders ADD COLUMN stripe_event_id TEXT;

-- Track when orders are cancelled/expired
ALTER TABLE orders ADD COLUMN cancelled_at TEXT;


-- From 006_customer_accounts.sql
-- Customer accounts: registration, login, addresses, order linkage

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE ,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_login TEXT,
    password_reset_token TEXT,
    password_reset_expires TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active);

CREATE TABLE IF NOT EXISTS customer_addresses (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    label TEXT NOT NULL DEFAULT 'Home',
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    line1 TEXT NOT NULL,
    line2 TEXT,
    city TEXT NOT NULL,
    province TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'CA',
    phone TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON customer_addresses(customer_id);

-- Link orders to customers (nullable — guest orders remain unlinked)
ALTER TABLE orders ADD COLUMN customer_id INTEGER REFERENCES customers(id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);


-- From 007_refunds.sql
-- Track refund details on orders
ALTER TABLE orders ADD COLUMN refund_amount_cents INTEGER;
ALTER TABLE orders ADD COLUMN stripe_refund_id TEXT;
ALTER TABLE orders ADD COLUMN refunded_at TEXT;
ALTER TABLE orders ADD COLUMN refund_reason TEXT;


-- From 008_wishlist.sql
-- Wishlist / favorites table
CREATE TABLE IF NOT EXISTS wishlist (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE(customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_customer ON wishlist(customer_id);


-- From 009_reviews.sql
-- Product reviews
CREATE TABLE IF NOT EXISTS product_reviews (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    body TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE(product_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON product_reviews(product_id, status);
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON product_reviews(customer_id);


-- From 010_related_products.sql
-- Related products (manual picks + algorithmic via co-purchase)
-- Admin can manually set related products; system also auto-generates from order data

CREATE TABLE IF NOT EXISTS related_products (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    related_product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'co_purchase' | 'same_category'
    score NUMERIC NOT NULL DEFAULT 1.0,               -- Higher = more relevant (for sorting)
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE(product_id, related_product_id)
);

CREATE INDEX IF NOT EXISTS idx_related_product ON related_products(product_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_related_type ON related_products(relation_type);


-- From 011_variant_images.sql
-- Link images to specific variants (color swatches)
-- When a variant_id is set, the image shows only when that variant's color is selected
-- Images with NULL variant_id remain as general product images

ALTER TABLE product_images ADD COLUMN variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_images_variant ON product_images(variant_id);


-- From 012_back_in_stock.sql
-- Back-in-stock notification subscriptions
-- Customers (or guest emails) subscribe to be notified when a variant is restocked

CREATE TABLE IF NOT EXISTS back_in_stock_subscriptions (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    notified_at TEXT,          -- NULL until notification sent
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE(email, variant_id)  -- One subscription per email per variant
);

CREATE INDEX IF NOT EXISTS idx_bis_variant ON back_in_stock_subscriptions(variant_id, notified_at);
CREATE INDEX IF NOT EXISTS idx_bis_email ON back_in_stock_subscriptions(email);


-- From 013_automatic_discounts.sql
-- Automatic discounts — applied without a code based on rules
-- Types: percentage_off, fixed_off, buy_x_get_y

CREATE TABLE IF NOT EXISTS automatic_discounts (
    id SERIAL PRIMARY KEY,
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
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_auto_discount_active ON automatic_discounts(is_active, starts_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_auto_discount_applies ON automatic_discounts(applies_to, applies_to_id);


-- From 014_abandoned_carts.sql
-- Server-side cart persistence for abandoned cart recovery
-- Carts are created when a customer starts checkout or is logged in

CREATE TABLE IF NOT EXISTS carts (
    id SERIAL PRIMARY KEY,
    cart_token TEXT NOT NULL UNIQUE,                 -- UUID token stored in cookie
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    customer_email TEXT,                             -- Captured early in checkout flow
    customer_name TEXT,
    status TEXT NOT NULL DEFAULT 'active',           -- 'active' | 'abandoned' | 'recovered' | 'converted'
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    reminder_sent_1h INTEGER NOT NULL DEFAULT 0,    -- Flag: 1h reminder sent
    reminder_sent_24h INTEGER NOT NULL DEFAULT 0,   -- Flag: 24h reminder sent
    reminder_sent_72h INTEGER NOT NULL DEFAULT 0,   -- Flag: 72h reminder sent
    last_activity_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS cart_items (
    id SERIAL PRIMARY KEY,
    cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    added_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    UNIQUE(cart_id, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_carts_token ON carts(cart_token);
CREATE INDEX IF NOT EXISTS idx_carts_customer ON carts(customer_id);
CREATE INDEX IF NOT EXISTS idx_carts_status ON carts(status, last_activity_at);
CREATE INDEX IF NOT EXISTS idx_carts_abandoned ON carts(status, reminder_sent_1h, last_activity_at);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);


-- From 015_fulfillments.sql
-- Partial fulfillment support: multiple shipments per order

CREATE TABLE IF NOT EXISTS fulfillments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    tracking_number TEXT,
    tracking_carrier TEXT,
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'shipped' | 'delivered'
    shipped_at TEXT,
    delivered_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS fulfillment_items (
    id SERIAL PRIMARY KEY,
    fulfillment_id INTEGER NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
    order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    UNIQUE(fulfillment_id, order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_fulfillments_order ON fulfillments(order_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_items_fulfillment ON fulfillment_items(fulfillment_id);


-- From 016_staff_roles.sql
-- Staff roles and permissions
-- Roles: owner (all), editor (products/collections/content), fulfillment (orders/shipping only)

ALTER TABLE admin_users ADD COLUMN permissions TEXT NOT NULL DEFAULT 'all';
-- permissions is a comma-separated list or 'all'
-- Valid permissions: products, orders, collections, categories, promos, settings, customers, reports

-- Add staff invite tracking
ALTER TABLE admin_users ADD COLUMN invited_by INTEGER REFERENCES admin_users(id);
ALTER TABLE admin_users ADD COLUMN invite_accepted_at TEXT;


-- From 017_blog_pages.sql
-- Blog / CMS pages

CREATE TABLE IF NOT EXISTS pages (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    content_html TEXT NOT NULL DEFAULT '',
    meta_title TEXT,
    meta_description TEXT,
    featured_image_url TEXT,
    page_type TEXT NOT NULL DEFAULT 'page',  -- 'page' | 'blog_post'
    status TEXT NOT NULL DEFAULT 'draft',    -- 'draft' | 'published'
    author TEXT,
    noindex BOOLEAN DEFAULT FALSE,
    canonical_url TEXT,
    external_id TEXT UNIQUE,                 -- for social sync dedup (e.g. 'ig-12345')
    published_at TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug);
CREATE INDEX IF NOT EXISTS idx_pages_type_status ON pages(page_type, status);
CREATE INDEX IF NOT EXISTS idx_pages_published ON pages(published_at);


-- From 018_product_tags.sql
-- Product tags for filtering and organization

CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS product_tags (
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_product_tags_tag ON product_tags(tag_id);


-- From 019_customer_segments.sql
-- Customer segments for targeted marketing

CREATE TABLE IF NOT EXISTS customer_segments (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    rules_json TEXT,  -- JSON rules for auto-segmentation (e.g. order_count > 3, total_spent > 10000)
    is_auto INTEGER NOT NULL DEFAULT 0,  -- 1 = auto-populated from rules, 0 = manual
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS customer_segment_members (
    segment_id INTEGER NOT NULL REFERENCES customer_segments(id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    added_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    PRIMARY KEY (segment_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_segment_members_customer ON customer_segment_members(customer_id);


-- From 020_size_guide.sql
-- Size guide per product or category

CREATE TABLE IF NOT EXISTS size_guides (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    measurements_json TEXT NOT NULL,  -- JSON: [{"size":"S","chest_cm":88,"length_cm":70}, ...]
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);


-- From 021_gift_cards.sql
-- Gift cards

CREATE TABLE IF NOT EXISTS gift_cards (
    id SERIAL PRIMARY KEY,
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
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS gift_card_transactions (
    id SERIAL PRIMARY KEY,
    gift_card_id INTEGER NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL,  -- negative = redemption, positive = load
    order_id INTEGER REFERENCES orders(id),
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
CREATE INDEX IF NOT EXISTS idx_gc_transactions_card ON gift_card_transactions(gift_card_id);


-- From 022_loyalty_points.sql
-- Loyalty / points program

ALTER TABLE customers ADD COLUMN loyalty_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN lifetime_points INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,  -- positive = earned, negative = redeemed
    reason TEXT NOT NULL,     -- 'purchase', 'redemption', 'bonus', 'adjustment'
    order_id INTEGER REFERENCES orders(id),
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS loyalty_rules (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    points_per_dollar INTEGER NOT NULL DEFAULT 1,  -- Points earned per dollar spent
    redemption_rate_cents INTEGER NOT NULL DEFAULT 1,  -- Cents per point when redeeming
    minimum_points_redeem INTEGER NOT NULL DEFAULT 100,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer ON loyalty_transactions(customer_id);


-- From 023_product_bundles.sql
-- Product bundles (buy together at a discount)

CREATE TABLE IF NOT EXISTS bundles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    discount_type TEXT NOT NULL DEFAULT 'percentage',  -- 'percentage' | 'fixed_cents'
    discount_value INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS bundle_items (
    id SERIAL PRIMARY KEY,
    bundle_id INTEGER NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    default_variant_id INTEGER REFERENCES product_variants(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    UNIQUE(bundle_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_bundle_items_bundle ON bundle_items(bundle_id);


-- From 024_utm_tracking.sql
-- UTM tracking on orders for marketing attribution

ALTER TABLE orders ADD COLUMN utm_source TEXT;
ALTER TABLE orders ADD COLUMN utm_medium TEXT;
ALTER TABLE orders ADD COLUMN utm_campaign TEXT;


-- From 025_events.sql
-- Server-side event log for analytics / conversion funnel

CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,  -- 'product_viewed', 'add_to_cart', 'checkout_started', 'checkout_completed'
    session_id TEXT,
    customer_id INTEGER,
    product_id INTEGER,
    variant_id INTEGER,
    order_id INTEGER,
    metadata_json TEXT,  -- arbitrary JSON payload
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);


-- From 026_returns.sql
-- Return / exchange requests

CREATE TABLE IF NOT EXISTS return_requests (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    customer_id INTEGER REFERENCES customers(id),
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'received', 'refunded'
    reason TEXT NOT NULL,
    details TEXT,
    admin_notes TEXT,
    resolution TEXT,  -- 'refund', 'exchange', 'store_credit'
    refund_amount_cents INTEGER,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS return_items (
    id SERIAL PRIMARY KEY,
    return_request_id INTEGER NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
    order_item_id INTEGER NOT NULL REFERENCES order_items(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_return_requests_order ON return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON return_requests(status);
CREATE INDEX IF NOT EXISTS idx_return_items_request ON return_items(return_request_id);


-- From 027_webhooks.sql
-- Outbound event webhooks

CREATE TABLE IF NOT EXISTS webhooks (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    events TEXT NOT NULL,  -- comma-separated: 'order.completed,customer.created'
    secret TEXT,           -- optional HMAC secret for signature verification
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id SERIAL PRIMARY KEY,
    webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    success INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON webhook_deliveries(created_at);


-- From 028_product_weight.sql
-- Add weight field to products for accurate Canada Post shipping rates.
-- Weight in grams (integer) — easier for staff than decimals.
-- NULL means "use default" from config (default_parcel_weight_kg).

ALTER TABLE products ADD COLUMN weight_g INTEGER;


-- From 029_product_seo.sql
-- Add SEO fields to products for search engine optimization.
-- meta_title: custom page title (falls back to product name if NULL)
-- meta_description: custom meta description for search results

ALTER TABLE products ADD COLUMN meta_title TEXT;
ALTER TABLE products ADD COLUMN meta_description TEXT;


