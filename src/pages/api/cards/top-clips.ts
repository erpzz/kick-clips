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
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Row[]>
) {
  if (req.method !== 'GET') return res.status(200).json([])

  try {
    // Use the MV if you want; otherwise query clips with a 7-day filter.
    const sinceIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

    const { data, error } = await supa
      .from('mv_top_clips_7d') // or 'mv_top_clips_7d' if you created that view with channel_username
      .select('id,title,channel_username,view_count,clip_url,likes_count,created_at')
      .order('view_count', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(5)

    if (error) {
      console.error('[api/cards/top-clips] supabase error', error)
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
      return res.status(200).json([])
    }

    const rows: Row[] = (data ?? []).map((c: any) => ({
      id: c.id,
      title: c.title ?? null,
      channel_username: c.channel?.username ?? null, // flatten
      view_count: c.view_count ?? null,
      clip_url: c.clip_url ?? null,
      likes_count: c.likes_count ?? null,
      created_at: c.created_at ?? null,
    }))

    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600')
    return res.status(200).json(rows) // <-- plain array again
  } catch (e) {
    console.error('[api/cards/top-clips] fatal', e)
    return res.status(200).json([]) // never crash the client
  }
}
