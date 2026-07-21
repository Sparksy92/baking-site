-- Sprint 12: Product tags for FB/IG Shopping (JSON array of {product_id, merchant_id, name, url})
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS product_tags JSONB;
