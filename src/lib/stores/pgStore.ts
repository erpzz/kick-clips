// src/lib/stores/pgStore.ts
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
 * Target categories by NUMERIC IDs
 * IRL = 8549, Chat Roulette = 8548, Slots & Casino = 28,
 * Pools, Hot Tubs & Bikinis = 16, Scavenger Hunt = 8379
 */
const TARGET_CATEGORY_IDS = [8549, 8548, 28, 16, 8379];

export const pgStore: Store = {
  /** Return hottest clip IDs from chosen categories (sorted by view_count). */
  async topClipIds(limit: number): Promise<string[]> {
    const hoursBack = 62
    const sinceIso = new Date(Date.now() - hoursBack * 3_600_000).toISOString();

    const { data, error } = await supa
      .from('clips_recent')                      // your existing view
      .select('id')
      .gte('created_at', sinceIso)
      .in('category_id', TARGET_CATEGORY_IDS)
      .order('view_count', { ascending: false })
      .limit(limit * 2);

    if (error) {
      console.error('topClipIds error', error);
      return []; // never crash the page
    }

    const ids = (data ?? []).map((r: any) => r.id);
    return Array.from(new Set(ids)).slice(0, limit);
  },

  /** Return full clip objects in the caller-supplied order (no RPC). */
  async getClips(ids: string[]): Promise<KickClip[]> {
    const uniqIds = Array.from(new Set(ids));
    if (!uniqIds.length) return [];

    // Hydrate directly from base table; embed category/channel via FKs
    const { data, error } = await supa
      .from('clips')
      .select(`
        id, title, category_id, channel_id,
        clip_url, thumbnail_url, video_url,
        duration, started_at, created_at, view_count, likes_count,
        category:categories!clips_category_id_fkey ( id, name, slug ),
        channel:channels!clips_channel_id_fkey ( id, username, slug, profile_picture )
      `)
      .in('id', uniqIds);

    if (error) {
      console.error('getClips hydrate error', error);
      return [];
    }

    const rows = (data ?? []).map((c: any) => ({
      ...c,
      channel: Array.isArray(c.channel) ? c.channel[0] : c.channel,
      category: Array.isArray(c.category) ? c.category[0] : c.category,
      // If you remove `started_at` from the type, the UI should use created_at instead.
      // You can also add a display field if you want:
      // display_at: c.started_at ?? c.created_at,
    })) as KickClip[];

    // Preserve original order and drop dupes
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
