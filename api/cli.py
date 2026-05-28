"""CLI utilities for clothing-ecommerce-baseline.

Usage:
    python cli.py create-admin
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
    from app.database import init_db, set_db_path
    from app.auth import hash_password
    import aiosqlite

    settings = get_settings()
    set_db_path(settings.database_path)
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

    async with aiosqlite.connect(settings.database_path) as db:
        try:
            await db.execute(
                "INSERT INTO admin_users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)",
                (username, pw_hash, display_name, "owner"),
            )
            await db.commit()
            print(f"\n✓ Admin user '{username}' created with role 'owner'")
        except Exception as e:
            if "UNIQUE" in str(e):
                print(f"Error: username '{username}' already exists")
            else:
                print(f"Error: {e}")


async def seed():
    """Insert sample products, categories, and collections for development."""
    from app.config import get_settings
    from app.database import init_db, set_db_path
    import aiosqlite

    settings = get_settings()
    set_db_path(settings.database_path)
    await init_db()

    async with aiosqlite.connect(settings.database_path) as db:
        db.row_factory = aiosqlite.Row

        # Check if already seeded
        cursor = await db.execute("SELECT COUNT(*) FROM products")
        count = (await cursor.fetchone())[0]
        if count > 0:
            print(f"Database already has {count} products. Skipping seed.")
            return

        # Categories
        categories = [
            ("T-Shirts", "t-shirts", "Premium tees with Indigenous designs", 0),
            ("Hoodies", "hoodies", "Warm hoodies and sweatshirts", 1),
            ("Accessories", "accessories", "Hats, bags, and more", 2),
        ]
        for name, slug, desc, sort in categories:
            await db.execute(
                "INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)",
                (name, slug, desc, sort),
            )

        # Products
        products = [
            ("Thunderbird Tee", "thunderbird-tee", "Screen-printed thunderbird design on heavyweight cotton.", 1, 1, 1, 0),
            ("Medicine Wheel Tee", "medicine-wheel-tee", "Four-color medicine wheel on black organic cotton.", 1, 1, 0, 1),
            ("Cedar Hoodie", "cedar-hoodie", "Embroidered cedar branch on brushed fleece.", 2, 1, 1, 0),
            ("Eagle Feather Hoodie", "eagle-feather-hoodie", "All-over eagle feather pattern, zip-up.", 2, 1, 0, 1),
            ("Beaded Cap", "beaded-cap", "Snapback with beaded front panel.", 3, 1, 0, 0),
            ("Ribbon Tote", "ribbon-tote", "Canvas tote with ribbon skirt pattern.", 3, 1, 0, 1),
        ]
        for name, slug, desc, cat_id, active, featured, sort in products:
            await db.execute(
                "INSERT INTO products (name, slug, description, category_id, is_active, is_featured, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (name, slug, desc, cat_id, active, featured, sort),
            )

        # Variants (size × color combos with prices)
        sizes = ["S", "M", "L", "XL"]
        tee_colors = [("Black", "#111111"), ("White", "#FFFFFF")]
        hoodie_colors = [("Charcoal", "#333333"), ("Forest", "#2D5016")]

        # Tee variants (products 1, 2)
        for product_id in [1, 2]:
            sort = 0
            for color, hex_val in tee_colors:
                for size in sizes:
                    sku = f"TEE-{product_id}-{color[:3].upper()}-{size}"
                    await db.execute(
                        """INSERT INTO product_variants
                           (product_id, size, color, color_hex, price_cents, stock_quantity, sku, sort_order)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                        (product_id, size, color, hex_val, 4500, 10, sku, sort),
                    )
                    sort += 1

        # Hoodie variants (products 3, 4)
        for product_id in [3, 4]:
            sort = 0
            for color, hex_val in hoodie_colors:
                for size in sizes:
                    sku = f"HOOD-{product_id}-{color[:3].upper()}-{size}"
                    await db.execute(
                        """INSERT INTO product_variants
                           (product_id, size, color, color_hex, price_cents, stock_quantity, sku, sort_order)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                        (product_id, size, color, hex_val, 8500, 8, sku, sort),
                    )
                    sort += 1

        # Accessory variants (one-size)
        await db.execute(
            """INSERT INTO product_variants
               (product_id, size, color, color_hex, price_cents, stock_quantity, sku, sort_order)
               VALUES (5, 'One Size', 'Black', '#111111', 3500, 15, 'CAP-BLK-OS', 0)""",
        )
        await db.execute(
            """INSERT INTO product_variants
               (product_id, size, color, color_hex, price_cents, stock_quantity, sku, sort_order)
               VALUES (6, 'One Size', 'Natural', '#F5F0E8', 2800, 20, 'TOTE-NAT-OS', 0)""",
        )

        # Collections
        collections = [
            ("New Arrivals", "new-arrivals", "Latest drops", 0),
            ("Best Sellers", "best-sellers", "Community favourites", 1),
        ]
        for name, slug, desc, sort in collections:
            await db.execute(
                "INSERT INTO collections (name, slug, description, sort_order) VALUES (?, ?, ?, ?)",
                (name, slug, desc, sort),
            )

        # Add products to collections
        # New Arrivals: thunderbird tee, cedar hoodie
        await db.execute("INSERT INTO collection_products (collection_id, product_id, sort_order) VALUES (1, 1, 0)")
        await db.execute("INSERT INTO collection_products (collection_id, product_id, sort_order) VALUES (1, 3, 1)")
        # Best Sellers: medicine wheel tee, eagle feather hoodie, beaded cap
        await db.execute("INSERT INTO collection_products (collection_id, product_id, sort_order) VALUES (2, 2, 0)")
        await db.execute("INSERT INTO collection_products (collection_id, product_id, sort_order) VALUES (2, 4, 1)")
        await db.execute("INSERT INTO collection_products (collection_id, product_id, sort_order) VALUES (2, 5, 2)")

        await db.commit()

    print("✓ Seeded database:")
    print("  • 3 categories")
    print("  • 6 products with variants")
    print("  • 2 collections")
    print("\nRun 'python cli.py create-admin' to create an admin user.")


def main():
    parser = argparse.ArgumentParser(description="Clothing Ecommerce CLI")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("create-admin", help="Create an admin user")
    sub.add_parser("seed", help="Seed sample data for development")

    args = parser.parse_args()

    if args.command == "create-admin":
        asyncio.run(create_admin())
    elif args.command == "seed":
        asyncio.run(seed())
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
