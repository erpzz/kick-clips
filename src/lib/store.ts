/**
 * Generic storage interface for KickClips.
 * Swap implementations by changing STORE_BACKEND env var.
 */

import type { KickClip } from '@/types/kickTypes';
import { pgStore }     from './stores/pgStore';
import { jsonStore }   from './stores/jsonStore';
// import { redisStore } from './stores/redisStore'

export interface Store {
  /** Return an array of *clip IDs* sorted by hotness; used for pagination. */
  topClipIds(limit: number): Promise<string[]>;

  /** Hydrate clip objects for given IDs; order must match input IDs. */
  getClips(ids: string[]): Promise<KickClip[]>;
}

/* ─────────────────────────────── */
/* Dynamic resolver                */
/* ─────────────────────────────── */

const backend = process.env.STORE_BACKEND ?? 'json';

export const store =
  backend === 'pg'
    ? pgStore
  : backend === 'redis'
    ? require('./stores/redisStore').redisStore
  : jsonStore;

console.info(`[store] Using '${backend}' backend`);
