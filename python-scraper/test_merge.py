
import json
import os
import shutil

OUTPUT_DIR = 'test_output'
if os.path.exists(OUTPUT_DIR):
    shutil.rmtree(OUTPUT_DIR)
os.makedirs(OUTPUT_DIR)

# 1. Setup initial global post-details.json
initial_posts = [
    {'link': 'http://example.com/1', 'title': 'Post 1', 'isPublished': True},
    {'link': 'http://example.com/old', 'title': 'Old Post'}
]
with open(os.path.join(OUTPUT_DIR, 'post-details.json'), 'w') as f:
    json.dump({'posts': initial_posts}, f)

# 2. Simulate extract_details behavior
# New scrape results (fresh, so no isPublished)
final_posts = [
    {'link': 'http://example.com/1', 'title': 'Post 1 Updated'}, # Should preserve isPublished
    {'link': 'http://example.com/2', 'title': 'Post 2'} # New
]

# Write run-specific details
with open(os.path.join(OUTPUT_DIR, 'run-details.json'), 'w') as f:
    json.dump({'count': len(final_posts), 'posts': final_posts}, f)

# Merge logic (copied from main.py)
try:
    details_path = os.path.join(OUTPUT_DIR, 'post-details.json')
    global_posts = []
    if os.path.exists(details_path):
        try:
            with open(details_path, 'r', encoding='utf-8') as f:
                gd = json.load(f)
                global_posts = gd.get('posts') if isinstance(gd, dict) else []
                if not isinstance(global_posts, list):
                    global_posts = []
        except Exception:
            global_posts = []
    
    # Create map of existing posts
    global_map = {str(p.get('link')): p for p in global_posts if isinstance(p, dict) and p.get('link')}
    
    # Update with new details
    for p in final_posts:
        if isinstance(p, dict) and p.get('link'):
            link = str(p.get('link'))
            # Preserve isPublished if exists in global (handle concurrent updates)
            if link in global_map:
                existing = global_map[link]
                if existing.get('isPublished'):
                    p['isPublished'] = True
            global_map[link] = p
    
    new_global_posts = list(global_map.values())
    with open(details_path, 'w', encoding='utf-8') as f:
        json.dump({'count': len(new_global_posts), 'posts': new_global_posts}, f, ensure_ascii=False, indent=2)
except Exception as e:
    print(f"Failed to update global post-details.json: {e}")

# 3. Verify
with open(os.path.join(OUTPUT_DIR, 'post-details.json'), 'r') as f:
    result = json.load(f)

posts = result['posts']
p1 = next((p for p in posts if p['link'] == 'http://example.com/1'), None)
p2 = next((p for p in posts if p['link'] == 'http://example.com/2'), None)
p_old = next((p for p in posts if p['link'] == 'http://example.com/old'), None)

print(f"Post 1 isPublished: {p1.get('isPublished')}")
print(f"Post 2 exists: {p2 is not None}")
print(f"Old Post exists: {p_old is not None}")

if p1.get('isPublished') is True and p2 and p_old:
    print("SUCCESS")
else:
    print("FAILURE")
