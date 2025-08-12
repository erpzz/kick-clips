// pages/api/auth/kick/callback.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import * as cookie from 'cookie';
import crypto from 'crypto';
import {
  createPagesServerClient,       // for setting Supabase auth cookies
} from '@supabase/auth-helpers-nextjs';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// ──────────── Environment ────────────
const SUPABASE_URL       = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY   = process.env.SUPA_SERVICE_KEY!;                    // your service-role key
const KICK_CLIENT_ID     = process.env.NEXT_PUBLIC_KICK_CLIENT_ID!;
const KICK_CLIENT_SECRET = process.env.KICK_CLIENT_SECRET!;
const REDIRECT_URI       = process.env.NEXT_PUBLIC_KICK_REDIRECT_URI!;
const TOKEN_KEY_HEX      = process.env.TOKEN_ENCRYPTION_KEY!;
const PROD_REDIRECT_URI =  process.env.NEXT_PUBLIC_KICK_REDIRECT_URI_PROD!;// 32-byte hex

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !KICK_CLIENT_ID ||
    !KICK_CLIENT_SECRET || !REDIRECT_URI || !TOKEN_KEY_HEX) {
  throw new Error('Missing one of the required env vars in callback.ts');
}

// ──────────── Helpers ────────────
function encrypt(text: string): string {
  const key    = Buffer.from(TOKEN_KEY_HEX, 'hex');
  const iv     = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let enc = cipher.update(text, 'utf8', 'hex');
  enc     += cipher.final('hex');
  return iv.toString('hex') + ':' + enc;
}

function decrypt(enc: string): string {
  const [ivHex, dataHex] = enc.split(':');
  const key    = Buffer.from(TOKEN_KEY_HEX, 'hex');
  const iv     = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let dec = decipher.update(dataHex, 'hex', 'utf8');
  dec     += decipher.final('utf8');
  return dec;
}

// ──────────── Handler ────────────
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // 1. Validate method
    if (req.method !== 'GET') {
      return res.status(405).send('Only GET allowed');
    }

    // 2. Pull code + state
    const { code, state } = req.query as { code: string; state: string };

    // 3. Validate PKCE + state from cookies
    const cookies = cookie.parse(req.headers.cookie || '');
    if (cookies.oauth_state !== state) {
      return res.status(400).send('Invalid state');
    }
    const verifier = cookies.pkce_verifier;
    if (!verifier) {
      return res.status(400).send('Missing PKCE verifier');
    }

    // 4. Exchange code for Kick tokens
    const tokenRes = await fetch('https://id.kick.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        client_id:     KICK_CLIENT_ID,
        client_secret: KICK_CLIENT_SECRET,
        code,
        redirect_uri:  PROD_REDIRECT_URI,
        code_verifier: verifier,
      }).toString(),
    });
    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      // ← Add this debug log:
      console.error('Kick token exchange failed', {
        status:    tokenRes.status,
        body,
        code:      code,           // the authorization code
        verifier:  verifier,       // your PKCE verifier
        redirect:  REDIRECT_URI,   // your configured redirect URI
      });
      // then throw a simpler error so the message isn’t overly long:
      throw new Error('Token exchange failed');
    }
    const { access_token, refresh_token, expires_in } = await tokenRes.json();

    // 5. Fetch Kick user profile
    const profileRes = await fetch('https://api.kick.com/public/v1/users', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!profileRes.ok) throw new Error('Failed to fetch Kick profile');
    const raw = await profileRes.json();
    console.dir(raw, { depth: null });   
    const kickProfile = raw.data?.[0];          // single object
    const kickId  = kickProfile.user_id;
    const kickUsername   = kickProfile.name;             // <- correct
    const kickAvatarUrl  = kickProfile.profile_picture;  // <- correct
    
    if (!kickId) throw new Error('Kick profile missing id');

    const email = `kick_${kickId}@example.com`;

    // 6. Upsert in Supabase via Admin client
    const admin = createAdminClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 6a. Try to read existing kick_users row (and its encrypted password)
    const { data: existingRow, error: rowErr } = await admin
      .from('kick_users')
      .select('password_enc')
      .eq('kick_user_id', kickId)
      .single();
    if (rowErr && rowErr.code !== 'PGRST116') { // 116 = “no row found”
      throw rowErr;
    }

    let userPassword: string;
    let supaUserId!: string;

if (existingRow) {
  /* returning user ─ decrypt pwd, refresh tokens… */
  userPassword = decrypt(existingRow.password_enc);

  // make sure there is an auth.user
  const { data: userRow, error: userErr } = await admin
    .from('auth.users')
    .select('id')
    .eq('email', email)
    .single();
  if (userErr && userErr.code !== 'PGRST116') throw userErr;

  if (userRow) {
    supaUserId = userRow.id;
    const { error: updErr } = await admin.auth.admin.updateUserById(
      supaUserId,
      { password: userPassword }
    );
    if (updErr) throw updErr;
  }
} else {
  /* first-time user ─ create auth.user */
  userPassword = crypto.randomUUID();
  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: userPassword,
      user_metadata: { kick_username: kickProfile.username },
    });
  if (createErr) throw createErr;
  supaUserId = created.user!.id;
}

/* 6e. Always run once */
const { error: upsertErr } = await admin.from('kick_users').upsert(
  {
    user_id:               supaUserId,
    kick_user_id:          kickId,
    kick_username:         kickUsername,
    kick_avatar_url:       kickAvatarUrl,
    

    refresh_token_enc:     encrypt(refresh_token),
    access_token_cache:    access_token,
    access_token_expires_at: new Date(
      Date.now() + expires_in * 1000
    ).toISOString(),
    password_enc: encrypt(userPassword),
  },
  { onConflict: 'kick_user_id' }
);
if (upsertErr) throw upsertErr;  
    
    // 7. Sign in to Supabase (sets sb-access-token & sb-refresh-token cookies)
    const supabase = createPagesServerClient({ req, res });
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email,
      password: userPassword,
    });
    if (signErr) throw signErr;

    // 8. Clear PKCE & state cookies
    res.setHeader('Set-Cookie', [
      'pkce_verifier=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
      'oauth_state=;     Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
    ]);
  
    // 9. Redirect home
    res.redirect(302, '/');
    return;
   } catch (err: any) {
    console.error('Kick callback error →', err);
    return res.status(500).send(err.message);
  }
}
