import os
import glob

TESTS_DIR = "tests"

def fix_file(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
        
    original = content

    content = content.replace("import aiosqlite", "from app.database import get_db")
    content = content.replace("import os, aiosqlite", "import os\n    from app.database import get_db")
    content = content.replace("async with aiosqlite.connect(db_path) as db:", "async for db in get_db():")
    content = content.replace("db.row_factory = aiosqlite.Row", "pass")
    
    # In some places it might say import aiosqlite inside a function, let's just make sure it's correct
    
    if content != original:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

for root, _, files in os.walk(TESTS_DIR):
    for f in files:
        if f.endswith(".py"):
            fix_file(os.path.join(root, f))

print("Tests refactored for postgres.")
