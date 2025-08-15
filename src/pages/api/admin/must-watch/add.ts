import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPA_SERVICE_KEY!, // server-only secret
  { auth: { persistSession: false } }
);

function parseKickClip(url: string) {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/^\/([^/]+)\/clip\/([^/?#]+)/i);
    if (!m) return null;
    return { username: m[1], clipId: m[2] };
  } catch { return null; }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST' });
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { url, rank = 100, title: titleOverride, addedBy } = body || {};
  if (!url) return res.status(400).json({ error: 'Missing url' });

  const parsed = parseKickClip(url);
  if (!parsed) return res.status(400).json({ error: 'Invalid Kick clip URL' });

  const { clipId, username } = parsed;

  // Save (idempotent)
  const { data, error } = await supa
    .from('must_watch')
    .upsert({
      id: clipId,
      title: titleOverride ?? null,
      channel_username: username ?? null,
      clip_url: url,
      rank: Number(rank) || 100,
      added_by: addedBy || 'admin'
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true, item: data });
}
