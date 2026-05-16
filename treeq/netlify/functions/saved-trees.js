// TreeQ — persist a field-measured tree profile for the signed-in user.
// POST /.netlify/functions/saved-trees
//
// Expects public.saved_trees (org_id, user_id, species_key, dbh, height_ft, crown_ft,
// trim_bucket, cuts, seconds_total, notes?, lat?, lng?, …) — service role insert.

import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient as createSupabase } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET } = process.env;

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createSupabase(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null;

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}

function parseBearer(event) {
  const raw = event.headers?.authorization || event.headers?.Authorization;
  if (!raw || typeof raw !== "string") return null;
  const m = /^Bearer\s+(\S+)$/i.exec(raw.trim());
  return m ? m[1] : null;
}

function base64UrlToBuffer(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

/**
 * HS256 JWT used by Supabase Auth (iss + aud + exp + sub).
 * @returns {{ sub: string }} | null
 */
function verifySupabaseJwt(token, secret, supabaseUrl) {
  if (!token || !secret || !supabaseUrl) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, sigB64] = parts;
  const signingInput = `${h}.${p}`;
  const expected = createHmac("sha256", secret).update(signingInput).digest();
  let sig;
  try {
    sig = base64UrlToBuffer(sigB64);
  } catch {
    return null;
  }
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  let payload;
  try {
    payload = JSON.parse(base64UrlToBuffer(p).toString("utf8"));
  } catch {
    return null;
  }
  const issuer = `${String(supabaseUrl).replace(/\/$/, "")}/auth/v1`;
  if (payload.iss !== issuer) return null;
  if (payload.aud !== "authenticated") return null;
  if (typeof payload.exp === "number" && payload.exp < Date.now() / 1000) return null;
  if (!payload.sub || typeof payload.sub !== "string") return null;
  return { sub: payload.sub };
}

function isMissing(v) {
  return v === undefined || v === null;
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, body: "" };
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  if (!supabase) return json(500, { error: "Supabase not configured" });
  if (!SUPABASE_JWT_SECRET) return json(500, { error: "SUPABASE_JWT_SECRET not configured" });

  const token = parseBearer(event);
  if (!token) return json(401, { error: "Missing or invalid Authorization bearer token" });

  const claims = verifySupabaseJwt(token, SUPABASE_JWT_SECRET, SUPABASE_URL);
  if (!claims) return json(401, { error: "Invalid or expired token" });

  let body;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const required = [
    "species_key",
    "dbh",
    "height_ft",
    "crown_ft",
    "trim_bucket",
    "cuts",
    "seconds_total",
  ];
  const missing = [];
  for (const key of required) {
    if (isMissing(body[key])) missing.push(key);
  }
  if (
    !isMissing(body.species_key) &&
    typeof body.species_key === "string" &&
    body.species_key.trim() === ""
  ) {
    if (!missing.includes("species_key")) missing.push("species_key");
  }
  if (missing.length) return json(400, { error: "Missing required fields", missing });

  const row = {
    user_id: claims.sub,
    species_key: body.species_key,
    dbh: body.dbh,
    height_ft: body.height_ft,
    crown_ft: body.crown_ft,
    trim_bucket: body.trim_bucket,
    cuts: body.cuts,
    seconds_total: body.seconds_total,
    notes: isMissing(body.notes) ? null : body.notes,
    lat: isMissing(body.lat) ? null : body.lat,
    lng: isMissing(body.lng) ? null : body.lng,
  };

  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("org_id")
    .eq("id", claims.sub)
    .maybeSingle();

  if (userErr) return json(500, { error: userErr.message });
  if (!userRow?.org_id) {
    return json(500, { error: "User organization could not be resolved; ensure public.users is provisioned for this account" });
  }

  row.org_id = userRow.org_id;

  const { data: inserted, error: insErr } = await supabase.from("saved_trees").insert(row).select().single();

  if (insErr) return json(500, { error: insErr.message });

  return json(201, inserted);
};
