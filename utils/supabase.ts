import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Shared Supabase client (anonymous key -- read-only in our case).
 * Throw immediately if the env vars aren’t present so we fail fast in CI.
 */
if (!supabaseUrl || !supabaseAnon) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local'
  );
}

export const supa = createClient(supabaseUrl, supabaseAnon);
