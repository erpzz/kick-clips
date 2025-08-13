import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

type Row = {
  id: string
  title: string | null
  channel_username: string | null
  view_count: number | null
  clip_url: string | null  
  likes_count: number | null
  created_at: string | null
}

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Row[] | { error: string }>
) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Only GET allowed' });

  try {
    const sinceIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const { data, error } = await supa
      .from('clips')
      .select(`
        id, title, view_count, clip_url, likes_count, created_at,
        channel:channels!clips_channel_id_fkey ( username )
      `)
      .gte('created_at', sinceIso)
      .order('view_count', { ascending: false })
      .order('likes_count', { ascending: false })
      .order('id', { ascending: true })         // optional tie-breaker
      .limit(10);

    if (error) {
      console.error('[api/cards/top-clips] supabase error', error);
      // Don’t crash the page: return an empty list
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
      return res.status(200).json([]);
    }

    const rows: Row[] = (data ?? []).map((c: any) => ({
      id: c.id,
      title: c.title ?? null,
      channel_username: c.channel?.username ?? null,
      view_count: c.view_count ?? null,
      clip_url: c.clip_url ?? null,
      likes_count: c.likes_count ?? null,
      created_at: c.created_at ?? null,
    }));

    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(rows);
  } catch (e) {
    console.error('[api/cards/top-clips] fatal', e);
    return res.status(200).json([]); // safe fallback to avoid white-screen
  }
}
