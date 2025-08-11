// src/pages/api/feed.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { store } from '@/lib/store'
import type { KickClip } from '@/types/kickTypes'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<KickClip[] | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Only GET allowed' })
  }

  // ---- params
  const page = Math.max(1, Number(req.query.page ?? '1'))
  const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 20), 1), 50)

  // We only need up to the slice end + a bit of headroom for filtering
  const sliceEnd = page * pageSize
  const headroom = Math.min(120, Math.ceil(pageSize * 1.5)) // small buffer
  const need = sliceEnd + headroom
  const poolSize = Math.max(need, 200) // never less than 200; never huge

  try {
    // 1) Get a *bounded* pool ordered by your store's score/recency
    const idsPool = await store.topClipIds(poolSize)
    if (!idsPool?.length) {
      res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=15, stale-while-revalidate=60')
      return res.status(200).json([])
    }

    // 2) Hydrate rows for that pool
    let pool = await store.getClips(idsPool)

    // 3) Optional fast language filter
   // pool = pool.filter((c) => looksEnglish(c.title))

    // 4) Slice the page
    const offset = (page - 1) * pageSize
    let paged = pool.slice(offset, offset + pageSize)

    // 5) Shuffle *inside* the slice (your original behavior)
    for (let i = paged.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[paged[i], paged[j]] = [paged[j], paged[i]]
    }

    res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=30, stale-while-revalidate=60')
    return res.status(200).json(paged)
  } catch (e: any) {
    console.error('[api/feed] error', e)
    return res.status(500).json({ error: 'Failed to load feed' })
  }
}
