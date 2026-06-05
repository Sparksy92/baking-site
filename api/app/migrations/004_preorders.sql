-- Migration 004: Pre-orders + scheduled drop publishing
--
-- Products: allow_preorder flag (show "Pre-order" CTA instead of "Sold Out")
-- Variants:  available_at timestamp (NULL = available now, future = scheduled drop)
-- Products:  available_at timestamp for whole-product drops

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS allow_preorder   BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS available_at     TIMESTAMPTZ          DEFAULT NULL;

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS available_at     TIMESTAMPTZ          DEFAULT NULL;

-- Index for scheduled drop queries (find variants going live soon)
CREATE INDEX IF NOT EXISTS idx_variants_available_at
  ON product_variants (available_at)
  WHERE available_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_available_at
  ON products (available_at)
  WHERE available_at IS NOT NULL;
