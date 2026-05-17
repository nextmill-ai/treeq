// CRM Quotes API (Task 9)
//
// Routes:
//   GET    /.netlify/functions/crm-quotes                              - list with filters
//   GET    /.netlify/functions/crm-quotes?id=<uuid>                    - single + lines + state changes
//   POST   /.netlify/functions/crm-quotes                              - create draft
//   PATCH  /.netlify/functions/crm-quotes?id=<uuid>                    - update + replace lines
//   POST   /.netlify/functions/crm-quotes/transition                   - state machine transition
//   DELETE /.netlify/functions/crm-quotes?id=<uuid>                    - archive
//
// Note: file is named crm-quotes.js to avoid conflict with the existing
// quotes.js (LLM-conversational estimator log) referenced by treeq-ai.js.
// Functions are served at /.netlify/functions/<filename without .js>.
//
// Tables: public.crm_quotes, public.crm_quote_lines, public.crm_quote_state_changes.
// Server recomputes total_cents from incoming lines as a safety check.

import {
  cors204, json, ok, created, noContent,
  requireAuth, resolveProfile, requireRole,
  parseJson, getSupabase,
} from "./_lib/auth-guard.js";

const WRITER_ROLES = ["owner", "admin", "estimator"];
const ADMIN_ROLES  = ["owner", "admin"];
const LEGAL_TRANSITIONS = {
  draft: ["sent"],
  sent:  ["won", "lost", "dead"],
  won:   [],
  lost:  ["sent"],
  dead:  ["sent"],
};

const QUOTE_COLS = "id, account_id, customer_id, property_id, quote_number, status, total_cents, snapshot_jsonb, notes, created_by_user_id, sent_at, won_at, lost_at, archived_at, created_at, updated_at";
const LINE_COLS  = "id, quote_id, account_id, line_type, label, detail, amount_cents, sort_order, created_at";
const SC_COLS    = "id, quote_id, account_id, from_status, to_status, changed_by_user_id, notes, changed_at";

function sanitizeLines(account_id, quote_id, rawLines) {
  if (!Array.isArray(rawLines)) return [];
  const allowed = new Set([
    "tree_removal","tree_trim","takedown","stump","haul","land_clearing",
    "landscaping","phc","planting","labor","adjustment","other",
  ]);
  return rawLines.map((l, idx) => ({
    quote_id,
    account_id,
    line_type: allowed.has(l.line_type) ? l.line_type : "other",
    label: String(l.label ?? "").slice(0, 200) || "Line item",
    detail: l.detail ? String(l.detail) : null,
    amount_cents: Math.round(Number(l.amount_cents) || 0),
    sort_order: Number.isFinite(l.sort_order) ? l.sort_order : idx,
  }));
}

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
  const path = event.path || "";
  const isTransition = /\/transition(?:\/|$)/.test(path) || qp.action === "transition";

  // POST /transition - state machine
  if (event.httpMethod === "POST" && isTransition) {
    const { err: roleErr } = requireRole(profile, WRITER_ROLES);
    if (roleErr) return roleErr;

    let body;
    try { body = parseJson(event); } catch (e) { return json(400, { error: e.message }); }
    const targetId  = String(body.id || qp.id || "").trim();
    const to_status = String(body.to_status || "").trim();
    const notes     = body.notes ? String(body.notes) : null;
    if (!targetId)  return json(400, { error: "id is required" });
    if (!to_status) return json(400, { error: "to_status is required" });

    const { data: existing, error: gErr } = await supabase
      .from("crm_quotes")
      .select("id, account_id, status")
      .eq("id", targetId)
      .eq("account_id", profile.account_id)
      .maybeSingle();
    if (gErr) return json(500, { error: gErr.message });
    if (!existing) return json(404, { error: "Quote not found" });

    const from = existing.status;
    const legal = LEGAL_TRANSITIONS[from] || [];
    const isAnyToDraft = to_status === "draft" && ADMIN_ROLES.includes(profile.role);
    if (!legal.includes(to_status) && !isAnyToDraft) {
      return json(409, { error: `Illegal transition ${from} -> ${to_status}` });
    }

    const patch = { status: to_status };
    const nowIso = new Date().toISOString();
    if (to_status === "sent") patch.sent_at = nowIso;
    if (to_status === "won")  patch.won_at  = nowIso;
    if (to_status === "lost") patch.lost_at = nowIso;

    const { data: updated, error: uErr } = await supabase
      .from("crm_quotes")
      .update(patch)
      .eq("id", targetId)
      .eq("account_id", profile.account_id)
      .select(QUOTE_COLS)
      .single();
    if (uErr) return json(500, { error: uErr.message });

    const { error: scErr } = await supabase
      .from("crm_quote_state_changes")
      .insert({
        quote_id: targetId,
        account_id: profile.account_id,
        from_status: from,
        to_status,
        changed_by_user_id: profile.id,
        notes,
      });
    if (scErr) return json(500, { error: scErr.message });

    return ok({ quote: updated });
  }

  // GET - single or list
  if (event.httpMethod === "GET") {
    if (id) {
      const { data, error } = await supabase
        .from("crm_quotes")
        .select(QUOTE_COLS + ", crm_customers(id, name), crm_properties(id, address_line1, city, state, zip)")
        .eq("account_id", profile.account_id)
        .eq("id", id)
        .maybeSingle();
      if (error) return json(500, { error: error.message });
      if (!data) return json(404, { error: "Quote not found" });

      const [{ data: lines, error: lErr }, { data: changes, error: cErr }] = await Promise.all([
        supabase.from("crm_quote_lines")
          .select(LINE_COLS)
          .eq("account_id", profile.account_id)
          .eq("quote_id", id)
          .order("sort_order", { ascending: true }),
        supabase.from("crm_quote_state_changes")
          .select(SC_COLS)
          .eq("account_id", profile.account_id)
          .eq("quote_id", id)
          .order("changed_at", { ascending: true }),
      ]);
      if (lErr) return json(500, { error: lErr.message });
      if (cErr) return json(500, { error: cErr.message });

      return ok({ quote: data, lines: lines || [], state_changes: changes || [] });
    }

    const status      = qp.status ? String(qp.status).split(",").map((s) => s.trim()).filter(Boolean) : null;
    const customer_id = qp.customer_id || null;
    const q           = (qp.q || "").trim();
    const from_date   = qp.from || null;
    const to_date     = qp.to || null;
    const limit       = Math.min(parseInt(qp.limit ?? "50", 10) || 50, 200);
    const offset      = parseInt(qp.offset ?? "0", 10) || 0;
    const includeArchived = qp.archived === "1" || qp.archived === "true";

    let query = supabase
      .from("crm_quotes")
      .select(QUOTE_COLS + ", crm_customers(id, name), crm_properties(id, address_line1, city, state, zip)", { count: "exact" })
      .eq("account_id", profile.account_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (!includeArchived)       query = query.is("archived_at", null);
    if (status && status.length) query = query.in("status", status);
    if (customer_id)             query = query.eq("customer_id", customer_id);
    if (from_date)               query = query.gte("created_at", from_date);
    if (to_date)                 query = query.lte("created_at", to_date);
    if (q) {
      const asNum = parseInt(q, 10);
      if (!Number.isNaN(asNum)) {
        query = query.eq("quote_number", asNum);
      } else {
        const pattern = "%" + q.replace(/[%_]/g, (m) => "\\" + m) + "%";
        query = query.ilike("notes", pattern);
      }
    }

    const { data, error, count } = await query;
    if (error) return json(500, { error: error.message });
    return ok({ quotes: data || [], total: count ?? 0, limit, offset });
  }

  // POST - create draft
  if (event.httpMethod === "POST") {
    const { err: roleErr } = requireRole(profile, WRITER_ROLES);
    if (roleErr) return roleErr;

    let body;
    try { body = parseJson(event); } catch (e) { return json(400, { error: e.message }); }
    const lines = Array.isArray(body.lines) ? body.lines : [];
    const lineSum = lines.reduce((s, l) => s + (Number(l.amount_cents) || 0), 0);
    const total_cents = Number.isFinite(body.total_cents) ? Math.round(body.total_cents) : Math.round(lineSum);

    const row = {
      account_id:         profile.account_id,
      customer_id:        body.customer_id || null,
      property_id:        body.property_id || null,
      snapshot_jsonb:     body.snapshot_jsonb || {},
      notes:              body.notes ? String(body.notes) : null,
      total_cents,
      created_by_user_id: profile.id,
    };

    const { data: quote, error: qErr } = await supabase
      .from("crm_quotes")
      .insert(row)
      .select(QUOTE_COLS)
      .single();
    if (qErr) return json(500, { error: qErr.message });

    if (lines.length > 0) {
      const sanitized = sanitizeLines(profile.account_id, quote.id, lines);
      const { error: lErr } = await supabase.from("crm_quote_lines").insert(sanitized);
      if (lErr) return json(500, { error: "Lines insert failed: " + lErr.message });
    }

    // Initial state change row for audit symmetry
    await supabase.from("crm_quote_state_changes").insert({
      quote_id: quote.id,
      account_id: profile.account_id,
      from_status: null,
      to_status: "draft",
      changed_by_user_id: profile.id,
      notes: "Quote created",
    });

    return created({ quote });
  }

  // PATCH - update + replace lines
  if (event.httpMethod === "PATCH") {
    const { err: roleErr } = requireRole(profile, WRITER_ROLES);
    if (roleErr) return roleErr;
    if (!id) return json(400, { error: "Missing id" });

    let body;
    try { body = parseJson(event); } catch (e) { return json(400, { error: e.message }); }
    const patch = {};
    if (body.customer_id !== undefined)    patch.customer_id    = body.customer_id || null;
    if (body.property_id !== undefined)    patch.property_id    = body.property_id || null;
    if (body.notes !== undefined)          patch.notes          = body.notes ? String(body.notes) : null;
    if (body.snapshot_jsonb !== undefined) patch.snapshot_jsonb = body.snapshot_jsonb || {};
    if (body.archived !== undefined)       patch.archived_at    = body.archived ? new Date().toISOString() : null;

    let lines;
    if (Array.isArray(body.lines)) {
      lines = body.lines;
      const lineSum = lines.reduce((s, l) => s + (Number(l.amount_cents) || 0), 0);
      patch.total_cents = Number.isFinite(body.total_cents) ? Math.round(body.total_cents) : Math.round(lineSum);
    } else if (Number.isFinite(body.total_cents)) {
      patch.total_cents = Math.round(body.total_cents);
    }

    if (Object.keys(patch).length === 0 && !lines) return json(400, { error: "No updatable fields" });

    if (Object.keys(patch).length > 0) {
      const { error: uErr } = await supabase
        .from("crm_quotes")
        .update(patch)
        .eq("id", id)
        .eq("account_id", profile.account_id);
      if (uErr) return json(500, { error: uErr.message });
    }

    if (lines) {
      const { error: dErr } = await supabase
        .from("crm_quote_lines")
        .delete()
        .eq("quote_id", id)
        .eq("account_id", profile.account_id);
      if (dErr) return json(500, { error: "Lines clear failed: " + dErr.message });

      if (lines.length > 0) {
        const sanitized = sanitizeLines(profile.account_id, id, lines);
        const { error: iErr } = await supabase.from("crm_quote_lines").insert(sanitized);
        if (iErr) return json(500, { error: "Lines insert failed: " + iErr.message });
      }
    }

    const { data: refreshed, error: rErr } = await supabase
      .from("crm_quotes")
      .select(QUOTE_COLS)
      .eq("id", id)
      .eq("account_id", profile.account_id)
      .maybeSingle();
    if (rErr) return json(500, { error: rErr.message });
    if (!refreshed) return json(404, { error: "Quote not found" });
    return ok({ quote: refreshed });
  }

  // DELETE - archive
  if (event.httpMethod === "DELETE") {
    const { err: roleErr } = requireRole(profile, ADMIN_ROLES);
    if (roleErr) return roleErr;
    if (!id) return json(400, { error: "Missing id" });

    const { error } = await supabase
      .from("crm_quotes")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("account_id", profile.account_id);
    if (error) return json(500, { error: error.message });
    return noContent();
  }

  return json(405, { error: "Method not allowed" });
};
