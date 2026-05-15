import { jwtVerify } from 'jose';

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
 * @param {string} token
 * @param {Record<string, string | undefined>} env
 */
export async function verifySupabaseUserJwt(token, env) {
  const secret = env.SUPABASE_JWT_SECRET;
  const base = env.SUPABASE_URL;
  if (!secret || !base) {
    throw new Error('Missing SUPABASE_JWT_SECRET or SUPABASE_URL');
  }
  const key = new TextEncoder().encode(secret);
  const issuer = `${String(base).replace(/\/$/, '')}/auth/v1`;
  return jwtVerify(token, key, {
    algorithms: ['HS256'],
    issuer,
    audience: 'authenticated',
  });
}
