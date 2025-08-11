// scripts/cleanSeed.ts
import fs from 'fs';
import path from 'path';
// Adjust path based on where your types are defined
import type { KickClip, KickApiResponse } from '../src/types/kickTypes';

const SEED_FILE_PATH = path.join(process.cwd(), 'data', 'seed-clips.json');

console.log(`Reading seed file from: ${SEED_FILE_PATH}`);

try {
    if (!fs.existsSync(SEED_FILE_PATH)) {
        console.error("Error: Seed file not found!");
        process.exit(1);
    }

    const rawData = fs.readFileSync(SEED_FILE_PATH, 'utf-8');
    let originalData: any;
    let originalClips: KickClip[] = [];

    // Try parsing as the expected { clips: [], nextCursor: ... } structure
    try {
        originalData = JSON.parse(rawData);
        if (originalData && Array.isArray(originalData.clips)) {
            originalClips = originalData.clips;
            console.log(`Parsed existing structure. Found ${originalClips.length} clips initially.`);
        } else {
            console.warn("Warning: File doesn't seem to have the expected { clips: [...] } structure. Attempting to parse as an array directly...");
            // Fallback: Try parsing as a direct array (like the second part of your corrupted data)
            const parsedArray = JSON.parse(rawData);
            if (Array.isArray(parsedArray)) {
                originalClips = parsedArray;
                console.log(`Parsed as direct array. Found ${originalClips.length} clips initially.`);
            } else {
                 throw new Error("Could not parse file content as expected API response object or a clip array.");
            }
        }
    } catch (parseError: any) {
        console.error(`Error parsing JSON in seed file: ${parseError.message}`);
        console.error("Please ensure the file contains valid JSON representing either the API response {clips: [...]} or just the array [...] of clips.");
        process.exit(1);
    }


    if (originalClips.length === 0) {
        console.log("No clips found in the source data. No changes made.");
        process.exit(0);
    }

    // Deduplicate using a Map (keeps the first occurrence)
    const uniqueClipsMap = new Map<string, KickClip>();
    let duplicateCount = 0;

    for (const clip of originalClips) {
        if (clip && typeof clip.id === 'string' && clip.id.startsWith('clip_')) { // Basic validation
            if (!uniqueClipsMap.has(clip.id)) {
                uniqueClipsMap.set(clip.id, clip);
            } else {
                duplicateCount++;
            }
        } else {
            console.warn("Found item without valid ID, skipping:", JSON.stringify(clip).substring(0, 100));
        }
    }

    const uniqueClipsArray = Array.from(uniqueClipsMap.values());
    console.log(`Found and removed ${duplicateCount} duplicate clips.`);
    console.log(`Total unique clips: ${uniqueClipsArray.length}`);

    // Prepare the final data structure for the file
    // (We'll stick to the KickApiResponse structure as that's what the processor expects)
    const cleanedData: KickApiResponse = {
        clips: uniqueClipsArray,
        nextCursor: null // Cursor isn't relevant for the static seed file
    };

    // Write the cleaned data back to the file (pretty-printed)
    fs.writeFileSync(SEED_FILE_PATH, JSON.stringify(cleanedData, null, 2), 'utf-8'); // Using null, 2 for formatting

    console.log(`Successfully cleaned and overwrote ${SEED_FILE_PATH} with ${uniqueClipsArray.length} unique clips.`);

} catch (error: any) {
    console.error("An error occurred during the cleanup process:", error);
    process.exit(1);
}