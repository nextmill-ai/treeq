// P3: Saved Trees API
// GET    /.netlify/functions/saved-trees          -> list user's saved trees (newest first)
// POST   /.netlify/functions/saved-trees          -> save a new tree measurement
// DELETE /.netlify/functions/saved-trees?id=UUID  -> delete a saved tree

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

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return cors204();
  if (!supabase) return json(500, { error: "Supabase not configured" });

  const { claims, err } = await requireAuth(event);
  if (err) return err;

  let accountId;
  try {
    accountId = await resolveAccountId(supabase, claims.sub);
  } catch (e) {
    return json(500, { error: e.message });
  }

  // GET: list saved trees --------------------------------------------------
  if (event.httpMethod === "GET") {
    const qp = event.queryStringParameters || {};
    const limit  = Math.min(parseInt(qp.limit  ?? "50", 10) || 50, 200);
    const offset = parseInt(qp.offset ?? "0", 10) || 0;

    const { data, error, count } = await supabase
      .from("saved_trees")
      .select("*", { count: "exact" })
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return json(500, { error: error.message });
    return json(200, { trees: data, total: count, limit, offset });
  }

  // POST: save a tree -------------------------------------------------------
  if (event.httpMethod === "POST") {
    let body;
    try { body = event.body ? JSON.parse(event.body) : {}; } catch {
      return json(400, { error: "Invalid JSON" });
    }

    const required = ["species_key", "dbh", "height_ft", "crown_ft", "trim_bucket", "cuts", "seconds_total"];
    const missing = required.filter((k) => body[k] == null);
    if (missing.length) return json(400, { error: "Missing required fields", missing });
    if (typeof body.species_key !== "string" || !body.species_key.trim()) {
      return json(400, { error: "species_key must be a non-empty string" });
    }

    const row = {
      account_id:    accountId,
      user_id:       claims.sub,
      species_key:   body.species_key.trim(),
      dbh:           Number(body.dbh),
      height_ft:     body.height_ft  != null ? Number(body.height_ft)  : null,
      crown_ft:      body.crown_ft   != null ? Number(body.crown_ft)   : null,
      trim_bucket:   Number(body.trim_bucket),
      cuts:          Number(body.cuts),
      seconds_total: Number(body.seconds_total),
      notes:         body.notes      ?? null,
      lat:           body.lat        ?? null,
      lng:           body.lng        ?? null,
      accuracy_m:    body.accuracy_m ?? null,
    };

    const { data: inserted, error: insErr } = await supabase
      .from("saved_trees")
      .insert(row)
      .select()
      .single();

    if (insErr) return json(500, { error: insErr.message });
    return json(201, inserted);
  }

  // DELETE: remove one tree by id ------------------------------------------
  if (event.httpMethod === "DELETE") {
    const id = event.queryStringParameters?.id;
    if (!id) return json(400, { error: "id query param required" });

    const { error } = await supabase
      .from("saved_trees")
      .delete()
      .eq("id", id)
      .eq("account_id", accountId);

    if (error) return json(500, { error: error.message });
    return json(200, { deleted: id });
  }

  return json(405, { error: "Method not allowed" });
};