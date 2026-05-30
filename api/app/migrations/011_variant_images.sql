-- Link images to specific variants (color swatches)
-- When a variant_id is set, the image shows only when that variant's color is selected
-- Images with NULL variant_id remain as general product images

ALTER TABLE product_images ADD COLUMN variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL;

CREATE INDEX idx_images_variant ON product_images(variant_id);
