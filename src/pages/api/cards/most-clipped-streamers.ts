import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

type Row = {
  streamer: string
  slug: string | null
  profile_picture: string | null
  clips_last_7d: number
}

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  // server-side only — do NOT expose this to the browser
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Row[] | { error: string }>
) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Only GET allowed' })

  try {
    const { data, error } = await supa
      .from('mv_most_clipped_streamers_7d')
      .select('streamer, slug, profile_picture, clips_last_7d')
      .order('clips_last_7d', { ascending: false })
      .order('streamer', { ascending: true })
      .limit(5)

    if (error) throw error
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
    return res.status(200).json(data ?? [])
  } catch (e: any) {
    console.error('[api/cards/most-clipped-streamers]', e)
    return res.status(500).json({ error: 'Failed to load' })
  }
}
