// Shared Supabase JWT verification for Netlify Functions.
// Usage:
//   import { parseBearer, verifySupabaseJwt, requireAuth, json } from "./_lib/auth-guard.js";
//   const { claims, err } = await requireAuth(event);
//   if (err) return err;

import { createHmac, timingSafeEqual } from "node:crypto";

export function json(status, body, extra = {}) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      ...extra,
    },
    body: JSON.stringify(body),
  };
}

export function cors204() {
  return {
    statusCode: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    },
    body: "",
  };
}

export function parseBearer(event) {
  const raw = event.headers?.authorization || event.headers?.Authorization || "";
  const m = /^Bearer\s+(\S+)$/i.exec(raw.trim());
  return m ? m[1] : null;
}

function b64urlToBuffer(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from((s + pad).replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/**
 * Verifies a Supabase HS256 JWT.
 * Returns { sub, email } on success, null on any failure.
 */
export function verifySupabaseJwt(token, jwtSecret, supabaseUrl) {
  if (!token || !jwtSecret || !supabaseUrl) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, sigB64] = parts;
  const expected = createHmac("sha256", jwtSecret).update(`${h}.${p}`).digest();
  let sig;
  try { sig = b64urlToBuffer(sigB64); } catch { return null; }
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  let payload;
  try { payload = JSON.parse(b64urlToBuffer(p).toString("utf8")); } catch { return null; }
  const issuer = `${String(supabaseUrl).replace(/\/$/, "")}/auth/v1`;
  if (payload.iss !== issuer) return null;
  if (payload.aud !== "authenticated") return null;
  if (typeof payload.exp === "number" && payload.exp < Date.now() / 1000) return null;
  if (!payload.sub || typeof payload.sub !== "string") return null;
  return { sub: payload.sub, email: payload.email || null };
}

/**
 * Convenience: parse + verify in one call. Async because the fallback path
 * uses the Supabase Auth API to validate the token.
 * Returns { claims } or { err: netlifyResponse }.
 *
 * Verification order:
 *   1. If SUPABASE_JWT_SECRET env is set, HS256-verify locally (fast).
 *   2. Otherwise, call supabase.auth.getUser(token) using the service-role
 *      client. Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
export async function requireAuth(event) {
  const { SUPABASE_JWT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL) {
    return { err: json(500, { error: "Server auth not configured (SUPABASE_URL missing)" }) };
  }
  const token = parseBearer(event);
  if (!token) return { err: json(401, { error: "Missing Authorization bearer token" }) };

  if (SUPABASE_JWT_SECRET) {
    const claims = verifySupabaseJwt(token, SUPABASE_JWT_SECRET, SUPABASE_URL);
    if (claims) return { claims };
    // fall through to API fallback if HS256 mismatch (e.g. project key rotated)
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return { err: json(500, { error: "Server auth not configured (SUPABASE_SERVICE_ROLE_KEY missing)" }) };
  }
  try {
    const sb = getSupabase();
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data?.user?.id) {
      return { err: json(401, { error: "Invalid or expired token" }) };
    }
    return { claims: { sub: data.user.id, email: data.user.email || null } };
  } catch (e) {
    return { err: json(401, { error: "Token verification failed" }) };
  }
}

/**
 * Look up account_id from public.profiles for the given auth user id (sub).
 * Returns the account_id string or throws.
 */
export async function resolveAccountId(supabase, userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.account_id) throw new Error("No account found for user");
  return data.account_id;
}

/**
 * Resolve the caller's full profile row. Cached per warm function instance
 * keyed by auth user id (sub) since this is read-only and rarely changes.
 *
 * Returns { id, account_id, role, full_name } or throws.
 */
const _profileCache = new Map();
const PROFILE_TTL_MS = 60 * 1000;

export async function resolveProfile(supabase, userId) {
  const now = Date.now();
  const cached = _profileCache.get(userId);
  if (cached && cached.expiresAt > now) return cached.row;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, account_id, role, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.account_id) throw new Error("No profile found for user");

  _profileCache.set(userId, { row: data, expiresAt: now + PROFILE_TTL_MS });
  return data;
}

/**
 * Invalidate the profile cache for a user. Call after role changes.
 */
export function invalidateProfileCache(userId) {
  if (userId) _profileCache.delete(userId);
  else _profileCache.clear();
}

/**
 * Gate a request by role.
 *   const { err } = requireRole(profile, ["owner","admin"]);
 *   if (err) return err;
 */
export function requireRole(profile, allowedRoles) {
  if (!profile || !allowedRoles?.includes(profile.role)) {
    return { err: json(403, { error: "Forbidden", role: profile?.role || null }) };
  }
  return {};
}

/** 200 OK with JSON body. */
export function ok(data) {
  return json(200, data);
}

/** 201 Created with JSON body. */
export function created(data) {
  return json(201, data);
}

/** 204 No Content. Useful for DELETE responses. */
export function noContent() {
  return {
    statusCode: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    },
    body: "",
  };
}

/**
 * Parse a JSON body from a Netlify event. Returns {} for empty bodies.
 * Throws an error on malformed JSON.
 */
export function parseJson(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    throw new Error("Invalid JSON body");
  }
}

/**
 * Build a Supabase service-role client guarded by env presence.
 * Returns null if env not set (so callers can short-circuit with a 500).
 */
import { createClient } from "@supabase/supabase-js";

export function getSupabase() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}
