import re

app_js = open('workspace_fix/js/app.js', 'r', encoding='utf-8').read()
index_html = open('workspace_fix/index.html', 'r', encoding='utf-8').read()

# Find all document.getElementById('id') calls
matches = re.finditer(r"document\.getElementById\(['\"]([^'\"]+)['\"]\)", app_js)
ids_in_app = set()
for m in matches:
    ids_in_app.add(m.group(1))

print(f"Found {len(ids_in_app)} unique IDs in app.js")

missing = []
for i in ids_in_app:
    if f'id="{i}"' not in index_html and f"id='{i}'" not in index_html:
        missing.append(i)

print("IDs missing in index.html:", missing)
