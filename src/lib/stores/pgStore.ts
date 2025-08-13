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
export const pgStore: Store = {
  /**
   * Return the hottest clip IDs from the chosen categories, already sorted.
   * This runs entirely on the DB (server-side), no client filtering.
   */
  async topClipIds(limit: number): Promise<string[]> {
    const hoursBack = 72;
    const sinceIso = new Date(Date.now() - hoursBack * 3_600_000).toISOString();

    const { data, error } = await supa
      .from('clips')
      .select('id')
      .gte('created_at', sinceIso)
      .in('category_id', TARGET_CATEGORY_IDS)
      .order('view_count', { ascending: false })
      .limit(limit * 2);
    const ids = (data ?? []).map(r => r.id);
    if (error) throw error;
    return Array.from(new Set(ids)).slice(0, limit);
  },

  /** Return full clip objects in the caller-supplied order. */
  // in pgStore.getClips
async getClips(ids: string[]): Promise<KickClip[]> {
  const uniqIds = Array.from(new Set(ids));
  if (!uniqIds.length) return [];

  const { data } = await supa.rpc('clips_by_ids', { iids: uniqIds }).throwOnError();
  const rows = (data ?? []).map((c: any) => ({
    ...c,
    channel   : Array.isArray(c.channel)  ? c.channel[0]  : c.channel,
    category  : Array.isArray(c.category) ? c.category[0] : c.category,
    started_at: c.started_at ?? c.created_at,
  })) as KickClip[];

  const byId = new Map(rows.map(c => [c.id, c]));
  // rebuild in the *original* order but skip dupes that were in the input
  const seen = new Set<string>();
  const out: KickClip[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      const r = byId.get(id);
      if (r) out.push(r);
      seen.add(id);
    }
  }
  return out;
}
};
