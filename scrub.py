import os
import re

replacements = {
    r'badassexample\.com': 'example.com',
    r'badassexample-story\.webp': 'about-story.webp',
    r'Example Store': 'Example Store',
    r'cedarandsagehomestead\.ca': 'example.com',
    r'example-store': 'example-store',
    r'Example Supply': 'Example Supply',
    r'Example Supply': 'Example Supply',
    r'Example Store': 'Example Store',
    r'Admin': 'Admin',
    r'Support': 'Support',
}

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for pattern, repl in replacements.items():
        # Only ignore case for some, but let's just do exact for now or case-insensitive?
        # Actually let's do exact match for most except where noted, but re.sub without ignorecase is fine.
        new_content = re.sub(pattern, repl, new_content)
        
        # also handle lowercase versions
        if pattern == r'Admin':
            new_content = re.sub(r'admin', 'admin', new_content)
        if pattern == r'Support':
            new_content = re.sub(r'support', 'support', new_content)
        if pattern == r'Example Store':
            new_content = re.sub(r'example', 'example', new_content)
        if pattern == r'Example Store':
            new_content = re.sub(r'example store', 'example store', new_content)
            
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for root, dirs, files in os.walk('.'):
    if '.git' in root or 'node_modules' in root or '.next' in root or '__pycache__' in root:
        continue
    for file in files:
        if file.endswith(('.ts', '.tsx', '.py', '.md', '.sql', '.html', '.json', '.example', '.env.example', '.sh')):
            filepath = os.path.join(root, file)
            try:
                replace_in_file(filepath)
            except Exception as e:
                pass
