// src/lib/streamerUtils.ts
import { parseISO, subDays, isAfter } from 'date-fns';
import type { KickClip } from '@/types/kickTypes';

/**
 * Returns the top-N streamers by number of clips created in the last `days` days.
 */
export function getRecommendedStreamers(
  clips: KickClip[],
  days: number = 3,
  topN: number = 5
): string[] {
  // 1. Build a cutoff date for X days ago
  const cutoff = subDays(new Date(), days);

  // 2. Count clips per streamer within that window
  const counts: Record<string, number> = {};
  clips.forEach(c => {
    const created = parseISO(c.created_at);
    const user = c.channel?.username;
    if (isAfter(created, cutoff) && user) {
      counts[user] = (counts[user] || 0) + 1;
    }
  });

  // 3. Sort streamer names by count desc, take top N
  return Object.entries(counts)
    .sort(([, aCount], [, bCount]) => bCount - aCount)
    .slice(0, topN)
    .map(([username]) => username);
}
