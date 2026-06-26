"""CLI utilities for clothing-ecommerce-baseline.

Usage:
    python cli.py create-admin
    python cli.py seed-admin --username EMAIL --password PASS [--display-name NAME] [--role ROLE]
    python cli.py seed
"""
from __future__ import annotations

import argparse
import asyncio
import getpass
import os
import sys

# Ensure app is importable
sys.path.insert(0, os.path.dirname(__file__))


async def create_admin():
    """Create the first admin user interactively."""
    from app.config import get_settings
    from app.database import init_db, db_connection
    from app.auth import hash_password

    settings = get_settings()
    await init_db()

    print("── Create Admin User ──")
    username = input("Username: ").strip()
    if not username:
        print("Error: username cannot be empty")
        return

    password = getpass.getpass("Password: ")
    if len(password) < 6:
        print("Error: password must be at least 6 characters")
        return

    confirm = getpass.getpass("Confirm password: ")
    if password != confirm:
        print("Error: passwords don't match")
        return

    display_name = input("Display name (optional): ").strip() or None

    pw_hash = hash_password(password)

    async with db_connection() as db:
        try:
            await db.execute(
                "INSERT INTO admin_users (username, password_hash, display_name, role) VALUES ($1, $2, $3, $4)",
                (username, pw_hash, display_name, "owner"),
            )
            print(f"\nSuccess: Admin user '{username}' created with role 'owner'")
        except Exception as e:
            if "UNIQUE" in str(e) or "unique constraint" in str(e).lower():
                print(f"Error: username '{username}' already exists")
            else:
                print(f"Error: {e}")


async def seed_admin(username: str, password: str, display_name: str | None, role: str):
    """Non-interactive admin user creation for CI/CD and Ansible deployments."""
    from app.database import init_db, db_connection
    from app.auth import hash_password

    await init_db()
    pw_hash = hash_password(password)

    async with db_connection() as db:
        try:
            await db.execute(
                "INSERT INTO admin_users (username, password_hash, display_name, role) VALUES ($1, $2, $3, $4)",
                (username, pw_hash, display_name, role),
            )
            print(f"created: admin user '{username}' with role '{role}'")
        except Exception as e:
            if "UNIQUE" in str(e) or "unique constraint" in str(e).lower() or "duplicate key" in str(e).lower():
                print(f"exists: admin user '{username}' already exists — skipping")
            else:
                print(f"error: {e}")
                sys.exit(1)


async def seed():
    """Insert sample products, categories, and collections for Sage & Sweetgrass Homestead."""
    from app.config import get_settings
    from app.database import init_db, db_connection

    settings = get_settings()
    await init_db()

    async with db_connection() as db:
        # 1. Categories Seeding
        categories_data = [
            ("Baked Fresh", "baked-fresh", "Fresh breads, buns, bagels, sandwich loaves, cinnamon rolls, and weekend sourdough preorders.", 0),
            ("Desserts", "desserts", "Small-batch desserts, muffins, banana bread, cookies, cheesecakes, and special requests.", 1),
            ("Pantry", "pantry", "Homemade pantry goods, preserves, pickled goods, dried mixes, simmer pots, and seasonal bundles.", 2),
            ("Home & Body", "home-body", "Handmade homestead care products including lotions, lip balms, salves, and herbal oils.", 3),
            ("Oven Fund", "oven-fund", "Support Sage & Sweetgrass Homestead’s equipment and baking capacity goals.", 4),
        ]
        
        category_ids = {}
        for name, slug, desc, sort in categories_data:
            cursor = await db.execute("SELECT id FROM categories WHERE slug = ?", (slug,))
            row = await cursor.fetchone()
            if row:
                category_id = row[0]
                await db.execute("UPDATE categories SET name = ?, description = ?, sort_order = ? WHERE id = ?", (name, desc, sort, category_id))
            else:
                cursor = await db.execute("INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)", (name, slug, desc, sort))
                category_id = cursor.lastrowid
            category_ids[slug] = category_id

        # 2. Products Seeding
        # Product tuples: (name, slug, description, category_slug, is_active, is_featured, sort_order, pricing_mode, availability_status, lead_time_days, is_preorder, is_weekend, is_quote, allergy_notes, pickup_notes)
        products_data = [
            # BAKED FRESH
            ("Artisan Bread", "artisan-bread", "A homemade artisan-style loaf prepared in small batches. Submit a request and Kirstin will confirm availability, timing, and price.", 
             "baked-fresh", True, True, 0, "starting_at", "available", 2, False, False, False, "Contains gluten/wheat.", "Freshly baked on demand."),
            
            ("Sandwich Loaf", "sandwich-loaf", "A soft homemade sandwich loaf for everyday meals, toast, and packed lunches. Submit a request to confirm the next available baking day.", 
             "baked-fresh", True, False, 1, "starting_at", "available", 2, False, False, False, "Contains gluten/wheat, milk.", "Freshly baked on demand."),
            
            ("Bagels", "bagels", "Small-batch homemade bagels. Availability may depend on baking schedule and order volume.", 
             "baked-fresh", True, False, 2, "starting_at", "available", 2, False, False, False, "Contains gluten/wheat.", "Bagels are baked in batches."),
            
            ("Buns", "buns", "Soft homemade buns for dinners, sandwiches, and gatherings. Submit a request for quantity and timing.", 
             "baked-fresh", True, False, 3, "starting_at", "available", 2, False, False, False, "Contains gluten/wheat, egg.", "Soft buns baked fresh."),
            
            ("Sourdough", "sourdough", "Sourdough is available by preorder and is usually prepared on weekends. Submit a request to confirm the next bake window.", 
             "baked-fresh", True, True, 4, "starting_at", "preorder_only", 3, True, True, False, "Contains gluten/wheat. Wild yeast ferment.", "Weekend preorder item."),
            
            # DESSERTS
            ("Cinnamon Rolls", "cinnamon-rolls", "Soft homemade cinnamon rolls prepared in small batches. Request icing options and quantity when ordering.", 
             "desserts", True, True, 5, "starting_at", "available", 2, False, False, False, "Contains gluten/wheat, dairy, egg.", "Available with cream cheese or vanilla icing."),
            
            ("Banana Bread", "banana-bread", "Classic homemade banana bread. Add special requests such as chocolate chips or nuts in the order notes.", 
             "desserts", True, False, 6, "starting_at", "available", 1, False, False, False, "Contains gluten, egg, dairy. May contain nuts by request.", "Freshly baked loaf."),
            
            ("Muffins", "muffins", "Small-batch homemade muffins. Flavours may vary depending on availability and season.", 
             "desserts", True, False, 7, "starting_at", "available", 1, False, False, False, "Contains gluten, dairy, egg.", "Assorted seasonal flavours."),
            
            ("Basic Cookies", "basic-cookies", "Homemade cookies for everyday treats, gatherings, or small events. Submit a request for available flavours.", 
             "desserts", True, False, 8, "starting_at", "available", 1, False, False, False, "Contains gluten, dairy, egg.", "Baked fresh per dozen."),
            
            ("Special Cookies", "special-cookies", "Specialty cookies and custom cookie requests. Pricing and timing are confirmed after request review.", 
             "desserts", True, False, 9, "quote_only", "available", 3, False, False, False, "Contains wheat, dairy, egg. Custom allergens depend on request.", "Pricing confirmed after request review."),
            
            ("Cheesecakes", "cheesecakes", "Custom cheesecake requests are reviewed individually. Submit your flavour, size, and date needed so Kirstin can confirm price and availability.", 
             "desserts", True, False, 10, "quote_only", "quote_only", 3, False, False, True, "Contains dairy, gluten, egg.", "Hand-delivered or pickup only due to refrigeration requirements."),
            
            ("Custom Desserts", "custom-desserts", "Special desserts, custom requests, and event-style orders. Submit details and Kirstin will confirm availability, timing, and price.", 
             "desserts", True, False, 11, "quote_only", "quote_only", 3, False, False, True, "Allergens depend on custom design.", "Custom dessert consultation."),
            
            # PANTRY
            ("Jams / Jellies", "jams-jellies", "Homemade jams and jellies made seasonally. Availability depends on ingredients and batch timing.", 
             "pantry", True, False, 12, "seasonal", "seasonal", 0, False, False, False, "Natural fruits, pectin, sugar.", "Seasonal preserve selection."),
            
            ("Pickled Goods", "pickled-goods", "Seasonal pickled goods prepared in small batches. Submit a request to ask what is currently available.", 
             "pantry", True, False, 13, "seasonal", "seasonal", 0, False, False, False, "Vinegar brine.", "Seasonal pickle jars."),
            
            ("Simmer Pots", "simmer-pots", "Seasonal simmer pot blends for a warm homestead feel. Availability may vary by season.", 
             "pantry", True, False, 14, "seasonal", "seasonal", 0, False, False, False, "Dehydrated natural herbs and fruits.", "Stove top aromatherapy packs."),
            
            ("Dried Mix Jars", "dried-mix-jars", "Dried mix jars and pantry-style giftable goods. Submit a request for current availability.", 
             "pantry", True, False, 15, "seasonal", "seasonal", 0, False, False, False, "Allergens depend on specific jar mix (wheat/sugar).", "Gift jars."),
            
            ("Bundles", "bundles", "Custom bundles for gifting, gatherings, or seasonal specials. Pricing is confirmed after request review.", 
             "pantry", True, False, 16, "quote_only", "quote_only", 2, False, False, True, "Varies per bundle.", "Curated homestead collections."),
            
            # HOME & BODY
            ("Lotions", "lotions", "Handmade homestead care lotions. Submit a request for available sizes and scents.", 
             "home-body", True, False, 17, "starting_at", "available", 2, False, False, False, "Natural tallow/beeswax/oils.", "Tallow-based body lotions."),
            
            ("Lip Balms", "lip-balms", "Handmade lip balms prepared in small batches. Availability may vary by batch.", 
             "home-body", True, False, 18, "starting_at", "available", 1, False, False, False, "Natural beeswax, coconut oil.", "Homestead organic balms."),
            
            ("Salves", "salves", "Handmade salves prepared with simple homestead-inspired ingredients. Submit a request for current availability.", 
             "home-body", True, True, 19, "starting_at", "available", 2, False, False, False, "Natural herbal extracts, tallow, beeswax.", "Traditional soothing skin salves."),
            
            ("Herbal Oils", "herbal-oils", "Small-batch herbal oils. Availability and details are confirmed by request.", 
             "home-body", True, False, 20, "starting_at", "available", 2, False, False, False, "Essential oils, botanical carrier oils.", "Organic herbal extracts."),
             
            # OVEN FUND
            ("Oven Fund Support", "oven-fund-support", "Support Sage & Sweetgrass Homestead’s equipment and baking capacity goals. This is separate from product checkout.", 
             "oven-fund", True, True, 21, "quote_only", "quote_only", 0, False, False, True, "N/A", "Donations are processed separately from storefront orders.")
        ]

        product_ids = {}
        for name, slug, desc, cat_slug, active, featured, sort, pr_mode, av_status, lead, preorder, weekend, quote, allergy, pickup in products_data:
            cat_id = category_ids.get(cat_slug)
            
            cursor = await db.execute("SELECT id FROM products WHERE slug = ?", (slug,))
            row = await cursor.fetchone()
            if row:
                product_id = row[0]
                await db.execute("""
                    UPDATE products SET 
                        name = ?, description = ?, category_id = ?, is_active = ?, is_featured = ?, sort_order = ?,
                        pricing_mode = ?, availability_status = ?, lead_time_days = ?,
                        is_preorder_only = ?, is_weekend_only = ?, is_quote_only = ?,
                        allergy_notes = ?, pickup_notes = ?
                    WHERE id = ?
                """, (name, desc, cat_id, active, featured, sort, pr_mode, av_status, lead, preorder, weekend, quote, allergy, pickup, product_id))
            else:
                cursor = await db.execute("""
                    INSERT INTO products (
                        name, slug, description, category_id, is_active, is_featured, sort_order,
                        pricing_mode, availability_status, lead_time_days,
                        is_preorder_only, is_weekend_only, is_quote_only,
                        allergy_notes, pickup_notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (name, slug, desc, cat_id, active, featured, sort, pr_mode, av_status, lead, preorder, weekend, quote, allergy, pickup))
                product_id = cursor.lastrowid
            product_ids[slug] = product_id

        # 3. Product Options / Variants Seeding
        # We wipe variants for seeded products and write fresh, ensuring correct data and no stale data.
        product_variants = {
            # Baked Fresh
            "artisan-bread": [("Single loaf", "Classic", None, 600, 10, "CSH-BAK-ARTISAN-SINGLE", 0)],
            "sandwich-loaf": [("Single loaf", "Classic", None, 500, 10, "CSH-BAK-SANDWICH-SINGLE", 0)],
            "bagels": [
                ("Half dozen", "Classic", None, 800, 10, "CSH-BAK-BAGEL-HALF", 0),
                ("Dozen", "Classic", None, 1500, 10, "CSH-BAK-BAGEL-DOZEN", 1)
            ],
            "buns": [
                ("Half dozen", "Classic", None, 600, 10, "CSH-BAK-BUNS-HALF", 0),
                ("Dozen", "Classic", None, 1100, 10, "CSH-BAK-BUNS-DOZEN", 1)
            ],
            "sourdough": [("Single loaf", "Classic Sourdough", None, 900, 10, "CSH-BAK-SOURDOUGH-SINGLE", 0)],
            
            # Desserts
            "cinnamon-rolls": [
                ("Half dozen", "Plain", None, 1200, 10, "CSH-DES-CINNA-HALF-PLAIN", 0),
                ("Dozen", "Plain", None, 2200, 10, "CSH-DES-CINNA-DOZEN-PLAIN", 1),
                ("Half dozen", "Cream Cheese Icing", None, 1500, 10, "CSH-DES-CINNA-HALF-ICED", 2),
                ("Dozen", "Cream Cheese Icing", None, 2800, 10, "CSH-DES-CINNA-DOZEN-ICED", 3)
            ],
            "banana-bread": [("Single loaf", "Classic", None, 800, 10, "CSH-DES-BANANA-SINGLE", 0)],
            "muffins": [
                ("Half dozen", "Classic", None, 1000, 10, "CSH-DES-MUFFIN-HALF", 0),
                ("Dozen", "Classic", None, 1800, 10, "CSH-DES-MUFFIN-DOZEN", 1)
            ],
            "basic-cookies": [
                ("Half dozen", "Classic", None, 600, 10, "CSH-DES-COOKIE-HALF", 0),
                ("Dozen", "Classic", None, 1000, 10, "CSH-DES-COOKIE-DOZEN", 1)
            ],
            "special-cookies": [("Custom request", "Custom", None, 0, 10, "CSH-DES-SPCOOKIE-CUSTOM", 0)],
            "cheesecakes": [("Custom request", "Custom", None, 0, 10, "CSH-DES-CHEESE-CUSTOM", 0)],
            "custom-desserts": [("Custom request", "Custom", None, 0, 10, "CSH-DES-CUSTOM-CAKE", 0)],
            
            # Pantry
            "jams-jellies": [
                ("Small jar", "Seasonal Fruits", None, 600, 10, "CSH-PAN-JAM-SMALL", 0),
                ("Large jar", "Seasonal Fruits", None, 1000, 10, "CSH-PAN-JAM-LARGE", 1)
            ],
            "pickled-goods": [("Jar", "Seasonal Vegetables", None, 800, 10, "CSH-PAN-PICKLE-JAR", 0)],
            "simmer-pots": [
                ("Single pack", "Homestead Aromatherapy", None, 500, 10, "CSH-PAN-SIMMER-SINGLE", 0),
                ("Bundle", "Homestead Aromatherapy", None, 1200, 10, "CSH-PAN-SIMMER-BUNDLE", 1)
            ],
            "dried-mix-jars": [("Jar", "Pantry Baking Mix", None, 1200, 10, "CSH-PAN-DRIED-JAR", 0)],
            "bundles": [("Custom bundle", "Custom", None, 0, 10, "CSH-PAN-BUNDLE-CUSTOM", 0)],
            
            # Home & Body
            "lotions": [
                ("Small", "Pure Tallow", None, 1000, 10, "CSH-HB-LOTION-SMALL", 0),
                ("Large", "Pure Tallow", None, 1800, 10, "CSH-HB-LOTION-LARGE", 1)
            ],
            "lip-balms": [
                ("Single", "Beeswax & Honey", None, 400, 10, "CSH-HB-LIP-SINGLE", 0),
                ("Multi-pack", "Beeswax & Honey", None, 1000, 10, "CSH-HB-LIP-MULTI", 1)
            ],
            "salves": [
                ("Small tin", "Calendula Infused", None, 800, 10, "CSH-HB-SALVE-SMALL", 0),
                ("Large tin", "Calendula Infused", None, 1500, 10, "CSH-HB-SALVE-LARGE", 1)
            ],
            "herbal-oils": [
                ("Small bottle", "Homestead Botanical", None, 1200, 10, "CSH-HB-OIL-SMALL", 0),
                ("Large bottle", "Homestead Botanical", None, 2200, 10, "CSH-HB-OIL-LARGE", 1)
            ],
            
            # Oven Fund
            "oven-fund-support": [("Manual support request", "Donation", None, 0, 100, "CSH-OVEN-SUPPORT", 0)]
        }

        for slug, variants in product_variants.items():
            product_id = product_ids.get(slug)
            if not product_id:
                continue
                
            await db.execute("DELETE FROM product_variants WHERE product_id = ?", (product_id,))
            for sort_idx, (size, color, color_hex, price, stock, sku, sort) in enumerate(variants):
                await db.execute("""
                    INSERT INTO product_variants (
                        product_id, size, color, color_hex, price_cents, stock_quantity, sku, sort_order
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (product_id, size, color, color_hex, price, stock, sku, sort))

        # 4. Collections Seeding
        collections_data = [
            ("New Arrivals", "new-arrivals", "Fresh seasonal preorders and specials from our kitchen.", 0),
            ("Best Sellers", "best-sellers", "Sage & Sweetgrass community favorites.", 1),
        ]
        
        collection_ids = {}
        for name, slug, desc, sort in collections_data:
            cursor = await db.execute("SELECT id FROM collections WHERE slug = ?", (slug,))
            row = await cursor.fetchone()
            if row:
                col_id = row[0]
                await db.execute("UPDATE collections SET name = ?, description = ?, sort_order = ? WHERE id = ?", (name, desc, sort, col_id))
            else:
                cursor = await db.execute("INSERT INTO collections (name, slug, description, sort_order) VALUES (?, ?, ?, ?)", (name, slug, desc, sort))
                col_id = cursor.lastrowid
            collection_ids[slug] = col_id

        # 5. Collection Products Mapping
        # New Arrivals: Sourdough, Cinnamon Rolls
        col_new_arrivals_id = collection_ids.get("new-arrivals")
        if col_new_arrivals_id:
            await db.execute("DELETE FROM collection_products WHERE collection_id = ?", (col_new_arrivals_id,))
            for idx, p_slug in enumerate(["sourdough", "cinnamon-rolls"]):
                p_id = product_ids.get(p_slug)
                if p_id:
                    await db.execute("INSERT INTO collection_products (collection_id, product_id, sort_order) VALUES (?, ?, ?)", (col_new_arrivals_id, p_id, idx))

        # Best Sellers: Artisan Bread, Salves, Oven Fund Support
        col_best_sellers_id = collection_ids.get("best-sellers")
        if col_best_sellers_id:
            await db.execute("DELETE FROM collection_products WHERE collection_id = ?", (col_best_sellers_id,))
            for idx, p_slug in enumerate(["artisan-bread", "salves", "oven-fund-support"]):
                p_id = product_ids.get(p_slug)
                if p_id:
                    await db.execute("INSERT INTO collection_products (collection_id, product_id, sort_order) VALUES (?, ?, ?)", (col_best_sellers_id, p_id, idx))

        # 6. Default Homestead Settings Seeding
        settings_to_seed = [
            ('brand_name', 'Sage & Sweetgrass Homestead'),
            ('brand_tagline', 'Fresh baking, pantry goods & handmade homestead care'),
            ('store_announcement', 'Fresh weekly baking preorders — Local pickup & custom requests welcome!'),
            ('brand_abbreviation', 'SSH'),
            ('about_content', 'Sage & Sweetgrass Homestead is a small-batch kitchen offering fresh baking, pantry goods, and handmade home and body products. Every request is handled with care, and many items are prepared by preorder so they can be made fresh.'),
            ('pickup_instructions', 'Orders are prepared by request. Pickup or local delivery details will be confirmed after Kirstin reviews your order request.'),
            ('payment_instructions', 'Payment details will be confirmed after your request is reviewed. E-transfer or pay-on-confirmation is preferred while the menu and availability are being finalized.'),
            ('preorder_instructions', 'Sourdough is available by preorder and is usually prepared on weekends. Please include your desired date and any special notes when submitting your request.'),
            ('allergy_disclaimer', 'Items are prepared in a home kitchen and may come into contact with common allergens including wheat, dairy, eggs, nuts, peanuts, soy, and other ingredients. If you have an allergy or dietary concern, include it in your order request before confirming your order.'),
            ('faq_content', """Q: How do I place an order?
A: Browse our menu, select your items, and submit an order request. Kirstin will review it and reach out to confirm pickup/delivery and payment details.

Q: Are prices final?
A: For custom bakes and quote-only items, final pricing is confirmed after request review.

Q: How does sourdough preorder work?
A: Sourdough is baked fresh on weekends. Preorder by Wednesday evening to secure your Saturday pickup.

Q: Do you offer custom desserts?
A: Yes! Use the Custom Desserts item to describe your request, and we will get back to you with a quote.

Q: Can I request pickup or delivery?
A: Yes. Choose pickup or local delivery, and specify your preference/address in the request.

Q: What allergens should I know about?
A: Our kitchen handles wheat, dairy, eggs, soy, and nuts. Let us know of any allergies.

Q: How do I support the Oven Fund?
A: Visit our Oven Fund page to view current progress and support tiers. Contributions can be sent via e-transfer or made in person."""),
            ('oven_fund_goal', '2500'),
            ('oven_fund_current_amount', '1620'),
            ('oven_fund_description', 'Help us purchase a stone deck oven to feed the community.')
        ]
        
        for key, value in settings_to_seed:
            await db.execute("""
                INSERT INTO settings (key, value) VALUES (?, ?)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            """, (key, value))

    print("Success: Seeded database with Sage & Sweetgrass Homestead data:")
    print("  - 5 categories (Baked Fresh, Desserts, Pantry, Home & Body, Oven Fund)")
    print("  - 22 custom products with options and variants")
    print("  - 2 collections (New Arrivals, Best Sellers)")
    print("  - Homestead text settings (About, FAQ, Preorder, Payment, Pickup, Allergy)")
    print("\nRun 'python cli.py create-admin' to create an admin user.")


def main():
    parser = argparse.ArgumentParser(description="Clothing Ecommerce CLI")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("create-admin", help="Create an admin user interactively")

    p_seed_admin = sub.add_parser("seed-admin", help="Non-interactive admin user creation (CI/CD)")
    p_seed_admin.add_argument("--username", required=True, help="Admin username / email")
    p_seed_admin.add_argument("--password", required=True, help="Admin password")
    p_seed_admin.add_argument("--display-name", default=None, help="Display name")
    p_seed_admin.add_argument("--role", default="owner", help="Role (default: owner)")

    sub.add_parser("seed", help="Seed sample data for development")

    args = parser.parse_args()

    if args.command == "create-admin":
        asyncio.run(create_admin())
    elif args.command == "seed-admin":
        asyncio.run(seed_admin(
            username=args.username,
            password=args.password,
            display_name=args.display_name,
            role=args.role,
        ))
    elif args.command == "seed":
        asyncio.run(seed())
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
