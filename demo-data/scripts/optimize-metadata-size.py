#!/usr/bin/env python3
"""
Optimize .metadata.json files for S3 Vectors 2048B filterable metadata limit.
Removes non-essential fields, keeping only allowed_group_sids.
"""
import json
import os
import glob

base_dir = os.path.join(os.path.dirname(__file__), '..', 'industry-packs')
metadata_files = glob.glob(os.path.join(base_dir, '**', '*.metadata.json'), recursive=True)

optimized = 0
for path in metadata_files:
    with open(path) as f:
        data = json.load(f)
    
    attrs = data.get('metadataAttributes', {})
    sids = attrs.get('allowed_group_sids', [])
    
    # Keep only allowed_group_sids to minimize metadata size
    data['metadataAttributes'] = {'allowed_group_sids': sids}
    
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)
        f.write('\n')
    optimized += 1

print(f'✅ Optimized {optimized} metadata files (removed access_level, doc_type fields)')
print(f'   Remaining field: allowed_group_sids only')
