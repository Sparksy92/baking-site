import os
import re
from pathlib import Path

def fix_collate():
    db_file = Path("app/database.py")
    content = db_file.read_text(encoding="utf-8")
    
    if "COLLATE NOCASE" not in content:
        # Add the regex replacement in PostgresCursor.execute
        target = 'pg_query = _convert_qmarks(original_query)'
        replacement = target + '\n        pg_query = re.sub(r\'(?i)([a-zA-Z0-9_.]+)\\s*=\\s*\\$(\\d+)\\s+COLLATE\\s+NOCASE\', r\'LOWER(\\1) = LOWER($\\2)\', pg_query)'
        content = content.replace(target, replacement)
        db_file.write_text(content, encoding="utf-8")
        print("Updated app/database.py")

def fix_tests():
    test_dir = Path("tests")
    for file in test_dir.rglob("*.py"):
        content = file.read_text(encoding="utf-8")
        
        # Remove db_path = os.environ["DATABASE_PATH"]
        new_content = []
        changed = False
        for line in content.splitlines():
            if 'db_path = os.environ["DATABASE_PATH"]' in line:
                changed = True
                continue
            new_content.append(line)
            
        if changed:
            file.write_text("\n".join(new_content) + "\n", encoding="utf-8")
            print(f"Updated {file}")

if __name__ == "__main__":
    fix_collate()
    fix_tests()
