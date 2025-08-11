// src/pages/api/testLiveKickFetch.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchAndProcessKickClips } from '@/lib/kickFetcher'; // Adjust path if needed
import type { ScoredKickClip } from '@/types/kickTypes'; // Adjust path if needed

type Data = ScoredKickClip[] | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  // Basic CORS and Method Check
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  console.log("Test API Route: Calling fetchAndProcessKickClips...");
  try {
    const results = await fetchAndProcessKickClips();
    console.log(`Test API Route: fetchAndProcessKickClips returned ${results.length} items.`);
    res.status(200).json(results);
  } catch (error: any) {
    console.error("Test API Route: Error calling fetcher:", error);
    res.status(500).json({ error: error.message || 'Failed to fetch data' });
  }
}