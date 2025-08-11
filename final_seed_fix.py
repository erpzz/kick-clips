#!/usr/bin/env python3
import json, time, re
from pathlib import Path

INPUT_PATH  = Path('data/seed-clips-fixed.json')
OUTPUT_PATH = Path('data/seed-clips-transformed.json')

def extract_top_level_objects(raw: str):
    """Yield each top‑level `{…}` block in raw, ignoring wrapper commas."""
    depth = 0
    buf = []
    for ch in raw:
        if ch == '{':
            depth += 1
        if depth > 0:
            buf.append(ch)
        if ch == '}':
            depth -= 1
            if depth == 0:
                yield ''.join(buf)
                buf = []

def normalize_item(item):
    # build your snake_case output and inject channel sub-object
    out = {
        'id':            item.get('id'),
        'title':         item.get('title'),
        'video_url':     item.get('videoUrl')    or item.get('clip_url')    or item.get('video_url'),
        'thumbnail_url': item.get('thumbnailUrl') or item.get('thumbnail_url'),
        'timestamp':     item.get('timestamp'),
        'source_url':    item.get('sourceUrl')   or item.get('source_url'),
        'view_count':    item.get('viewCount')   or item.get('view_count'),
    }

    # pull username from any of the old fields
    username = item.get('author')
    if not username and isinstance(item.get('channel'), dict):
        username = item['channel'].get('username')
    if not username and isinstance(item.get('creator'), dict):
        username = item['creator'].get('username')

    if username:
        out['channel'] = {
            'username': username,
            'slug':     username.lower()
        }

    return out

def main():
    start = time.time()
    print(f"⏱  Starting full transform at {time.strftime('%X')}")

    if not INPUT_PATH.exists():
        print(f"❌  Input file not found: {INPUT_PATH}")
        return

    raw = INPUT_PATH.read_text(encoding='utf-8')
    print(f"📂  Read {len(raw):,} bytes from {INPUT_PATH}")

    print("🔍  Extracting top‑level JSON objects…")
    blocks = list(extract_top_level_objects(raw))
    print(f"   → Found {len(blocks)} objects")

    parsed = []
    for idx, blk in enumerate(blocks, 1):
        # remove any trailing commas before a closing brace
        clean = re.sub(r',\s*}', '}', blk)
        try:
            parsed.append(json.loads(clean))
        except json.JSONDecodeError as e:
            print(f"❌  Parse error in object #{idx}: {e}")
            raise

    print(f"✅  Parsed {len(parsed)} items, now normalizing…")
    transformed = [normalize_item(o) for o in parsed]

    print(f"💾  Writing {len(transformed)} items to {OUTPUT_PATH}…")
    OUTPUT_PATH.write_text(
        json.dumps(transformed, indent=2, ensure_ascii=False),
        encoding='utf-8'
    )

    print(f"✅  Done in {(time.time() - start):.2f}s.")

if __name__ == '__main__':
    main()
