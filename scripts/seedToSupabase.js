// scripts/seedToSupabase.js
/**
 * Usage:
 *   # from project root
 *   node scripts/seedToSupabase.js
 */

const path = require('path');
require('dotenv').config();  // loads .env in project root

const fs               = require('fs');
const { createClient } = require('@supabase/supabase-js');

// ── ENV ────────────────────────────────────────────────────────────
const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY     = process.env.SUPA_SERVICE_KEY;  // confirmed service_role token

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPA_SERVICE_KEY in .env');
  process.exit(1);
}

// ── CLIENT ─────────────────────────────────────────────────────────
const supa = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── LOAD & PARSE JSON ──────────────────────────────────────────────
const FILE = path.join(process.cwd(), 'data/seed-clips.json');
if (!fs.existsSync(FILE)) {
  console.error('❌  seed-clips.json not found at:', FILE);
  process.exit(1);
}

const parsed  = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const rawClips = Array.isArray(parsed) ? parsed : parsed.clips;

if (!Array.isArray(rawClips)) {
  console.error('❌  seed-clips.json must be an array or an object with a "clips" array');
  process.exit(1);
}
console.log(`▶ Loaded ${rawClips.length} clips from ${FILE}`);
function isValidClip(c) {
  return (
    c &&
    c.category && typeof c.category.id === 'number' &&
    c.creator  && typeof c.creator.id  === 'number' &&
    c.channel  && typeof c.channel.id  === 'number'
  );
}

const validClips = rawClips.filter(isValidClip);
const skipped    = rawClips.length - validClips.length;
if (skipped) console.log(`⚠️  Skipped ${skipped} malformed clips`);
// ── HELPERS ─────────────────────────────────────────────────────────
function buildRefs(slice) {
  const cats     = new Map();
  const users    = new Map();
  const channels = new Map();

  slice.forEach(c => {
    cats.set(c.category.id, {
      id: c.category.id,
      name: c.category.name,
      slug: c.category.slug,
      parent_category: c.category.parent_category ?? null,
    });
    users.set(c.creator.id, {
      id: c.creator.id,
      username: c.creator.username,
      slug: c.creator.slug,
    });
    channels.set(c.channel.id, {
      id: c.channel.id,
      username: c.channel.username,
      slug: c.channel.slug,
      profile_picture: c.channel.profile_picture,
      user_id: c.creator.id,
    });
  });

  return {
    categories: [...cats.values()],
    users:      [...users.values()],
    channels:   [...channels.values()],
  };
}

function buildClipRows(slice) {
  return slice.map(c => ({
    id:            c.id,
    livestream_id: c.livestream_id ?? null,
    title:         c.title ?? null,
    category_id:   c.category.id,
    channel_id:    c.channel.id,
    clip_url:      c.clip_url ?? null,
    thumbnail_url: c.thumbnail_url ?? null,
    video_url:     c.video_url ?? null,
    privacy:       c.privacy ?? null,
    duration:      c.duration ?? null,
    started_at:    c.started_at,
    created_at:    c.created_at,
    vod_starts_at: c.vod_starts_at ?? null,
    is_mature:     c.is_mature ?? false,
    view_count:    c.view_count ?? c.views ?? 0,
    likes_count:   c.likes_count ?? c.likes ?? 0,
    score:         c.score ?? 0,
    raw_payload: {},
    // raw_payload is omitted to keep each request small
  }));
}

// ── MAIN SEED LOOP ───────────────────────────────────────────────────
;(async () => {
  const BATCH = 250;  // ~400 KB per request, well under 10 MB limit

  for (let i = 61376; i < rawClips.length; i += BATCH) {
    const slice = validClips.slice(i, i + BATCH);
    const { categories, users, channels } = buildRefs(slice);
    const clips = buildClipRows(slice);

    try {
      await supa.from('categories').upsert(categories, { onConflict:'id' }).throwOnError();
      await supa.from('users')     .upsert(users,      { onConflict:'id' }).throwOnError();
      await supa.from('channels')  .upsert(channels,   { onConflict:'id' }).throwOnError();
      await supa.from('clips')     .upsert(clips,      { onConflict:'id' }).throwOnError();
    } catch (err) {
      console.error('❌  Batch failure at index', i);
    
      // show hidden props
      console.dir(err, { showHidden: true, depth: null });
    
      // also dump the first offending record
      console.log('▶ First record of batch:', JSON.stringify(clips[0],null,2));
    
      process.exit(1);
    }
    
    console.log(`✅  Upserted ${Math.min(i + BATCH, validClips.length)}/${rawClips.length}`);
  }

  console.log('🎉  Seed complete');
  process.exit(0);
})();
