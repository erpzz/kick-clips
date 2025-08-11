// pages/api/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { cid, t } = req.query;                     // channel id & ISO start_time
  if (!cid || !t) return res.status(400).json({ error: 'cid & t required' });

  const url = `https://kick.com/api/v2/channels/${cid}/messages?start_time=${encodeURIComponent(
    String(t),
  )}`;

  try {
    const kickRes = await fetch(url, {
      // If Kick needs a Bearer token or cookie, set headers here
      // headers: { Authorization: `Bearer ${process.env.KICK_TOKEN}` },
    });
    if (!kickRes.ok) {
      const text = await kickRes.text();
      return res.status(kickRes.status).json({ error: text });
    }
    const json = await kickRes.json();
    res.setHeader('Cache-Control', 'no-store'); // avoid Next caching
    res.status(200).json(json);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
