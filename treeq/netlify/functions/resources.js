// P4: Resources API
// GET /.netlify/functions/resources          -> list all resource settings for the account
// PUT /.netlify/functions/resources          -> upsert one or many resource rows
//   Body: { resources: [{ resource_key, owned, size_matrix? }] }

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

// Canonical resource keys from roadmap F4.1 — enforced server-side.
const VALID_RESOURCE_KEYS = new Set([
  "mini_skid_steer",
  "skid_steer",
  "articulating_loader",
  "equipment_trailer",
  "chipper",
  "grapple_saw_truck",
  "crane",
  "bucket_truck",
  "spider_lift",
  "support_truck",
  "advanced_rigging",
  "chipper_truck",
  "log_truck",
  "turf_mats",
  "traffic_control",
]);

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

  // GET: return all resource settings for the account ---------------------
  if (event.httpMethod === "GET") {
    const { data, error } = await supabase
      .from("account_resources")
      .select("resource_key, owned, size_matrix, updated_at")
      .eq("account_id", accountId);

    if (error) return json(500, { error: error.message });

    // Fill in defaults for any keys not yet persisted (owned=false, no matrix).
    const byKey = Object.fromEntries(data.map((r) => [r.resource_key, r]));
    const full = [...VALID_RESOURCE_KEYS].map((key) => ({
      resource_key: key,
      owned: false,
      size_matrix: null,
      ...(byKey[key] || {}),
    }));

    return json(200, { resources: full });
  }

  // PUT: upsert resource settings -----------------------------------------
  if (event.httpMethod === "PUT") {
    let body;
    try { body = event.body ? JSON.parse(event.body) : {}; } catch {
      return json(400, { error: "Invalid JSON" });
    }

    if (!Array.isArray(body.resources) || body.resources.length === 0) {
      return json(400, { error: "resources array is required" });
    }

    const invalid = body.resources
      .map((r) => r.resource_key)
      .filter((k) => !VALID_RESOURCE_KEYS.has(k));
    if (invalid.length) {
      return json(400, { error: "Unknown resource_key values", invalid });
    }

    const rows = body.resources.map((r) => ({
      account_id:   accountId,
      resource_key: r.resource_key,
      owned:        !!r.owned,
      size_matrix:  r.size_matrix ?? null,
      updated_at:   new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("account_resources")
      .upsert(rows, { onConflict: "account_id,resource_key" })
      .select("resource_key, owned, size_matrix, updated_at");

    if (error) return json(500, { error: error.message });
    return json(200, { resources: data });
  }

  return json(405, { error: "Method not allowed" });
};