// src/pages/api/clip/[id]/boost.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supa } from '../../../../../utils/supabase';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<{ score: number; is_boosted: boolean } | { error: string }>
  ) {
    if (req.method !== 'POST')
      return res.status(405).json({ error: 'Method not allowed' });
  
    const { id } = req.query;
    if (!id || typeof id !== 'string')
      return res.status(400).json({ error: 'Missing clip id' });
  
    try {
      // 1) Only boost if not already boosted
      const { data, error: fetchErr } = await supa
        .from('clips')
        .select('score, is_boosted')
        .eq('id', id)
        .single();
  
      if (fetchErr || !data)
        throw fetchErr ?? new Error('Clip not found');
  
      if (data.is_boosted) {
        return res.status(400).json({ error: 'Clip already boosted' });
      }
  
      const newScore = (data.score ?? 0) * 5.5;
  
      // 2) Update both score and flag in one call
      const { error: updateErr } = await supa
        .from('clips')
        .update({ score: newScore, is_boosted: true })
        .eq('id', id);
  
      if (updateErr) throw updateErr;
  
      return res.status(200).json({ score: newScore, is_boosted: true });
    } catch (e: any) {
      console.error('Boost error →', e);
      return res.status(500).json({ error: 'Failed to boost score' });
    }
  }