/**
 * @param {Request} request
 * @returns {string | null} raw JWT or null
 */
export function parseBearer(request) {
  const raw = request.headers.get('Authorization');
  if (!raw) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(raw.trim());
  return m ? m[1] : null;
}

/**
 * Verify a Supabase JWT by calling the Supabase auth API directly.
 * Works regardless of signing algorithm (HS256 or ECC/P-256).
 *
 * @param {string} token
 * @param {Record<string, string | undefined>} env
 * @returns {Promise<object>} Supabase user object
 */
export async function verifySupabaseUserJwt(token, env) {
  const base = env.SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY;
  if (!base || !anonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }
  const url = `${String(base).replace(/\/$/, '')}/auth/v1/user`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
  });
  if (!resp.ok) {
    throw new Error(`Token verification failed: ${resp.status}`);
  }
  return resp.json();
}
