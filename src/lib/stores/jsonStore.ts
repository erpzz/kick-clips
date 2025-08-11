
import fs from 'node:fs';
import path from 'node:path';
import type { Store } from '../store';
import type { KickClip } from '@/types/kickTypes';

const FILE = path.resolve(process.cwd(), 'data/seed.json');
const data: { clips: KickClip[] } = fs.existsSync(FILE)
  ? JSON.parse(fs.readFileSync(FILE, 'utf8'))
  : { clips: [] };

const idToClip = new Map(data.clips.map(c => [c.id, c]));
const hotIds   = data.clips
  .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  .map(c => c.id);

export const jsonStore: Store = {
  async topClipIds(limit) {
    return hotIds.slice(0, limit);
  },
  async getClips(ids) {
    return ids
      .map(id => idToClip.get(id))
      .filter((c): c is KickClip => c !== undefined);
  },
};
