import asyncio
import os
import sys

# Ensure app is importable
sys.path.insert(0, os.path.dirname(__file__))

async def seed_admin():
    from app.database import init_db, db_connection
    from app.auth import hash_password

    await init_db()

    pw_hash = hash_password("admin123")

    async with db_connection() as db:
        await db.execute(
            "INSERT OR IGNORE INTO admin_users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)",
            ("admin", pw_hash, "Automated Admin", "owner"),
        )
        print("✓ Automated admin user seeded.")

if __name__ == "__main__":
    asyncio.run(seed_admin())
