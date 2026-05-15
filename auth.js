// TreeQ — shared auth module.
//
// Flag-gated. While TREEQ_AUTH_DISABLED is truthy (the default for the v0.1
// free build), every export is a no-op and pages can import this safely
// without any behavior change. When the flag flips, an unauthenticated user
// is routed to /login.html before any gated page renders.
//
// Wire from each page:
//
//   <script type="module">
//     import { requireAuth, currentUser } from './auth.js';
//     await requireAuth({ redirectTo: '/login.html' });
//     const u = await currentUser();
//   </script>
//
// Implementation note: Supabase Auth client is loaded only when the flag is on,
// to keep the unauthenticated bundle small.

const FLAG_KEY = 'TREEQ_AUTH_DISABLED';
const DEFAULT_DISABLED = true;

function authDisabled() {
  // Allow a window global to override the flag (e.g. for the test panel).
  if (typeof window !== 'undefined' && window[FLAG_KEY] != null) return !!window[FLAG_KEY];
  // Otherwise default to disabled.
  return DEFAULT_DISABLED;
}

let supabaseClient = null;
async function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const url = window.SUPABASE_URL || '';
  const key = window.SUPABASE_ANON_KEY || '';
  if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY not set on window.');
  supabaseClient = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  return supabaseClient;
}

export async function requireAuth({ redirectTo = '/login.html' } = {}) {
  if (authDisabled()) return { mode: 'disabled', user: null };
  try {
    const sb = await getSupabase();
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    if (!data?.session) {
      const target = redirectTo + '?next=' + encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(target);
      // Stop further rendering on the page.
      return await new Promise(() => {});
    }
    return { mode: 'authenticated', user: data.session.user };
  } catch (e) {
    console.error('auth.requireAuth failed:', e);
    return { mode: 'error', user: null, error: e.message };
  }
}

export async function currentUser() {
  if (authDisabled()) return null;
  const sb = await getSupabase();
  const { data } = await sb.auth.getUser();
  return data?.user ?? null;
}

export async function signOut() {
  if (authDisabled()) return;
  const sb = await getSupabase();
  await sb.auth.signOut();
  window.location.replace('/login.html');
}

export function isAuthDisabled() { return authDisabled(); }

// Tiny diagnostic so it's clear at runtime which mode you're in.
if (typeof window !== 'undefined') {
  window.__treeq_auth__ = { disabled: authDisabled() };
}
