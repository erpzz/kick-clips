// src/pages/api/thumb.ts

import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { url } = req.query;

  // 1) Validate the query param
  if (!url || Array.isArray(url) || typeof url !== 'string') {
    return res.status(400).send('Missing or invalid "url" parameter');
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    return res.status(400).send('Unable to decode URL');
  }

  // 2) Ensure it’s a valid HTTP(S) URL
  if (!/^https?:\/\//i.test(decoded)) {
    return res.status(400).send('URL must start with http:// or https://');
  }

  try {
    // 3) Fetch the image from the Kick CDN (or wherever)
    const upstream = await fetch(decoded);
    if (!upstream.ok) {
      return res.status(upstream.status).end(upstream.statusText);
    }
    // 4) Forward the correct Content-Type
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    // 5) Stream the raw bytes
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    console.error('Error in /api/thumb:', err);
    res.status(500).send('Error proxying thumbnail');
  }
}
