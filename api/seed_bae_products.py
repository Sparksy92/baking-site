"""
BadAss Elder — product seed script
Run from: /home/rezzer/dev/badasselder-web/api/
Usage:  python seed_bae_products.py [--reset]

--reset   Deletes existing products before inserting (use only in dev).
          Without --reset, script is safe to re-run (upserts by slug).
"""
import asyncio
import os
import sys
import asyncpg

_user = os.environ.get("POSTGRES_USER", "ecommerce")
_pass = os.environ.get("POSTGRES_PASSWORD", "ecommerce_password")
_host = os.environ.get("POSTGRES_HOST", "localhost")
_port = os.environ.get("POSTGRES_PORT", "5432")
_db   = os.environ.get("POSTGRES_DB", "badasselder")
DB_URL = f"postgresql://{_user}:{_pass}@{_host}:{_port}/{_db}"

CATEGORY_NAMES = ["t-shirts", "hoodies", "accessories"]

# ── Product catalogue ─────────────────────────────────────────────────────────
# Tone: grounded, premium, elder-inspired. No stereotype-heavy imagery.
# ── First drop: hoodies and tees only ────────────────────────────────────────
# BAE letter-badge placeholder images reference /images/products/<slug>.svg
# No accessories, no hats, no totes — not in first drop.
PRODUCTS = [
    # ── TEES ─────────────────────────────────────────────────────────────────
    {
        "name": "Still Standing Tee",
        "slug": "still-standing-tee",
        "description": (
            "Heavyweight 100% cotton tee. Washed for softness, built for daily wear. "
            "Front: 'Still Standing' in bold type. Back: 'BadAss Elder' wordmark. "
            "For the ones who kept going when it would have been easier not to."
        ),
        "category_slug": "t-shirts",
        "image_url": "/images/products/still-standing-tee.webp",
        "is_active": True,
        "is_featured": True,
        "tags": ["featured", "first-drop", "tee", "new-arrivals"],
        "variants": [
            {"size": "S",   "color": "Deep Pine",      "sku": "BAE-SST-PINE-S",  "price_cents": 4800, "stock": 25},
            {"size": "M",   "color": "Deep Pine",      "sku": "BAE-SST-PINE-M",  "price_cents": 4800, "stock": 40},
            {"size": "L",   "color": "Deep Pine",      "sku": "BAE-SST-PINE-L",  "price_cents": 4800, "stock": 35},
            {"size": "XL",  "color": "Deep Pine",      "sku": "BAE-SST-PINE-XL", "price_cents": 4800, "stock": 20},
            {"size": "XXL", "color": "Deep Pine",      "sku": "BAE-SST-PINE-2XL","price_cents": 5000, "stock": 10},
            {"size": "S",   "color": "Bone",           "sku": "BAE-SST-BONE-S",  "price_cents": 4800, "stock": 18},
            {"size": "M",   "color": "Bone",           "sku": "BAE-SST-BONE-M",  "price_cents": 4800, "stock": 25},
            {"size": "L",   "color": "Bone",           "sku": "BAE-SST-BONE-L",  "price_cents": 4800, "stock": 20},
            {"size": "XL",  "color": "Bone",           "sku": "BAE-SST-BONE-XL", "price_cents": 4800, "stock": 12},
        ],
    },
    {
        "name": "Healing Is Badass Tee",
        "slug": "healing-is-badass-tee",
        "description": (
            "Heavyweight garment-dyed tee. Soft, broken-in feel from day one. "
            "Front: 'Healing Is Badass' — because it is. "
            "For the ones still healing, still laughing, still standing."
        ),
        "category_slug": "t-shirts",
        "image_url": "/images/products/healing-is-badass-tee.webp",
        "is_active": True,
        "is_featured": True,
        "tags": ["featured", "first-drop", "tee", "new-arrivals"],
        "variants": [
            {"size": "S",   "color": "Charcoal Olive", "sku": "BAE-HIB-OLV-S",  "price_cents": 4800, "stock": 20},
            {"size": "M",   "color": "Charcoal Olive", "sku": "BAE-HIB-OLV-M",  "price_cents": 4800, "stock": 35},
            {"size": "L",   "color": "Charcoal Olive", "sku": "BAE-HIB-OLV-L",  "price_cents": 4800, "stock": 28},
            {"size": "XL",  "color": "Charcoal Olive", "sku": "BAE-HIB-OLV-XL", "price_cents": 4800, "stock": 18},
            {"size": "XXL", "color": "Charcoal Olive", "sku": "BAE-HIB-OLV-2XL","price_cents": 5000, "stock": 8},
            {"size": "S",   "color": "Ink",            "sku": "BAE-HIB-INK-S",  "price_cents": 4800, "stock": 15},
            {"size": "M",   "color": "Ink",            "sku": "BAE-HIB-INK-M",  "price_cents": 4800, "stock": 22},
            {"size": "L",   "color": "Ink",            "sku": "BAE-HIB-INK-L",  "price_cents": 4800, "stock": 18},
            {"size": "XL",  "color": "Ink",            "sku": "BAE-HIB-INK-XL", "price_cents": 4800, "stock": 10},
        ],
    },
    {
        "name": "Elder Energy Tee",
        "slug": "elder-energy-tee",
        "description": (
            "Heavyweight 100% cotton tee. Washed for softness. "
            "Front: 'Elder Energy. Survivor Spirit.' — two lines, bold type. "
            "Back: 'BadAss Elder' in small tonal print. "
            "For people who carry something other people can feel."
        ),
        "category_slug": "t-shirts",
        "image_url": "/images/products/elder-energy-tee.webp",
        "is_active": True,
        "is_featured": True,
        "tags": ["featured", "first-drop", "tee", "bestseller"],
        "variants": [
            {"size": "S",   "color": "Deep Pine",  "sku": "BAE-EET-PINE-S",  "price_cents": 4800, "stock": 25},
            {"size": "M",   "color": "Deep Pine",  "sku": "BAE-EET-PINE-M",  "price_cents": 4800, "stock": 40},
            {"size": "L",   "color": "Deep Pine",  "sku": "BAE-EET-PINE-L",  "price_cents": 4800, "stock": 35},
            {"size": "XL",  "color": "Deep Pine",  "sku": "BAE-EET-PINE-XL", "price_cents": 4800, "stock": 20},
            {"size": "XXL", "color": "Deep Pine",  "sku": "BAE-EET-PINE-2XL","price_cents": 5000, "stock": 8},
            {"size": "S",   "color": "Ink",        "sku": "BAE-EET-INK-S",   "price_cents": 4800, "stock": 18},
            {"size": "M",   "color": "Ink",        "sku": "BAE-EET-INK-M",   "price_cents": 4800, "stock": 25},
            {"size": "L",   "color": "Ink",        "sku": "BAE-EET-INK-L",   "price_cents": 4800, "stock": 20},
            {"size": "XL",  "color": "Ink",        "sku": "BAE-EET-INK-XL",  "price_cents": 4800, "stock": 12},
        ],
    },
    # ── HOODIES ──────────────────────────────────────────────────────────────
    {
        "name": "Still Standing Hoodie",
        "slug": "still-standing-hoodie",
        "description": (
            "Brushed fleece pullover hoodie. Drop shoulder, kangaroo pocket, ribbed cuffs. "
            "Front chest: 'Still Standing' in bold type. "
            "For the ones still healing, still laughing, still standing."
        ),
        "category_slug": "hoodies",
        "image_url": "/images/products/still-standing-hoodie.webp",
        "is_active": True,
        "is_featured": True,
        "tags": ["featured", "first-drop", "hoodie", "new-arrivals"],
        "variants": [
            {"size": "S",   "color": "Deep Pine",      "sku": "BAE-SSH-PINE-S",  "price_cents": 8900, "stock": 15},
            {"size": "M",   "color": "Deep Pine",      "sku": "BAE-SSH-PINE-M",  "price_cents": 8900, "stock": 22},
            {"size": "L",   "color": "Deep Pine",      "sku": "BAE-SSH-PINE-L",  "price_cents": 8900, "stock": 18},
            {"size": "XL",  "color": "Deep Pine",      "sku": "BAE-SSH-PINE-XL", "price_cents": 8900, "stock": 12},
            {"size": "XXL", "color": "Deep Pine",      "sku": "BAE-SSH-PINE-2XL","price_cents": 9400, "stock": 6},
            {"size": "S",   "color": "Charcoal Olive", "sku": "BAE-SSH-OLV-S",   "price_cents": 8900, "stock": 12},
            {"size": "M",   "color": "Charcoal Olive", "sku": "BAE-SSH-OLV-M",   "price_cents": 8900, "stock": 18},
            {"size": "L",   "color": "Charcoal Olive", "sku": "BAE-SSH-OLV-L",   "price_cents": 8900, "stock": 14},
            {"size": "XL",  "color": "Charcoal Olive", "sku": "BAE-SSH-OLV-XL",  "price_cents": 8900, "stock": 10},
            {"size": "XXL", "color": "Charcoal Olive", "sku": "BAE-SSH-OLV-2XL", "price_cents": 9400, "stock": 4},
        ],
    },
    {
        "name": "Carry The Fire Hoodie",
        "slug": "carry-the-fire-hoodie",
        "description": (
            "Midweight fleece pullover hoodie. Relaxed fit. "
            "Front: 'Carry The Fire' in arc type across the chest. "
            "Back: 'BadAss Elder' small tonal print at hem. "
            "Keep going. Pass it on."
        ),
        "category_slug": "hoodies",
        "image_url": "/images/products/carry-the-fire-hoodie.webp",
        "is_active": True,
        "is_featured": True,
        "tags": ["featured", "first-drop", "hoodie"],
        "variants": [
            {"size": "S",   "color": "Charcoal Olive", "sku": "BAE-CTF-OLV-S",  "price_cents": 8900, "stock": 18},
            {"size": "M",   "color": "Charcoal Olive", "sku": "BAE-CTF-OLV-M",  "price_cents": 8900, "stock": 25},
            {"size": "L",   "color": "Charcoal Olive", "sku": "BAE-CTF-OLV-L",  "price_cents": 8900, "stock": 20},
            {"size": "XL",  "color": "Charcoal Olive", "sku": "BAE-CTF-OLV-XL", "price_cents": 8900, "stock": 14},
            {"size": "XXL", "color": "Charcoal Olive", "sku": "BAE-CTF-OLV-2XL","price_cents": 9400, "stock": 6},
            {"size": "S",   "color": "Ink",            "sku": "BAE-CTF-INK-S",  "price_cents": 8900, "stock": 12},
            {"size": "M",   "color": "Ink",            "sku": "BAE-CTF-INK-M",  "price_cents": 8900, "stock": 18},
            {"size": "L",   "color": "Ink",            "sku": "BAE-CTF-INK-L",  "price_cents": 8900, "stock": 15},
            {"size": "XL",  "color": "Ink",            "sku": "BAE-CTF-INK-XL", "price_cents": 8900, "stock": 10},
        ],
    },
    {
        "name": "Raw Apparel Hoodie",
        "slug": "raw-apparel-hoodie",
        "description": (
            "Heavyweight fleece pullover hoodie. Boxy fit, oversized feel. "
            "Full chest: 'Raw apparel for people who earned their scars.' "
            "Small back-hem print: 'by Elder Energy Apparel'. "
            "No filter. No apology. Just the truth."
        ),
        "category_slug": "hoodies",
        "image_url": "/images/products/raw-apparel-hoodie.webp",
        "is_active": True,
        "is_featured": True,
        "tags": ["first-drop", "hoodie", "new-arrivals"],
        "variants": [
            {"size": "S",   "color": "Ink",       "sku": "BAE-RAH-INK-S",  "price_cents": 8900, "stock": 15},
            {"size": "M",   "color": "Ink",       "sku": "BAE-RAH-INK-M",  "price_cents": 8900, "stock": 22},
            {"size": "L",   "color": "Ink",       "sku": "BAE-RAH-INK-L",  "price_cents": 8900, "stock": 18},
            {"size": "XL",  "color": "Ink",       "sku": "BAE-RAH-INK-XL", "price_cents": 8900, "stock": 12},
            {"size": "XXL", "color": "Ink",       "sku": "BAE-RAH-INK-2XL","price_cents": 9400, "stock": 6},
            {"size": "S",   "color": "Deep Pine", "sku": "BAE-RAH-PNE-S",  "price_cents": 8900, "stock": 10},
            {"size": "M",   "color": "Deep Pine", "sku": "BAE-RAH-PNE-M",  "price_cents": 8900, "stock": 15},
            {"size": "L",   "color": "Deep Pine", "sku": "BAE-RAH-PNE-L",  "price_cents": 8900, "stock": 12},
            {"size": "XL",  "color": "Deep Pine", "sku": "BAE-RAH-PNE-XL", "price_cents": 8900, "stock": 8},
        ],
    },
]


async def seed(reset: bool = False):
    conn = await asyncpg.connect(DB_URL)
    try:
        if reset:
            print("⚠️  --reset: removing existing products, variants, and images...")
            await conn.execute("DELETE FROM product_images")
            await conn.execute("DELETE FROM product_tags")
            await conn.execute("DELETE FROM product_variants")
            await conn.execute("DELETE FROM products")
            print("   Done — tables cleared.\n")

        # Upsert categories and build slug → id map
        categories = {}
        for name in CATEGORY_NAMES:
            slug = name.lower().replace(" ", "-")
            row = await conn.fetchrow(
                "INSERT INTO categories (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id",
                name, slug,
            )
            categories[slug] = row["id"]
            print(f"  category [{row['id']}] {name}")

        for prod in PRODUCTS:
            category_id = categories[prod["category_slug"]]
            # Upsert product
            row = await conn.fetchrow(
                """
                INSERT INTO products (name, slug, description, category_id, is_active, is_featured)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (slug) DO UPDATE SET
                    name        = EXCLUDED.name,
                    description = EXCLUDED.description,
                    is_active   = EXCLUDED.is_active,
                    is_featured = EXCLUDED.is_featured,
                    updated_at  = NOW()
                RETURNING id, name, slug
                """,
                prod["name"],
                prod["slug"],
                prod["description"],
                category_id,
                bool(prod["is_active"]),
                bool(prod["is_featured"]),
            )
            product_id = row["id"]
            print(f"✓ Product [{product_id}] {row['name']} ({row['slug']})")

            # Primary image — insert into product_images
            if prod.get("image_url"):
                await conn.execute(
                    """
                    INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary)
                    VALUES ($1, $2, $3, 0, TRUE)
                    """,
                    product_id,
                    prod["image_url"],
                    prod["name"],
                )
                print(f"    image  → {prod['image_url']}")

            # Tags — ensure tag rows exist, link to product
            for tag_name in prod.get("tags", []):
                tag_row = await conn.fetchrow(
                    "INSERT INTO tags (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id",
                    tag_name, tag_name.lower().replace(" ", "-")
                )
                await conn.execute(
                    "INSERT INTO product_tags (product_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                    product_id, tag_row["id"]
                )

            # Variants — upsert by SKU
            for v in prod["variants"]:
                vrow = await conn.fetchrow(
                    """
                    INSERT INTO product_variants (product_id, sku, size, color, price_cents, stock_quantity, is_active)
                    VALUES ($1, $2, $3, $4, $5, $6, TRUE)
                    ON CONFLICT (sku) DO UPDATE SET
                        size           = EXCLUDED.size,
                        color          = EXCLUDED.color,
                        price_cents    = EXCLUDED.price_cents,
                        stock_quantity = EXCLUDED.stock_quantity,
                        updated_at     = NOW()
                    RETURNING id, sku, size, color, stock_quantity
                    """,
                    product_id,
                    v["sku"],
                    v["size"],
                    v["color"],
                    v["price_cents"],
                    v["stock"],
                )
                print(f"    variant [{vrow['id']}] {vrow['size']} / {vrow['color']} — stock {vrow['stock_quantity']}")

        print("\n✅ Seed complete.")
    finally:
        await conn.close()


if __name__ == "__main__":
    reset_flag = "--reset" in sys.argv
    asyncio.run(seed(reset=reset_flag))
