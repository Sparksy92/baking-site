import os
import glob
import re

ROUTES_DIR = "app/routes"

def replace_in_file(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Replacements for postgres
    content = content.replace("datetime('now')", "CURRENT_TIMESTAMP")
    content = content.replace("datetime('now', '-30 days')", "(CURRENT_TIMESTAMP - INTERVAL '30 days')")
    content = content.replace("datetime('now', '-30 minutes')", "(CURRENT_TIMESTAMP - INTERVAL '30 minutes')")
    content = content.replace("datetime('now', '-24 hours')", "(CURRENT_TIMESTAMP - INTERVAL '24 hours')")
    content = content.replace("datetime('now', '-7 days')", "(CURRENT_TIMESTAMP - INTERVAL '7 days')")
    
    # SQLite JSON function replace
    content = content.replace("json_extract(", "jsonb_extract_path_text(")
    
    # INSERT OR REPLACE in settings
    content = content.replace(
        "\"INSERT OR REPLACE INTO settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)\"",
        "\"INSERT INTO settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP\""
    )
    
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

for root, _, files in os.walk(ROUTES_DIR):
    for f in files:
        if f.endswith(".py"):
            replace_in_file(os.path.join(root, f))

print("Refactor complete.")
