// Shared Supabase client factory — used by all apps in this monorepo.
//
// Each HTML page sets these on window before importing this module:
//   window.SUPABASE_URL = '...';
//   window.SUPABASE_ANON_KEY = '...';
//
// Or set them via Netlify environment variables injected at build time.

let _client = null;

export async function getSupabase() {
  if (_client) return _client;
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const url = window.SUPABASE_URL || window.__SUPABASE_URL__ || '';
  const key = window.SUPABASE_ANON_KEY || window.__SUPABASE_ANON_KEY__ || '';
  if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY not set on window.');
  _client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  return _client;
}

export const SUPABASE_URL = 'https://bhbubaopejjxijiqmujy.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_CT6kIbqjVG5sbWLn_E1hQw_Hir_U65U';
