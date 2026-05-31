-- Add SEO fields to products for search engine optimization.
-- meta_title: custom page title (falls back to product name if NULL)
-- meta_description: custom meta description for search results

ALTER TABLE products ADD COLUMN meta_title TEXT;
ALTER TABLE products ADD COLUMN meta_description TEXT;
