import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

async def seed_admin():
    from app.config import get_settings
    from app.database import init_db, set_db_path
    from app.auth import hash_password
    import aiosqlite

    settings = get_settings()
    set_db_path(settings.database_path)
    await init_db()

    pw_hash = hash_password("admin123")

    async with aiosqlite.connect(settings.database_path) as db:
        await db.execute(
            "INSERT OR IGNORE INTO admin_users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)",
            ("testadmin", pw_hash, "Test Admin", "owner"),
        )
        await db.commit()
        print("✓ testadmin seeded.")

if __name__ == "__main__":
    asyncio.run(seed_admin())
