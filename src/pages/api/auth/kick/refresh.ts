// pages/api/auth/kick/refresh.ts
import type { NextApiRequest, NextApiResponse } from 'next';
// adjust this path to wherever your supabase client is defined
import { supa } from '../../../../../utils/supabase';
import { refreshKickTokens } from '../../../../../utils/kick';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean } | { error: string }>
) {
  // 1) Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  // 2) Retrieve the Supabase user from the current session
  const {
    data: { user },
    error: authErr,
  } = await supa.auth.getUser();

  if (authErr || !user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // 3) Look up the stored refresh token for this user
    const { data: row, error: rowErr } = await supa
      .from('kick_users')
      .select('refresh_token')   // or 'refresh_token_enc' if you named it that
      .eq('user_id', user.id)
      .single();

    if (rowErr || !row?.refresh_token) {
      throw new Error('No refresh token on file');
    }

    // 4) Call the Kick API to get new tokens
    const tokens = await refreshKickTokens(row.refresh_token);

    // 5) Persist the updated tokens & expiry in your DB
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const { error: updErr } = await supa
      .from('kick_users')
      .update({
        access_token_cache:      tokens.access_token,     // or whatever your column is
        refresh_token:           tokens.refresh_token,
        access_token_expires_at: expiresAt,
      })
      .eq('user_id', user.id);

if (updErr) throw updErr;

return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Kick token refresh failed:', err);
    return res.status(500).json({ error: err.message });
  }
}
