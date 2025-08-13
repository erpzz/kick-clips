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
  if (req.method !== 'GET') return res.status(405).json({ error: 'Only GET allowed' })

  try {
    const { data, error } = await supa
      .from('clips')      // or mv_top_clips_delta_7d if you prefer the “views gained” MV
      .select('id, title, channel_username, view_count, clip_url, likes_count, created_at')
      .order('view_count', { ascending: false })
      .order('likes_count', { ascending: false })
      .order('id', { ascending: true })
      .limit(10)

    if (error) throw error
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
    return res.status(200).json(data ?? [])
  } catch (e: any) {
    console.error('[api/cards/top-clips]', e)
    return res.status(500).json({ error: 'Failed to load' })
  }
}
