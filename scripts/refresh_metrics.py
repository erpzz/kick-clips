#!/usr/bin/env python3
"""
refresh_metrics.py
─────────────────────────────────────────────────────────────
• Refreshes IRL clips ≤ WINDOW_DAYS old (but only if each clip
  was last refreshed > REFRESH_HOURS ago).
• Two concurrent workers (~2 req/s) with Chrome-TLS fingerprint.
• No decay: score ← view_count.
"""

import os, sys, time, random
from concurrent.futures import ThreadPoolExecutor
import tls_client                      # pip install tls-client
from supabase import create_client, Client

# ── Supabase ────────────────────────────────────────────────
SUPA_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPA_KEY = os.environ["SUPA_SERVICE_KEY"]
supabase: Client = create_client(SUPA_URL, SUPA_KEY)

# ── Tunables ────────────────────────────────────────────────
WINDOW_DAYS   = 2
REFRESH_HOURS = 6
WORKERS       = 3       # ← 2 parallel fetchers
BASE_DELAY    = .85        # s
JITTER        = 1.1       # ± 0-0.5 s
CLIP_API      = "https://kick.com/api/v2/clips/{}"
BATCH_SIZE    = 1000


# ── TLS-client session impersonating Chrome ─────────────────
session = tls_client.Session(
    client_identifier="chrome_110",
    random_tls_extension_order=True,
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/138.0.7204.169 Safari/537.36 Edg/138.0.3351.109"
    ),
    "Accept":           "application/json, text/plain, */*",
    "Accept-Language":  "en-US,en;q=0.9",
    "Accept-Encoding":  "gzip, deflate, br",
    "Connection":       "close",
    "Referer":          "https://kick.com/",
}

# ── Helpers ────────────────────────────────────────────────
def sleep_gap() -> None:
    time.sleep(BASE_DELAY + random.random() * JITTER)

def fetch_clip_metrics(clip_id: str) -> dict | None:
    r = session.get(CLIP_API.format(clip_id), headers=HEADERS)
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}")
    c = r.json().get("clip") or r.json()
    if not all(k in c for k in ("view_count", "likes_count")):
        return None
    return {"view_count": c["view_count"], "likes_count": c["likes_count"]}

def process_clip(cid: str) -> None:
    try:
        sleep_gap()                      # per-request delay
        m = fetch_clip_metrics(cid)
        if m is None:
            print(f"[skip] {cid} no metrics"); return

        payload = {
            "view_count":        m["view_count"],
            "likes_count":       m["likes_count"],
            "score":             m["view_count"],
            "last_view_refresh": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        for tbl in ("clips", "clips_recent"):
            supabase.table(tbl).update(payload).eq("id", cid).execute()
        print(f"[ok]   {cid} views→{m['view_count']}")
    except RuntimeError as e:
        print(f"[fail] {cid} {e}")
    except Exception  as e:
        print(f"[err]  {cid} {e}")
def iter_candidate_clips(cat_ids: list[str], from_date: str, refresh_cut: str):
    offset = 0
    while True:
        resp = (
            supabase.table("clips_recent")
            .select("id, last_view_refresh")
            .gte("created_at", from_date)
            .in_("category_id", cat_ids)
            .or_(f"last_view_refresh.is.null,last_view_refresh.lt.{refresh_cut}")
            .order("created_at")                       # deterministic paging
            .limit(BATCH_SIZE)
            .offset(offset)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            break
        yield from rows
        offset += BATCH_SIZE
# ── Main ───────────────────────────────────────────────────
def main() -> None:
    # 1) IRL child categories
    cats = supabase.table("categories").select("id") \
                   .eq("parent_category", "irl").execute().data
    cat_ids = [c["id"] for c in cats]
    if not cat_ids:
        print("No IRL categories found", file=sys.stderr); return

    now          = int(time.time())
    from_date    = time.strftime("%Y-%m-%dT%H:%M:%SZ",
                                 time.gmtime(now - WINDOW_DAYS * 86400))
    refresh_cut  = time.strftime("%Y-%m-%dT%H:%M:%SZ",
                                 time.gmtime(now - REFRESH_HOURS * 3600))

   # clips = supabase.table("clips_recent") \
   #         .select("id, last_view_refresh") \
   #         .gte("created_at", from_date) \
    #        .in_("category_id", cat_ids) \
     #       .or_(f"last_view_refresh.is.null,last_view_refresh.lt.{refresh_cut}") \
      #      .limit(100000).execute().data

#    print(f"[refresh] queued {len(clips)} clips")

    # 2) Parallel pool
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        queued = 0
        for row in iter_candidate_clips(cat_ids, from_date, refresh_cut):
            pool.submit(process_clip, row["id"])
            queued += 1

    print(f"[refresh] queued {queued} clips")

if __name__ == "__main__":
    main()
