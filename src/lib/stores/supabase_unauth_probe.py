# supabase_unauth_probe.py
import os
import sys
import json
import requests

BASE_URL = "https://jcbvjakdtywqikciddqq.supabase.co"

def try_rest_table(table: str, schema: str = "public"):
    """
    Try to read 1 row from a table without any API key.
    """
    url = f"{BASE_URL}/rest/v1/{table}"
    params = {"select": "*", "limit": 1}
    headers = {
        # Tell PostgREST which schema to use (optional but nice)
        "Accept-Profile": schema,
        # No Authorization / apikey header on purpose
    }
    print(f"→ GET {url} (unauthenticated)")
    r = requests.get(url, params=params, headers=headers, timeout=15)
    print(f"Status: {r.status_code}\n")

    if r.status_code == 200:
        try:
            data = r.json()
        except Exception:
            data = r.text
        print("Success! Sample response (truncated):")
        print(json.dumps(data, indent=2)[:1000])
        return

    # Helpful hints
    if r.status_code in (401, 403):
        print("This project requires an API key (even for anon/public).")
        print("Next step: use your anon key in the Authorization & apikey headers.")
    elif r.status_code == 404:
        print("Table not found (or endpoint blocked). Double-check table name & schema.")
    else:
        print("Unexpected response:", r.text[:500])

def fetch_public_storage_file():
    """
    Public storage files can be fetched without keys.
    """
    file_url = (
        "https://jcbvjakdtywqikciddqq.supabase.co/storage/v1/object/public/"
        "user-assets/pfp/849d85f9-10b1-4825-ade6-a717f8b992ed-0.5607661766122005.jpeg"
    )
    print(f"\n→ Downloading public storage file\n{file_url}")
    r = requests.get(file_url, timeout=30)
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        out = "downloaded_image.jpeg"
        with open(out, "wb") as f:
            f.write(r.content)
        print(f"Saved: {out}")
    else:
        print("Could not fetch the file (is the bucket still public?).")

if __name__ == "__main__":
    # Try a guess, or pass table name as CLI arg
    table = sys.argv[1] if len(sys.argv) > 1 else "your_table_name_here"
    try_rest_table(table)
    fetch_public_storage_file()
