/**
 * Given an array of KickClip objects, collect the distinct
 * categories, users, and channels they reference and upsert
 * them into Supabase in the correct order so that foreign‐key
 * constraints on the "clips" table are satisfied.
 *
 * Usage:
 *   await upsertRefsFromClips(newClips);
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import type { KickClip } from '@/types/kickTypes';

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPA_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

const BATCH = 250;           // keep requests well under 10 MB payload

export async function upsertRefsFromClips(clips: KickClip[]) {
  if (!clips.length) return;

  const cats     = new Map<number, any>();
  const users    = new Map<number, any>();
  const channels = new Map<number, any>();

  for (const c of clips) {
    if (c.category) {
      const catId = Number(c.category.id);
      cats.set(catId, {
        id: catId,
        name: c.category.name,
        slug: c.category.slug,
        parent_category: c.category.parent_category ?? null
      });
    if (c.creator) {
      const userId = Number(c.creator.id);
      users.set(userId, {
        id: userId,
        username: c.creator.username,
        slug: c.creator.slug
      });
    if (c.channel) {
      const channelId = Number(c.channel.id);
      channels.set(channelId, {
        id: channelId,
        username: c.channel.username,
        slug: c.channel.slug,
        profile_picture: c.channel.profile_picture,
        user_id: c.creator?.id ? Number(c.creator.id) : null
      });
    }
      };
    }
  }

  // helper to chunk + upsert
  async function upsert(table: string, rows: any[]) {
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      await supa.from(table)
        .upsert(slice, { onConflict: 'id' })   // insert or update
        .throwOnError();
    }
    console.log(`  ↳ ${table}: upserted ${rows.length}`);
  }

  await upsert('categories', [...cats.values()]);
  await upsert('users',      [...users.values()]);
  await upsert('channels',   [...channels.values()]);
}
