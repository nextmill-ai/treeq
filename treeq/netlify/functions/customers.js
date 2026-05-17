// Customers CRM API (Task 7)
//
// Routes:
//   GET    /.netlify/functions/customers                  - list (q, limit, offset)
//   GET    /.netlify/functions/customers?id=<uuid>        - single + properties[]
//   POST   /.netlify/functions/customers                  - create
//   PATCH  /.netlify/functions/customers?id=<uuid>        - update
//   DELETE /.netlify/functions/customers?id=<uuid>        - soft delete (archived_at)
//
// Table: public.crm_customers (account_id-scoped via RLS).
// Roles: owner/admin/estimator can write; viewer is read-only; owner/admin can archive.

import {
  cors204, json, ok, created, noContent,
  requireAuth, resolveProfile, requireRole,
  parseJson, getSupabase,
} from "./_lib/auth-guard.js";

const WRITER_ROLES = ["owner", "admin", "estimator"];
const ADMIN_ROLES  = ["owner", "admin"];

const SELECT_COLS = "id, account_id, name, primary_phone, primary_email, notes, created_by_user_id, archived_at, created_at, updated_at";

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

  // GET - single or list
  if (event.httpMethod === "GET") {
    if (id) {
      const { data, error } = await supabase
        .from("crm_customers")
        .select(SELECT_COLS)
        .eq("account_id", profile.account_id)
        .eq("id", id)
        .maybeSingle();
      if (error) return json(500, { error: error.message });
      if (!data) return json(404, { error: "Customer not found" });

      const { data: props, error: pErr } = await supabase
        .from("crm_properties")
        .select("id, address_line1, address_line2, city, state, zip, lat, lng, notes, archived_at, created_at")
        .eq("account_id", profile.account_id)
        .eq("customer_id", id)
        .is("archived_at", null)
        .order("created_at", { ascending: true });
      if (pErr) return json(500, { error: pErr.message });

      return ok({ customer: data, properties: props || [] });
    }

    const q       = (qp.q || "").trim();
    const limit   = Math.min(parseInt(qp.limit ?? "50", 10) || 50, 200);
    const offset  = parseInt(qp.offset ?? "0", 10) || 0;
    const includeArchived = qp.archived === "1" || qp.archived === "true";

    let query = supabase
      .from("crm_customers")
      .select(SELECT_COLS, { count: "exact" })
      .eq("account_id", profile.account_id)
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (!includeArchived) query = query.is("archived_at", null);
    if (q) {
      const pattern = `%${q.replace(/[%_]/g, (m) => "\\" + m)}%`;
      query = query.or(`name.ilike.${pattern},primary_email.ilike.${pattern},primary_phone.ilike.${pattern}`);
    }

    const { data, error, count } = await query;
    if (error) return json(500, { error: error.message });
    return ok({ customers: data || [], total: count ?? 0, limit, offset });
  }

  // POST - create
  if (event.httpMethod === "POST") {
    const { err: roleErr } = requireRole(profile, WRITER_ROLES);
    if (roleErr) return roleErr;

    let body;
    try { body = parseJson(event); } catch (e) { return json(400, { error: e.message }); }
    const name = String(body.name || "").trim();
    if (!name) return json(400, { error: "name is required" });

    const row = {
      account_id: profile.account_id,
      name,
      primary_phone: body.primary_phone ? String(body.primary_phone).trim() : null,
      primary_email: body.primary_email ? String(body.primary_email).trim().toLowerCase() : null,
      notes: body.notes ? String(body.notes) : null,
      created_by_user_id: profile.id,
    };

    const { data, error } = await supabase
      .from("crm_customers")
      .insert(row)
      .select(SELECT_COLS)
      .single();
    if (error) return json(500, { error: error.message });
    return created({ customer: data });
  }

  // PATCH - update
  if (event.httpMethod === "PATCH") {
    const { err: roleErr } = requireRole(profile, WRITER_ROLES);
    if (roleErr) return roleErr;
    if (!id) return json(400, { error: "Missing id" });

    let body;
    try { body = parseJson(event); } catch (e) { return json(400, { error: e.message }); }
    const patch = {};
    if (body.name !== undefined) {
      const v = String(body.name || "").trim();
      if (!v) return json(400, { error: "name cannot be empty" });
      patch.name = v;
    }
    if (body.primary_phone !== undefined) patch.primary_phone = body.primary_phone ? String(body.primary_phone).trim() : null;
    if (body.primary_email !== undefined) patch.primary_email = body.primary_email ? String(body.primary_email).trim().toLowerCase() : null;
    if (body.notes !== undefined) patch.notes = body.notes ? String(body.notes) : null;
    if (body.archived !== undefined) patch.archived_at = body.archived ? new Date().toISOString() : null;

    if (Object.keys(patch).length === 0) return json(400, { error: "No updatable fields" });

    const { data, error } = await supabase
      .from("crm_customers")
      .update(patch)
      .eq("id", id)
      .eq("account_id", profile.account_id)
      .select(SELECT_COLS)
      .maybeSingle();
    if (error) return json(500, { error: error.message });
    if (!data) return json(404, { error: "Customer not found" });
    return ok({ customer: data });
  }

  // DELETE - soft delete (archive)
  if (event.httpMethod === "DELETE") {
    const { err: roleErr } = requireRole(profile, ADMIN_ROLES);
    if (roleErr) return roleErr;
    if (!id) return json(400, { error: "Missing id" });

    const { error } = await supabase
      .from("crm_customers")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("account_id", profile.account_id);
    if (error) return json(500, { error: error.message });
    return noContent();
  }

  return json(405, { error: "Method not allowed" });
};
