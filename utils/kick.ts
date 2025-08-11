// utils/kick.ts
export async function refreshKickTokens(refreshToken: string) {
    const body = new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     process.env.KICK_CLIENT_ID!,
      client_secret: process.env.KICK_CLIENT_SECRET!,
      refresh_token: refreshToken,
    });
  
    const resp = await fetch('https://id.kick.com/oauth/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Kick refresh failed: ${text}`);
    }
    return resp.json() as Promise<{
      access_token:  string;
      token_type:    string;
      refresh_token: string;
      expires_in:    number;
      scope:         string;
    }>;
  }
  
  export async function revokeKickToken(
    token: string,
    hint: 'refresh_token' | 'access_token'
  ): Promise<void> {
    const url = new URL('https://id.kick.com/oauth/revoke');
    url.searchParams.set('token', token);
    url.searchParams.set('token_hint_type', hint);
  
    const resp = await fetch(url.toString(), { method: 'POST' });
    if (!resp.ok) {
      throw new Error(`Kick revoke failed: ${resp.status}`);
    }
  }
  // Extracts "clip_XXXXXXXX" from any string (id, permalink, video/thumbnail URL)
export function extractClipId(...sources: Array<string | null | undefined>): string | null {
  for (const s of sources) {
    if (!s) continue;
    const noQuery = s.split('?')[0];
    const match = noQuery.match(/clip_[A-Za-z0-9]+/);
    if (match) return match[0];
  }
  return null;
}
