// pages/api/auth/kick/logout.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { supa } from '../../../../../utils/supabase';
import { revokeKickToken } from '../../../../../utils/kick';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: true } | { error: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  // 1) Get the logged-in user
  const { data: { user }, error: authErr } = await supa.auth.getUser();
  if (authErr || !user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // 2) Fetch their current refresh token
    const { data: row, error: rowErr } = await supa
      .from('kick_users')
      .select('refresh_token')
      .eq('user_id', user.id)
      .single();

    if (rowErr || !row?.refresh_token) {
      throw new Error('No refresh token to revoke');
    }

    // 3) Revoke it at Kick’s OAuth server
    await revokeKickToken(row.refresh_token, 'refresh_token');

    // 4) Delete the row (or just clear the tokens)
    const { error: delErr } = await supa
      .from('kick_users')
      .delete()
      .eq('user_id', user.id);

    if (delErr) throw delErr;

    // 5) Sign out from Supabase (logs out the session)
    await supa.auth.signOut();

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Kick logout failed:', err);
    return res.status(500).json({ error: err.message });
  }
}
