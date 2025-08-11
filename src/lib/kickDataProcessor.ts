import fs from 'fs';
import path from 'path';
import { parseISO, isAfter, isBefore, subDays } from 'date-fns';
import type { KickClip, KickApiResponse } from '@/types/kickTypes';

/* ---------- Config ---------- */
const FEED_LIMIT       = 100; 
const SEED_FILE_PATH   = path.join(process.cwd(), 'data', 'seed-clips.json');
const GRAVITY          = 1.8;       // decay exponent
const OFFSET           = 2;         // hours added to age to avoid divide‑by‑zero
const JITTER_FACTOR    = 0.02;     // max ±0.02% random shuffle

// weights for each signal in the raw score
const WEIGHTS = {
  views:     1.0,    // log2(view_count + 1)
  duration:  0.5,    // 1 / durationSec
  favorite:  2.0,    // binary flag
  // velocity:  1.5, // if you track delta‑views per hour
};

// list of streamer usernames you want to boost
const FAVORITES = new Set<string>([
  'SamBond',
  'Ice Poseidon',
  'sweatergxd',
  'fqnos',
  'shoovy',
  'Amouranth',
  'ChickenAndy',
  'n3on',
  'TAEMIN1998',
  'alondrissa',
  'AdrianahLee',

  // …add more…
]);

/* ---------- Processor ---------- */
export function processKickSeedData(
  range: 'day' | 'week' | 'month' | 'older' = 'day'
): KickClip[] {
  console.log('Processing Kick seed data:', SEED_FILE_PATH, 'range:', range);

  if (!fs.existsSync(SEED_FILE_PATH)) {
    console.error('Seed file not found!');
    return [];
  }

  /* read & parse */
  const raw      = fs.readFileSync(SEED_FILE_PATH, 'utf-8');
  const parsed   = JSON.parse(raw) as KickApiResponse | KickClip[];
  const rawClips = Array.isArray(parsed) ? parsed : parsed.clips;
  // assign default created_at to entries missing it to avoid parse errors
  const allClips = rawClips.map(c => typeof c.created_at === 'string'
    ? c
    : { ...c, created_at: new Date().toISOString() }
  );

  if (!allClips.length) {
    console.log('Seed file contained no clips.');
    return [];
  }

  // 1. filter by date range (disabled - keep all entries)
  const filtered = allClips; // include all seed entries

  /* 2. score each clip */
  const now = Date.now();
  const scored = filtered
    .map(c => {
      const views      = c.view_count ?? 0;
      const createdTs  = Date.parse(c.created_at);
      if (isNaN(createdTs)) return null;

      // age in hours (at least 1h)
      const ageH = Math.max(1, (now - createdTs) / 3_600_000);

      // normalize signals
      const normViews    = Math.log2(views + 1);
      const normDuration = 1 / ( (c.duration ?? 1) ); 
      const favFlag      = FAVORITES.has(c.channel) ? 1 : 0;

      // build raw weighted score
      const rawScore =
        WEIGHTS.views    * normViews +
        WEIGHTS.duration * normDuration +
        WEIGHTS.favorite * favFlag;
        // + WEIGHTS.velocity * velocity;

      // apply freshness decay and tiny random jitter
      const decayed = rawScore / Math.pow(ageH + OFFSET, GRAVITY);
      const jitter  = 1 + Math.random() * JITTER_FACTOR;

      return { ...c, score: decayed * jitter };
    })
    .filter((c): c is KickClip & { score: number } => c != null);

  /* 3. sort by descending score */
  scored.sort((a, b) => b.score - a.score);

  /* 4. return full sorted list (you can still slice top N if desired) */
  return scored.slice(0, FEED_LIMIT); 
}
