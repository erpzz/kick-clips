import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(200).json([]);

  const { data, error } = await supa
    .from('card_must_watch')
    .select('id,title,channel_username,clip_url,rank,added_at')
    .order('rank', { ascending: true })
    .order('added_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('[api/cards/must-watch]', error);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json([]);
  }

  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  return res.status(200).json(data ?? []);
}
