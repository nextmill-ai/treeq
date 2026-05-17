// Properties CRM API (Task 8)
//
// Routes:
//   GET    /.netlify/functions/properties?customer_id=<uuid> - list a customer's properties
//   GET    /.netlify/functions/properties?id=<uuid>          - single
//   POST   /.netlify/functions/properties                    - create
//   PATCH  /.netlify/functions/properties?id=<uuid>          - update
//   DELETE /.netlify/functions/properties?id=<uuid>          - archive
//
// Table: public.crm_properties (account_id-scoped via RLS).

import {
  cors204, json, ok, created, noContent,
  requireAuth, resolveProfile, requireRole,
  parseJson, getSupabase,
} from "./_lib/auth-guard.js";

const WRITER_ROLES = ["owner", "admin", "estimator"];
const ADMIN_ROLES  = ["owner", "admin"];

const SELECT_COLS = "id, account_id, customer_id, address_line1, address_line2, city, state, zip, lat, lng, notes, archived_at, created_at, updated_at";

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return cors204();
  const supabase = getSupabase();
  if (!supabase) return json(500, { error: "Supabase not configured" });

  const { claims, err } = await requireAuth(event);
  if (err) return err;

  let profile;
  try {
    profile = await resolveProfile(supabase, claims.sub);
  } catch (e) {
    return json(500, { error: e.message });
  }

  const qp = event.queryStringParameters || {};
  const id = qp.id;
  const customerId = qp.customer_id;

  if (event.httpMethod === "GET") {
    if (id) {
      const { data, error } = await supabase
        .from("crm_properties")
        .select(SELECT_COLS)
        .eq("account_id", profile.account_id)
        .eq("id", id)
        .maybeSingle();
      if (error) return json(500, { error: error.message });
      if (!data) return json(404, { error: "Property not found" });
      return ok({ property: data });
    }

    let query = supabase
      .from("crm_properties")
      .select(SELECT_COLS, { count: "exact" })
      .eq("account_id", profile.account_id)
      .is("archived_at", null)
      .order("created_at", { ascending: true });
    if (customerId) query = query.eq("customer_id", customerId);

    const { data, error, count } = await query;
    if (error) return json(500, { error: error.message });
    return ok({ properties: data || [], total: count ?? 0 });
  }

  if (event.httpMethod === "POST") {
    const { err: roleErr } = requireRole(profile, WRITER_ROLES);
    if (roleErr) return roleErr;

    let body;
    try { body = parseJson(event); } catch (e) { return json(400, { error: e.message }); }
    const customer_id   = String(body.customer_id || "").trim();
    const address_line1 = String(body.address_line1 || "").trim();
    if (!customer_id)   return json(400, { error: "customer_id is required" });
    if (!address_line1) return json(400, { error: "address_line1 is required" });

    const row = {
      account_id: profile.account_id,
      customer_id,
      address_line1,
      address_line2: body.address_line2 ? String(body.address_line2).trim() : null,
      city:          body.city ? String(body.city).trim() : null,
      state:         body.state ? String(body.state).trim() : null,
      zip:           body.zip ? String(body.zip).trim() : null,
      lat:           typeof body.lat === "number" ? body.lat : null,
      lng:           typeof body.lng === "number" ? body.lng : null,
      notes:         body.notes ? String(body.notes) : null,
    };

    const { data, error } = await supabase
      .from("crm_properties")
      .insert(row)
      .select(SELECT_COLS)
      .single();
    if (error) return json(500, { error: error.message });
    return created({ property: data });
  }

  if (event.httpMethod === "PATCH") {
    const { err: roleErr } = requireRole(profile, WRITER_ROLES);
    if (roleErr) return roleErr;
    if (!id) return json(400, { error: "Missing id" });

    let body;
    try { body = parseJson(event); } catch (e) { return json(400, { error: e.message }); }
    const patch = {};
    if (body.address_line1 !== undefined) {
      const v = String(body.address_line1 || "").trim();
      if (!v) return json(400, { error: "address_line1 cannot be empty" });
      patch.address_line1 = v;
    }
    ["address_line2", "city", "state", "zip", "notes"].forEach((k) => {
      if (body[k] !== undefined) patch[k] = body[k] ? String(body[k]).trim() : null;
    });
    if (body.lat !== undefined) patch.lat = typeof body.lat === "number" ? body.lat : null;
    if (body.lng !== undefined) patch.lng = typeof body.lng === "number" ? body.lng : null;
    if (body.archived !== undefined) patch.archived_at = body.archived ? new Date().toISOString() : null;

    if (Object.keys(patch).length === 0) return json(400, { error: "No updatable fields" });

    const { data, error } = await supabase
      .from("crm_properties")
      .update(patch)
      .eq("id", id)
      .eq("account_id", profile.account_id)
      .select(SELECT_COLS)
      .maybeSingle();
    if (error) return json(500, { error: error.message });
    if (!data) return json(404, { error: "Property not found" });
    return ok({ property: data });
  }

  if (event.httpMethod === "DELETE") {
    const { err: roleErr } = requireRole(profile, ADMIN_ROLES);
    if (roleErr) return roleErr;
    if (!id) return json(400, { error: "Missing id" });

    const { error } = await supabase
      .from("crm_properties")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("account_id", profile.account_id);
    if (error) return json(500, { error: error.message });
    return noContent();
  }

  return json(405, { error: "Method not allowed" });
};
