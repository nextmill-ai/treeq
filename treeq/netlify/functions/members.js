// Members API (Task 6)
//
// Manages profile rows inside the caller's account: list teammates, change
// roles, remove from account. Separate from team.js which manages
// crew employees + subcontractors.
//
// Routes:
//   GET    /.netlify/functions/members           - list teammates (any role can read)
//   PATCH  /.netlify/functions/members?id=<uuid> - { role } (owner only)
//   DELETE /.netlify/functions/members?id=<uuid> - remove from account (owner only)
//
// Removal model: move the orphaned profile to a NEW empty account so the
// user keeps an auth identity (and their auth.users row) but loses access
// to this account. Cannot remove the last owner.

import {
  cors204,
  json,
  ok,
  noContent,
  requireAuth,
  resolveProfile,
  requireRole,
  parseJson,
  getSupabase,
  invalidateProfileCache,
} from "./_lib/auth-guard.js";

const VALID_ROLES = ["owner", "admin", "estimator", "viewer"];

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

  // GET - list teammates (any role)
  if (event.httpMethod === "GET") {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
      .eq("account_id", profile.account_id)
      .order("created_at", { ascending: true });

    if (error) return json(500, { error: error.message });

    // Join in auth.users emails via the admin API
    const ids = (data || []).map((p) => p.id);
    let emailsById = {};
    if (ids.length > 0) {
      try {
        // List users in batches; for v1 just look each up since the dataset is small.
        for (const id of ids) {
          const { data: u } = await supabase.auth.admin.getUserById(id);
          if (u?.user?.email) emailsById[id] = u.user.email;
        }
      } catch (_) { /* ignore email lookup failures */ }
    }
    const members = (data || []).map((p) => ({
      ...p,
      email: emailsById[p.id] || null,
      is_self: p.id === profile.id,
    }));
    return ok({ members });
  }

  // PATCH - change a teammate's role (owner only)
  if (event.httpMethod === "PATCH") {
    const { err: roleErr } = requireRole(profile, ["owner"]);
    if (roleErr) return roleErr;

    const id = event.queryStringParameters?.id;
    if (!id) return json(400, { error: "Missing id" });

    let body;
    try { body = parseJson(event); } catch (e) { return json(400, { error: e.message }); }
    const role = String(body.role || "").trim();
    if (!VALID_ROLES.includes(role)) {
      return json(400, { error: `role must be one of ${VALID_ROLES.join(", ")}` });
    }

    // Look up target
    const { data: target, error: tErr } = await supabase
      .from("profiles")
      .select("id, account_id, role")
      .eq("id", id)
      .maybeSingle();
    if (tErr) return json(500, { error: tErr.message });
    if (!target || target.account_id !== profile.account_id) {
      return json(404, { error: "Member not found" });
    }

    // Cannot demote the last owner
    if (target.role === "owner" && role !== "owner") {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("account_id", profile.account_id)
        .eq("role", "owner");
      if ((count ?? 0) <= 1) {
        return json(409, { error: "Cannot demote the last owner" });
      }
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", id)
      .select("id, account_id, role, full_name")
      .single();
    if (error) return json(500, { error: error.message });

    invalidateProfileCache(id);
    return ok({ member: data });
  }

  // DELETE - remove from account; move to orphan account, keep auth identity
  if (event.httpMethod === "DELETE") {
    const { err: roleErr } = requireRole(profile, ["owner"]);
    if (roleErr) return roleErr;

    const id = event.queryStringParameters?.id;
    if (!id) return json(400, { error: "Missing id" });

    const { data: target, error: tErr } = await supabase
      .from("profiles")
      .select("id, account_id, role, full_name")
      .eq("id", id)
      .maybeSingle();
    if (tErr) return json(500, { error: tErr.message });
    if (!target || target.account_id !== profile.account_id) {
      return json(404, { error: "Member not found" });
    }

    // Cannot remove the last owner (which would include removing self)
    if (target.role === "owner") {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("account_id", profile.account_id)
        .eq("role", "owner");
      if ((count ?? 0) <= 1) {
        return json(409, { error: "Cannot remove the last owner" });
      }
    }

    // Create an orphan account and move the profile there
    const orphanName = (target.full_name || "Removed") + " (personal)";
    const { data: orphan, error: aErr } = await supabase
      .from("accounts")
      .insert({ name: orphanName })
      .select("id")
      .single();
    if (aErr) return json(500, { error: "Failed to create orphan account: " + aErr.message });

    const { error: mErr } = await supabase
      .from("profiles")
      .update({ account_id: orphan.id, role: "owner" })
      .eq("id", id);
    if (mErr) return json(500, { error: mErr.message });

    invalidateProfileCache(id);
    return noContent();
  }

  return json(405, { error: "Method not allowed" });
};
