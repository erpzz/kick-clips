// pgStore.ts
import { createClient } from '@supabase/supabase-js';
import type { Store } from '../store';
import type { KickClip } from '@/types/kickTypes';

/* ───────────────── Supabase client ───────────────── */
export const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,      // e.g. https://xyz.supabase.co
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // anon key – read-only
  { auth: { persistSession: false } }
);

/**
 * Target categories by NUMERIC IDs (fastest; no joins or JSON needed)
 * IRL = 8549
 * Chat Roulette = 8548
 * Slots & Casino = 28
 * Pools, Hot Tubs & Bikinis = 16
 * Scavenger Hunt = 8379   (include/remove as you like)
 */
const TARGET_CATEGORY_IDS = [8549, 8548, 28, 16, 8379];

/* ───────────────── Implementation ───────────────── */
// same imports + supa + categories as above…

export const pgStore: Store = {
  async topClipIds(limit: number): Promise<string[]> {
    const hoursBack = 72;
    const sinceIso = new Date(Date.now() - hoursBack * 3_600_000).toISOString();

    const { data, error } = await supa
      .from('clips_recent')    // this must contain id/created_at/category_id/view_count
      .select('id')
      .gte('created_at', sinceIso)
      .in('category_id', TARGET_CATEGORY_IDS)
      .order('view_count', { ascending: false })
      .limit(limit * 2);

    if (error) { console.error('topClipIds error', error); return []; }
    const ids = (data ?? []).map((r: any) => r.id);
    return Array.from(new Set(ids)).slice(0, limit);
  },

  async getClips(ids: string[]): Promise<KickClip[]> {
    const uniqIds = Array.from(new Set(ids));
    if (!uniqIds.length) return [];

    // IMPORTANT: replace 'clips_feed' with the name of your FULL/HYDRATED view
    const { data, error } = await supa
      .from('clips_feed')        // e.g. a view that SELECTs from clips + joins as JSON
      .select('*')
      .in('id', uniqIds);

    if (error) { console.error('getClips view hydrate error', error); return []; }

    const rows = (data ?? []).map((c: any) => ({
      ...c,
      channel: Array.isArray(c.channel) ? c.channel[0] : c.channel,
      category: Array.isArray(c.category) ? c.category[0] : c.category,
      // display_at: c.started_at ?? c.created_at,
    })) as KickClip[];

    const byId = new Map(rows.map(c => [c.id, c]));
    const out: KickClip[] = [];
    const seen = new Set<string>();
    for (const id of ids) {
      if (!seen.has(id)) {
        const r = byId.get(id);
        if (r) out.push(r);
        seen.add(id);
      }
    }
    return out;
  },
};

  return out;
}
};
