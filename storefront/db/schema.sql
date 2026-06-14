-- Cedar & Sage Homestead Vercel-Lite Database Schema

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS menu_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    description TEXT,
    image_url TEXT,
    price_cents INTEGER NOT NULL DEFAULT 0,
    pricing_mode VARCHAR(50) NOT NULL DEFAULT 'fixed', -- fixed, starting_at, quote_only, seasonal
    availability_status VARCHAR(50) NOT NULL DEFAULT 'available', -- available, preorder, weekend_only, sold_out, seasonal, hidden
    lead_time_days INTEGER NOT NULL DEFAULT 0,
    allergy_notes TEXT,
    pickup_notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS order_requests (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    requested_items JSONB NOT NULL,
    desired_date DATE,
    pickup_or_delivery VARCHAR(50) NOT NULL DEFAULT 'pickup',
    preferred_contact_method VARCHAR(50) NOT NULL DEFAULT 'email',
    allergy_notes TEXT,
    special_instructions TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'new', -- new, reviewed, quoted, accepted, completed, cancelled
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT
);
