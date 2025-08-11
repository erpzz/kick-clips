// src/lib/updateSeedFile.ts
import fs from 'fs';
import path from 'path';
import { calcTrendingScore } from '@/lib/scoring';
import type { KickClip, KickApiResponse } from '@/types/kickTypes';
import { upsertClips } from './syncClipsToSupabase'
import { upsertRefsFromClips } from './upsertRefsFromClips';


// --- Constants ---
const KICK_API_BASE_URL = "https://kick.com/api/v2/clips"; // Global clips endpoint
const CLIPS_TO_FETCH = 7000; // Target number before deduplication
const CLIPS_PER_PAGE = 20;
const MAX_PAGES = Math.ceil(CLIPS_TO_FETCH / CLIPS_PER_PAGE);
const GRAVITY = 1.8;
const FETCH_DELAY_MS = 850; // Delay between page fetches

// Path to the seed file
const SEED_FILE_PATH = path.join(process.cwd(), 'data', '/seed-clips.json');

// Define headers (Use your actual working headers!)
const KICK_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Trailer/93.3.8652.5', // <<< PASTE YOUR WORKING USER-AGENT
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Referer': 'https://kick.com'
};


// --- Deduplication Logic ---
function deduplicateClips(clips: KickClip[]): KickClip[] {
    const uniqueClipsMap = new Map<string, KickClip>();
    let duplicateCount = 0;
    console.log(`Deduplicating ${clips.length} clips...`);
    for (const clip of clips) {
        if (clip && typeof clip.id === 'string' && clip.id.startsWith('clip_')) {
            if (!uniqueClipsMap.has(clip.id)) {
                uniqueClipsMap.set(clip.id, clip);
            } else {
                duplicateCount++;
            }
        } else {
            console.warn("Deduplication skipping invalid clip:", JSON.stringify(clip).substring(0, 100));
        }
    }
    console.log(`Removed ${duplicateCount} duplicate clips during deduplication.`);
    return Array.from(uniqueClipsMap.values());
}

// --- Main Function to Fetch, Process, Save ---
export async function updateAndCleanSeedFile(): Promise<{ success: boolean; message: string; clipsSaved?: number }> {
    let allFetchedClips: KickClip[] = [];
    let cursor: string | null | undefined = undefined;
    let pagesFetched = 0;
    let fetchErrorOccurred = false;

    console.log(`Starting seed file update. Fetching from ${KICK_API_BASE_URL}...`);

    try {
        // --- PAGINATION LOOP ---
        while (pagesFetched < MAX_PAGES && allFetchedClips.length < CLIPS_TO_FETCH) {
            const url = cursor ? `${KICK_API_BASE_URL}?cursor=${encodeURIComponent(cursor)}` : KICK_API_BASE_URL;
            console.log(`Workspaceing page ${pagesFetched + 1} from ${url.split('?')[0]}...`);

            const response = await fetch(url, { method: 'GET', headers: KICK_HEADERS });
            pagesFetched++;
            console.log(`Page ${pagesFetched} Status: ${response.status}`);

            if (!response.ok) {
                console.error(`Kick API Error on page ${pagesFetched}: ${response.status} ${response.statusText}. Stopping pagination.`);
                fetchErrorOccurred = true;
                break;
            }

            const data: KickApiResponse = await response.json();

            // Basic validation of received clips
            if (data.clips && Array.isArray(data.clips)) {
                 const validClips = data.clips.filter(clip => clip && clip.id && clip.created_at && clip.view_count !== undefined);
                 if(validClips.length !== data.clips.length) {
                     console.warn(`Page ${pagesFetched}: Filtered out ${data.clips.length - validClips.length} invalid clip objects from API response.`);
                 }
                 // Ensure structure matches KickClip (API should return snake_case)
                 // No transformation needed IF API returns correct snake_case format
                allFetchedClips = allFetchedClips.concat(validClips);
            } else {
                 console.warn(`Page ${pagesFetched}: No valid 'clips' array found in API response.`);
            }

            if (data.nextCursor) {
                cursor = data.nextCursor;
                await new Promise(resolve => setTimeout(resolve, FETCH_DELAY_MS)); // Delay
            } else {
                console.log(`Finished fetching pages (no next cursor).`);
                break;
            }
        } // --- END PAGINATION LOOP ---

        if (allFetchedClips.length === 0 && fetchErrorOccurred) {
            throw new Error("Fetching failed on first page, no clips obtained.");
        }
        if (allFetchedClips.length === 0) {
             console.log("No valid Kick clips were fetched. Seed file not updated.");
             return { success: true, message: "No valid Kick clips were fetched. Seed file not updated.", clipsSaved: 0 };
        }

        console.log(`Total raw valid clips fetched: ${allFetchedClips.length}`);

        // --- Processing (Score and Deduplicate) ---
        console.log("Applying scoring...");
        const scoredClips = allFetchedClips.map(clip => ({
            ...clip,
            score: calcTrendingScore(clip.view_count, clip.created_at),
        }));

        // Deduplicate ALL fetched & scored clips
        const uniqueClips = deduplicateClips(scoredClips);
        console.log(`Total unique clips after deduplication: ${uniqueClips.length}`);

        // --- Load existing seed file ---
        let existingClips: KickClip[] = [];
        if (fs.existsSync(SEED_FILE_PATH)) {
            try {
                const raw = fs.readFileSync(SEED_FILE_PATH, 'utf-8');
                const parsed = JSON.parse(raw) as KickApiResponse;
                if (Array.isArray(parsed.clips)) {
                    existingClips = parsed.clips;
                }
            } catch (e) {
                console.warn("Couldn't parse existing seed file, starting fresh:", e);
            }
        }

        // --- Merge + dedupe existing + new ---
        const existingIds = new Set(existingClips.map(c => c.id));
        const newClips = uniqueClips.filter(c => !existingIds.has(c.id));
        const mergedClips = deduplicateClips(existingClips.concat(uniqueClips));

        // --- Sort merged clips ---
        mergedClips.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        try{
            console.log(`Upserting ${newClips.length} brand-new clips to SSA's Database...`);
            await upsertRefsFromClips(newClips);
            await upsertClips(newClips);
            console.log('Database upsert finished');
        } catch (dbErr) {
            console.error('Supabase upsert failed – seed file will still be written:', dbErr);
        }
        

        // --- Write to seed-clips.json ---
        console.log(`Writing ${mergedClips.length} total clips (${uniqueClips.length} new) to: ${SEED_FILE_PATH}`);
        const dataToSave: KickApiResponse = {
            clips: mergedClips,
            nextCursor: null
        };
        fs.writeFileSync(SEED_FILE_PATH, JSON.stringify(dataToSave, null, 2), 'utf-8');

        console.log("Seed file update process finished successfully.");
        return {
            success: true,
            message: `Merged ${uniqueClips.length} fetched clips (${newClips.length} brand‑new); total ${mergedClips.length}.`,
            clipsSaved: mergedClips.length
        };

    } catch (error: any) {
        console.error("Error during seed file update process:", error);
        return { success: false, message: error.message || 'Failed to update seed data' };
    }
}
