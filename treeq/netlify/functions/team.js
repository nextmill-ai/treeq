// P5: Team API (employees + subcontractors)
//
// GET    /api/team?kind=employees|subcontractors     -> list all (active + inactive)
// POST   /api/team?kind=employees|subcontractors     -> create one
// PATCH  /api/team?kind=employees|subcontractors&id= -> update one
// DELETE /api/team?kind=employees|subcontractors&id= -> deactivate (soft-delete)

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

const EMPLOYEE_ROLES      = ["ground_crew", "foreman", "bucket_operator", "aerial_arborist"];
const EMPLOYEE_SENIORITY  = ["junior", "regular", "senior"];
const SUB_SERVICES        = ["contract_climbing", "crane", "log_truck", "stump_grinding", "stump_full_service"];

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

  const qp   = event.queryStringParameters || {};
  const kind = qp.kind;
  const id   = qp.id;

  if (kind !== "employees" && kind !== "subcontractors") {
    return json(400, { error: "kind query param must be 'employees' or 'subcontractors'" });
  }

  const table = kind; // table names match

  // GET: list ---------------------------------------------------------------
  if (event.httpMethod === "GET") {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: true });

    if (error) return json(500, { error: error.message });
    return json(200, { [kind]: data });
  }

  // POST: create ------------------------------------------------------------
  if (event.httpMethod === "POST") {
    let body;
    try { body = event.body ? JSON.parse(event.body) : {}; } catch {
      return json(400, { error: "Invalid JSON" });
    }

    let row;
    if (kind === "employees") {
      const { name, role, seniority, hire_date, jobber_id } = body;
      if (!name || !role || !seniority) {
        return json(400, { error: "name, role, seniority are required" });
      }
      if (!EMPLOYEE_ROLES.includes(role)) {
        return json(400, { error: "Invalid role", valid: EMPLOYEE_ROLES });
      }
      if (!EMPLOYEE_SENIORITY.includes(seniority)) {
        return json(400, { error: "Invalid seniority", valid: EMPLOYEE_SENIORITY });
      }
      row = { account_id: accountId, name: name.trim(), role, seniority, hire_date: hire_date ?? null, jobber_id: jobber_id ?? null };
    } else {
      const { name, service, contact, default_rate } = body;
      if (!name || !service) {
        return json(400, { error: "name, service are required" });
      }
      if (!SUB_SERVICES.includes(service)) {
        return json(400, { error: "Invalid service", valid: SUB_SERVICES });
      }
      row = { account_id: accountId, name: name.trim(), service, contact: contact ?? null, default_rate: default_rate ?? null };
    }

    const { data, error } = await supabase.from(table).insert(row).select().single();
    if (error) return json(500, { error: error.message });
    return json(201, data);
  }

  // PATCH: update -----------------------------------------------------------
  if (event.httpMethod === "PATCH") {
    if (!id) return json(400, { error: "id query param required" });

    let body;
    try { body = event.body ? JSON.parse(event.body) : {}; } catch {
      return json(400, { error: "Invalid JSON" });
    }

    // Only allow safe fields to be updated.
    const allowed = kind === "employees"
      ? ["name", "role", "seniority", "hire_date", "active", "jobber_id"]
      : ["name", "service", "contact", "default_rate", "active"];

    const updates = {};
    for (const field of allowed) {
      if (field in body) updates[field] = body[field];
    }

    if (Object.keys(updates).length === 0) {
      return json(400, { error: "No updatable fields provided" });
    }

    if (updates.role && !EMPLOYEE_ROLES.includes(updates.role)) {
      return json(400, { error: "Invalid role", valid: EMPLOYEE_ROLES });
    }
    if (updates.seniority && !EMPLOYEE_SENIORITY.includes(updates.seniority)) {
      return json(400, { error: "Invalid seniority", valid: EMPLOYEE_SENIORITY });
    }
    if (updates.service && !SUB_SERVICES.includes(updates.service)) {
      return json(400, { error: "Invalid service", valid: SUB_SERVICES });
    }

    const { data, error } = await supabase
      .from(table)
      .update(updates)
      .eq("id", id)
      .eq("account_id", accountId)
      .select()
      .single();

    if (error) return json(500, { error: error.message });
    if (!data)  return json(404, { error: "Record not found" });
    return json(200, data);
  }

  // DELETE: soft-delete (set active=false) ----------------------------------
  if (event.httpMethod === "DELETE") {
    if (!id) return json(400, { error: "id query param required" });

    const { data, error } = await supabase
      .from(table)
      .update({ active: false })
      .eq("id", id)
      .eq("account_id", accountId)
      .select()
      .single();

    if (error) return json(500, { error: error.message });
    if (!data)  return json(404, { error: "Record not found" });
    return json(200, { deactivated: id });
  }

  return json(405, { error: "Method not allowed" });
};