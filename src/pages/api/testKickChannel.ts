// src/pages/api/testKickChannel.ts
// TEMPORARY: Includes full fetch & processing logic. Refactor later!
import type { NextApiRequest, NextApiResponse } from 'next';
import { FeedItem, KickClip, KickApiResponse } from '@/types/kickTypes'; // Assuming types are defined/exported here

// --- Constants ---
const KICK_API_BASE_URL = "https://kick.com/api/v2/clips";
const CLIPS_TO_FETCH = 520; // Target number of clips
const CLIPS_PER_PAGE = 20; // Estimate
const MAX_PAGES = Math.ceil(CLIPS_TO_FETCH / CLIPS_PER_PAGE);
const GRAVITY = 1.8;
const CLIPS_TO_SELECT = 70; // How many top clips to actually process/return

// Define the response type for THIS route
type TestResponse = FeedItem[] | { error: string }; // Return the processed items or an error

// Helper function for scoring (can stay here for now or move to lib)
function calculateTrendingScore(clip: KickClip): number {
    const now = Date.now();
    const createdAt = new Date(clip.created_at).getTime();
    const ageInMs = Math.max(1, now - createdAt);
    const ageInHours = ageInMs / (1000 * 60 * 60);
    const viewCount = clip.views ?? 0;
    return viewCount / Math.pow(ageInHours + 2, GRAVITY);
}

// Helper function for mapping (can stay here for now or move to lib)
function mapKickClipToFeedItem(clip: KickClip & { score?: number }): FeedItem {
    const author = clip.channel?.username ?? 'Unknown Author';
    const slug = clip.channel?.slug ?? 'unknown';
    const id = clip.id ?? `unknown_${Math.random()}`;
    return {
        id: id,
        source: 'kick',
        title: clip.title ?? 'Untitled',
        videoUrl: clip.video_url,
        thumbnailUrl: clip.thumbnail_url,
        author: author,
        timestamp: clip.created_at,
        sourceUrl: `https://kick.com/${slug}?clip=${id}`,
        viewCount: clip.views ?? 0,
    };
}


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TestResponse>
) {
  // CORS Headers...
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.setHeader('Allow', ['GET']); res.status(405).json({ error: `Method ${req.method} Not Allowed` }); return; }

  // --- Define Headers (CRITICAL: Use your working headers) ---
  const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...', // <<< PASTE YOUR WORKING USER-AGENT
      'Accept': 'application/json, text/plain, */*',               // <<< YOUR WORKING ACCEPT
      'Accept-Language': 'en-US,en;q=0.9',                         // <<< YOUR WORKING LANGUAGE
      'Accept-Encoding': 'gzip, deflate, br',                      // <<< INCLUDE IF NEEDED
      // Add any other necessary headers (NO COOKIES)
  };

  let allClips: KickClip[] = [];
  let cursor: string | null | undefined = undefined;
  let pagesFetched = 0;
  let fetchErrorOccurred = false;

  console.log(`Starting multi-page fetch from ${KICK_API_BASE_URL}. Aiming for ~${CLIPS_TO_FETCH} clips (${MAX_PAGES} pages)...`);

  try {
    // --- PAGINATION LOOP ---
    while (pagesFetched < MAX_PAGES) {
      const url = cursor ? `${KICK_API_BASE_URL}?cursor=${encodeURIComponent(cursor)}` : KICK_API_BASE_URL;
      console.log(`Workspaceing page ${pagesFetched + 1} from ${url.split('?')[0]}...`);

      const response = await fetch(url, { method: 'GET', headers: headers });
      pagesFetched++;
      console.log(`Page ${pagesFetched} Status: ${response.status}`);

      if (!response.ok) {
        console.error(`Kick API Error on page ${pagesFetched}: ${response.status} ${response.statusText}. Stopping pagination.`);
        const errorBody = await response.text().catch(() => '');
        console.error('Error body snippet:', errorBody.substring(0, 500));
        fetchErrorOccurred = true; // Mark that an error happened
        break; // Exit loop
      }

      const data: KickApiResponse = await response.json();

      if (data.clips && data.clips.length > 0) {
        allClips = allClips.concat(data.clips);
      }

      if (data.nextCursor && allClips.length < CLIPS_TO_FETCH) {
        cursor = data.nextCursor;
        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
      } else {
        console.log(`Finished fetching pages. Cursor: ${data.nextCursor ? 'present' : 'null/missing'}, Clips fetched: ${allClips.length}`);
        break; // Exit loop: no more cursor, or reached fetch target
      }
    } // --- END PAGINATION LOOP ---

    if (allClips.length === 0) {
        if (fetchErrorOccurred) {
             throw new Error("Fetching failed on first page, no clips obtained.");
        } else {
            console.log("No Kick clips were fetched (API returned empty).");
            res.status(200).json([]); // Return empty if no clips found
            return;
        }
    }

    console.log(`Total raw clips aggregated: ${allClips.length}`);

    // --- Processing Logic (Scoring, Sorting, Selecting, Mapping) ---
    console.log("Applying scoring...");
    const scoredClips = allClips.map(clip => ({
        ...clip,
        score: calculateTrendingScore(clip)
    }));

    console.log("Sorting by score...");
    scoredClips.sort((a, b) => b.score - a.score);

    const topClips = scoredClips.slice(0, CLIPS_TO_SELECT);
    console.log(`Selected Top ${topClips.length} clips.`);

    console.log("Mapping to FeedItem...");
    const feedItems: FeedItem[] = topClips.map(mapKickClipToFeedItem);

    console.log("API route finished successfully.");
    res.status(200).json(feedItems); // Return the final processed FeedItems

  } catch (error: any) {
    console.error("Error in API handler:", error);
    res.status(500).json({ error: error.message || 'Failed to fetch or process feed data' });
  }
}