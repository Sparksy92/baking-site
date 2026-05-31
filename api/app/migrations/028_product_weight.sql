-- Add weight field to products for accurate Canada Post shipping rates.
-- Weight in grams (integer) — easier for staff than decimals.
-- NULL means "use default" from config (default_parcel_weight_kg).

ALTER TABLE products ADD COLUMN weight_g INTEGER;
