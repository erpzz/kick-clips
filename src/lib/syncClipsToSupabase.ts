// src/lib/syncClipsToSupabase.ts
import { createClient } from '@supabase/supabase-js';
import type { KickClip } from '@/types/kickTypes';
import 'dotenv/config'
const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPA_SERVICE_KEY!
);

export async function upsertClips(clips: KickClip[]) {
  if (!clips.length) { console.log('No new clips to upsert'); return; }

  const BATCH = 250;
  for (let i = 0; i < clips.length; i += BATCH) {
    const rows = clips.slice(i, i + BATCH).map(c => ({
      id: c.id,
      livestream_id: c.livestream_id ?? null,
      title: c.title ?? null,
      category_id: c.category?.id ?? 0,
      channel_id: c.channel?.id ?? 0,
      clip_url: c.clip_url ?? null,
      thumbnail_url: c.thumbnail_url ?? null,
      video_url: c.video_url ?? null,
      privacy: c.privacy ?? null,
      duration: c.duration ?? null,
      created_at: c.created_at,
      is_mature: c.is_mature ?? false,
      view_count: c.view_count ?? 0,
      likes_count: c.likes_count ?? 0,
      score: c.score ?? 0,
      is_stake_ad: false,
      raw_payload: {}
    }));

    const { error } = await supa
      .from('clips')
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
      .throwOnError();

    if (error) throw error;
    console.log(`  → ${Math.min(i + BATCH, clips.length)}/${clips.length}`);
  }
  console.log('Upsert complete');
}
