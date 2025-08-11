#!/usr/bin/env ts-node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { calcTrendingScore } from '../src/lib/scoring';

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,                // e.g. https://xyz.supabase.co
  process.env.SUPA_SERVICE_KEY!,   // service‑role key
  { auth: { persistSession: false } }
);

/* ---------- optional --since flag ---------- */
const flag = process.argv.find(a => a.startsWith('--since='));
const sinceISO = flag ? new Date(flag.split('=')[1]).toISOString() : null;
/* ------------------------------------------- */

async function run() {
  const BATCH  = 1_000;          // rows to fetch per round‑trip
  let   offset = 0;
  let   total  = 0;

  while (true) {
    /* 1️⃣  fetch a slice */
    let query = supa
      .from('clips')
      .select('id, view_count, created_at')
      .range(offset, offset + BATCH - 1);

    if (sinceISO) query = query.gte('created_at', sinceISO);

    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) break;       // no more rows → done

    /* 2️⃣  update each row */
    for (const clip of data) {
      const score = calcTrendingScore(clip.view_count, clip.created_at);
      const { error } = await supa
        .from('clips')
        .update({ score })
        .eq('id', clip.id);
      if (error) throw error;

      total++;
      if (total % 500 === 0) {
        console.log(`✅ rescored ${total} clips so far…`);
      }
    }

    offset += BATCH;               // next page
  }

  console.log(`🎉 finished — rescored ${total} clips`);
}

run().catch(err => {
  console.error('[scoreWorker] fatal:', err);
  process.exit(1);
});
