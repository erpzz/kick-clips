/**
 * One-shot refresh for 10-day IRL clips.
 * Exported as refreshAll() so other scripts can call it.
 */

import 'dotenv/config';
import pLimit from 'p-limit';
import { createClient } from '@supabase/supabase-js';

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPA_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

// ─── Tunables ─────────────────────────────────────
const WORKERS      = 1;
const GAP_MS       = 1000;
const delay   = () => sleep(GAP_MS + Math.random()*500);
const WINDOW_DAYS  = 3;
const REFRESH_HRS  = 3;
const MAX_RETRIES  = 3;
 
// identical headers you use elsewhere
const HEADERS = {
  'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0',

};
const kickURL = (id: string) => `https://kick.com/api/v2/clips/${id}`;

// ─── Exported main task ───────────────────────────
export async function refreshAll() {
  // 1) child categories for parent 'irl'
  const { data: catRows, error: catErr } = await supa
    .from('categories')
    .select('id')
    .eq('parent_category', 'irl');
  if (catErr) throw catErr;

  const catIds = catRows?.map(r => r.id) ?? [];
  if (!catIds.length) {
    console.warn('No IRL child categories found – aborting');
    return;
  }

  // 2) candidates: 10-day window, not refreshed in last 3 h
  const now        = Date.now();
  const fromDate   = new Date(now - WINDOW_DAYS * 86_400_000).toISOString();
  const refreshCut = new Date(now - REFRESH_HRS * 3_600_000).toISOString();

  const { data: clips, error: clipErr } = await supa
    .from('clips_recent')
    .select('id, created_at, last_view_refresh')
    .gte('created_at', fromDate)
    .in('category_id', catIds)
    .or(`last_view_refresh.is.null,last_view_refresh.lt.${refreshCut}`);

  if (clipErr) throw clipErr;
  if (!clips?.length) {
    console.log('[refresh] nothing to refresh');
    return;
  }

  console.log(`[refresh] ${clips.length} clips queued`);

  const limit = pLimit(WORKERS);
  await Promise.all(clips.map(c => limit(() => refreshOne(c))));

  console.log('[refresh] pass complete ✔︎');
}

// ─── Internal per-clip worker ─────────────────────
async function refreshOne(clip: { id: string; created_at: string | null }) {
   const { id, created_at } = clip;
   await delay;
    
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const r = await fetch(kickURL(id), { headers: HEADERS });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const c  = j.clip ?? j; 

      if (typeof c.view_count !== 'number' || typeof c.likes_count !== 'number')
        throw new Error('metrics missing');

      const payload = {
        view_count:        c.view_count,
        likes_count:       c.likes_count,
        score:             c.view_count,
        last_view_refresh: new Date().toISOString()
      };

      await supa.from('clips').update(payload).eq('id', id);
      await supa.from('clips_recent').update(payload).eq('id', id);
      return;
      
    }  catch (err: any) {
  const msg = String(err?.message || err);

  // Case 1: Metrics genuinely missing (deleted or private clip)
  if (msg.includes('metrics missing')) {
    console.warn(`[refresh] ${id} (${created_at}) → no metrics — skipped`);
    return;                            // don’t retry
  }

  // Case 2: Kick rate-limited us or transient error
  if (msg.includes('Too many requests') || msg.includes('RateLimit')) {
    console.warn(`[refresh] ${id} (${created_at}) rate-limited (attempt ${attempt})`);
  } else {
    console.warn(`[refresh] ${id} (${created_at}) attempt ${attempt} failed: ${msg}`);

  }

  // Give up after MAX_RETRIES
  if (attempt === MAX_RETRIES) {
    console.warn(`[refresh] ${id} exhausted retries — giving up`);
    return;
  }

  // Exponential back-off: 1 s → 2 s → 4 s
  await sleep(1000 * 2 ** (attempt - 1));
}
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// Run immediately if called directly (npm run refresh:metrics)
if (require.main === module) {
  refreshAll().then(() => process.exit(0));
}
