// P1: Favorites API
// GET    /.netlify/functions/favorites          → list account's favorite species keys
// POST   /.netlify/functions/favorites          → add a species key  { species_key }
// DELETE /.netlify/functions/favorites          → remove a species key { species_key }

import { createClient } from "@supabase/supabase-js";
import {
  cors204, json, requireAuth, resolveAccountId,
} from "./_lib/auth-guard.js";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })
    : null;

function noSupabase() {
  return json(500, { error: "Supabase not configured" });
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return cors204();
  if (!supabase) return noSupabase();

  const { claims, err } = await requireAuth(event);
  if (err) return err;

  let accountId;
  try {
    accountId = await resolveAccountId(supabase, claims.sub);
  } catch (e) {
    return json(500, { error: e.message });
  }

  // ── GET: list favorites ───────────────────────────────────────────────
  if (event.httpMethod === "GET") {
    const { data, error } = await supabase
      .from("favorites")
      .select("species_key, created_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: true });

    if (error) return json(500, { error: error.message });
    return json(200, { favorites: data.map((r) => r.species_key) });
  }

  // ── POST: add favorite ────────────────────────────────────────────────
  if (event.httpMethod === "POST") {
    let body;
    try { body = event.body ? JSON.parse(event.body) : {}; } catch {
      return json(400, { error: "Invalid JSON" });
    }
    const key = body.species_key;
    if (!key || typeof key !== "string" || key.trim() === "") {
      return json(400, { error: "species_key is required" });
    }

    const { error } = await supabase
      .from("favorites")
      .upsert({ account_id: accountId, species_key: key.trim() }, { onConflict: "account_id,species_key" });

    if (error) return json(500, { error: error.message });
    return json(201, { added: key.trim() });
  }

  // ── DELETE: remove favorite ───────────────────────────────────────────
  if (event.httpMethod === "DELETE") {
    let body;
    try { body = event.body ? JSON.parse(event.body) : {}; } catch {
      return json(400, { error: "Invalid JSON" });
    }
    const key = body.species_key;
    if (!key || typeof key !== "string" || key.trim() === "") {
      return json(400, { error: "species_key is required" });
    }

    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("account_id", accountId)
      .eq("species_key", key.trim());

    if (error) return json(500, { error: error.message });
    return json(200, { removed: key.trim() });
  }

  return json(405, { error: "Method not allowed" });
};
