-- Cedar & Sage Custom Pricing and Order Requests migration

-- Add custom fields to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS pricing_mode TEXT NOT NULL DEFAULT 'fixed' 
  CONSTRAINT chk_products_pricing_mode CHECK (pricing_mode IN ('fixed', 'starting_at', 'quote_only', 'seasonal', 'unavailable'));

ALTER TABLE products ADD COLUMN IF NOT EXISTS availability_status TEXT NOT NULL DEFAULT 'available' 
  CONSTRAINT chk_products_availability_status CHECK (availability_status IN ('available', 'sold_out', 'preorder_only', 'weekend_only', 'seasonal', 'quote_only', 'unavailable', 'hidden'));

ALTER TABLE products ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_preorder_only BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_weekend_only BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_quote_only BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS allergy_notes TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS pickup_notes TEXT;

-- Create order_requests table
CREATE TABLE IF NOT EXISTS order_requests (
    id SERIAL PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    preferred_contact_method TEXT NOT NULL,
    requested_items JSONB NOT NULL,
    desired_date DATE,
    pickup_or_delivery TEXT NOT NULL DEFAULT 'pickup',
    allergy_notes TEXT,
    special_instructions TEXT,
    status TEXT NOT NULL DEFAULT 'new' CONSTRAINT chk_order_requests_status CHECK (status IN ('new', 'reviewed', 'waiting_on_customer', 'confirmed', 'completed', 'cancelled')),
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for order_requests on status and created_at
CREATE INDEX IF NOT EXISTS idx_order_requests_status ON order_requests(status);
CREATE INDEX IF NOT EXISTS idx_order_requests_created_at ON order_requests(created_at DESC);

-- Seed default Homestead settings content
INSERT INTO settings (key, value) VALUES 
  ('about_content', 'Welcome to Cedar & Sage Homestead. We bake fresh small-batch goods and handcraft homestead care items.'),
  ('faq_content', 'Q: How do I order?\nA: Submit an order request, and we will email you to confirm pickup/delivery and e-transfer details.'),
  ('pickup_instructions', 'Pickups are at the Homestead on Saturdays between 10am and 2pm. Please coordinate in advance.'),
  ('payment_instructions', 'We accept e-Transfers. Please send payment to payments@cedarandsagehomestead.ca after receiving order confirmation.'),
  ('allergy_disclaimer', 'Our products are baked in a kitchen that handles wheat, nuts, dairy, and eggs.'),
  ('preorder_instructions', 'Preorders close on Wednesday evenings for Saturday baking. Standard lead time is 3 days.')
ON CONFLICT (key) DO NOTHING;
