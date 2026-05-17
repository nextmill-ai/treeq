/*
 * TQAuth — shared auth + fetch helpers (Task 10)
 *
 * Usage in any HTML page:
 *   <script>
 *     window.__SUPABASE_URL__ = 'https://<ref>.supabase.co';
 *     window.__SUPABASE_ANON_KEY__ = 'sb_publishable_xxx';
 *   </script>
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
 *   <script src="/assets/auth-client.js"></script>
 *   <script>
 *     TQAuth.requireSession().then(({ session, profile }) => { ... });
 *     TQAuth.apiFetch('/.netlify/functions/customers').then(r => r.json());
 *   </script>
 *
 * Exposes window.TQAuth with:
 *   getClient()      - returns the supabase-js client (or null if env missing)
 *   getSession()     - resolves to the current session or null
 *   getToken()       - resolves to the JWT (refreshes if needed) or null
 *   getProfile()     - cached fetch of { id, account_id, role, full_name, email }
 *   requireSession(redirectTo?) - redirect to /login.html if not signed in;
 *                                  resolves { session, profile } when signed in
 *   apiFetch(path, opts) - fetch wrapper with Authorization + JSON headers
 *   signOut()        - signs out, clears caches, redirects to /login.html
 */
(function () {
  "use strict";

  const SUPABASE_URL  = window.__SUPABASE_URL__  || "";
  const SUPABASE_ANON = window.__SUPABASE_ANON_KEY__ || "";
  const PROFILE_CACHE_KEY = "tq_profile_v1";

  let _client = null;
  function getClient() {
    if (_client) return _client;
    if (!SUPABASE_URL || !SUPABASE_ANON) return null;
    if (!window.supabase || !window.supabase.createClient) return null;
    _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    return _client;
  }

  async function getSession() {
    const c = getClient();
    if (!c) return null;
    const { data } = await c.auth.getSession();
    return data?.session || null;
  }

  async function getToken() {
    const s = await getSession();
    return s?.access_token || null;
  }

  function clearProfileCache() {
    try { sessionStorage.removeItem(PROFILE_CACHE_KEY); } catch (_) {}
  }

  async function getProfile(force = false) {
    if (!force) {
      try {
        const cached = sessionStorage.getItem(PROFILE_CACHE_KEY);
        if (cached) {
          const obj = JSON.parse(cached);
          if (obj && obj.id && obj.account_id) return obj;
        }
      } catch (_) {}
    }
    const c = getClient();
    if (!c) return null;
    const session = await getSession();
    if (!session?.user?.id) return null;

    const { data, error } = await c
      .from("profiles")
      .select("id, account_id, role, full_name")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error || !data) return null;
    const merged = { ...data, email: session.user.email || null };
    try { sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(merged)); } catch (_) {}
    return merged;
  }

  async function requireSession(redirectTo) {
    const target = redirectTo || ("/login.html?return=" + encodeURIComponent(location.pathname + location.search));
    const session = await getSession();
    if (!session) {
      location.href = target;
      return new Promise(() => {}); // halt
    }
    const profile = await getProfile();
    if (!profile) {
      location.href = target;
      return new Promise(() => {});
    }
    return { session, profile };
  }

  async function apiFetch(path, opts) {
    const o = Object.assign({}, opts || {});
    const headers = new Headers(o.headers || {});
    if (o.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const token = await getToken();
    if (token) headers.set("Authorization", "Bearer " + token);
    o.headers = headers;
    if (o.body && typeof o.body === "object" && !(o.body instanceof FormData) && !(o.body instanceof Blob)) {
      o.body = JSON.stringify(o.body);
    }
    return fetch(path, o);
  }

  async function apiJson(path, opts) {
    const r = await apiFetch(path, opts);
    let body = null;
    try { body = await r.json(); } catch (_) {}
    if (!r.ok) {
      const msg = body?.error || r.statusText || ("HTTP " + r.status);
      const err = new Error(msg);
      err.status = r.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  async function signOut() {
    const c = getClient();
    if (c) await c.auth.signOut();
    clearProfileCache();
    location.href = "/login.html";
  }

  // Convenience: format helpers used by every page
  function fmtMoney(cents) {
    const dollars = (Number(cents) || 0) / 100;
    return "$" + dollars.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }

  window.TQAuth = {
    getClient, getSession, getToken, getProfile, requireSession,
    apiFetch, apiJson, signOut, clearProfileCache,
    fmtMoney, fmtDate,
  };
})();
