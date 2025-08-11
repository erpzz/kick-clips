// src/lib/kickStreamerFetcher.ts
 // Adjust path if necessary
import type { KickClip, KickApiResponse, ScoredKickClip } from '@/types/kickTypes'; // Adjust path if needed

// List of streamers to prioritize (more can be added later)
const PRIORITY_STREAMERS = [
  "iceposeidon",
  "adinross",
  "ac7ionman",
  "dariusirl",
  "chickenandy",
  "amouranth",
  "sambond",
  "kangjoel",
  "shoovy",
];

const GRAVITY = 1.8;
const CLIPS_TO_FETCH = 520;
const CLIPS_PER_PAGE = 20;
const MAX_PAGES = Math.ceil(CLIPS_TO_FETCH / CLIPS_PER_PAGE);
const CLIPS_TO_SELECT = 70;

// Calculate the trending score including a boost if the clip comes from one of the priority streamers.
function calculateTrendingScore(clip: KickClip): number {
  const now = Date.now();
  const createdAt = new Date(clip.created_at).getTime();
  const ageInMs = Math.max(1, now - createdAt);
  const ageInHours = ageInMs / (1000 * 60 * 60);
  const viewCount = clip.view_count ?? 0;
  let score = viewCount / Math.pow(ageInHours + 2, GRAVITY);

  // Check if channel belongs to one of the prioritized streamers
  const channelUsername = clip.channel?.username?.toLowerCase();
  if (channelUsername && PRIORITY_STREAMERS.map(s => s.toLowerCase()).includes(channelUsername)) {
    // Boost the score (multiplier can be adjusted)
    score *= 1.5;
  }
  return score;
}

export async function fetchClipsForStreamer(streamer: string): Promise<ScoredKickClip[]> {
  // Build the endpoint URL for the specific streamer's clip page.
  const STREAMER_CLIPS_ENDPOINT = `https://kick.com/api/v2/channels/${encodeURIComponent(streamer)}/clips`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...', // Use your working User-Agent
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br'
  };

  let allClips: KickClip[] = [];
  let cursor: string | undefined = undefined;
  let pagesFetched = 0;

  // Pagination loop
  while (pagesFetched < MAX_PAGES) {
    const url = cursor 
      ? `${STREAMER_CLIPS_ENDPOINT}?cursor=${encodeURIComponent(cursor)}`
      : STREAMER_CLIPS_ENDPOINT;
    console.log(`Fetching page ${pagesFetched + 1} for streamer ${streamer} from ${url.split('?')[0]}...`);

    const response = await fetch(url, { headers });
    pagesFetched++;

    if (!response.ok) {
      console.error(`Error on page ${pagesFetched} for ${streamer}: ${response.status} ${response.statusText}`);
      break;
    }

    const data: KickApiResponse = await response.json();
    if (data.clips && data.clips.length > 0) {
      allClips = allClips.concat(data.clips);
    } else {
      console.log("No clips returned on this page. Stopping pagination.");
      break;
    }

    cursor = data.nextCursor ?? undefined;
    if (!cursor || allClips.length >= CLIPS_TO_FETCH) {
      console.log(`Finished fetching pages. Reason: ${!cursor ? 'No next cursor' : 'Reached target count'}.`);
      break;
    }
  }

  if (allClips.length === 0) {
    console.error("Failed to fetch any clips.");
    return [];
  }
  console.log(`Total raw clips aggregated: ${allClips.length}`);

  // Append the score to each clip using the same approach as in your global fetcher
  const scoredClips: ScoredKickClip[] = allClips.map(clip => ({
    ...clip, // Copy all properties from the raw clip
    score: calculateTrendingScore(clip) // Append the computed score
  }));

  // Sort by score in descending order and slice the top clips
  scoredClips.sort((a, b) => b.score - a.score);
  const topClips = scoredClips.slice(0, CLIPS_TO_SELECT);
  console.log(`Selected Top ${topClips.length} clips.`);

  return topClips;
}