// src/pages/api/testKickStreamer.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchClipsForStreamer } from '@/lib/kickStreamFetcher';
import type { FeedItem } from '@/types/kickTypes';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FeedItem[] | { error: string }>
) {
  const { streamer } = req.query;
  if (!streamer || typeof streamer !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid streamer parameter.' });
  }

  try {
    const clips = await fetchClipsForStreamer(streamer);
    const feedItems: FeedItem[] = clips.map(clip => ({
      source: 'kick',
      videoUrl: '',
      thumbnailUrl: '',
      author: '',
      title: clip.title || '',
      description: clip.description || '',
      publishedAt: clip.publishedAt || new Date().toISOString(),
    }));
    res.status(200).json(feedItems);
  } catch (error: any) {
    console.error('Error fetching clips:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
}
