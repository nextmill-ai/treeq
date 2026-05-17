// Invitations API (Task 5)
//
// Routes (dispatched by httpMethod + path tail):
//   GET    /.netlify/functions/invitations             - list pending invitations (admin/owner)
//   GET    /.netlify/functions/invitations/lookup?token=... - public lookup of an invite
//   POST   /.netlify/functions/invitations             - create { email, role } (admin/owner)
//   DELETE /.netlify/functions/invitations?id=<uuid>   - revoke (admin/owner)
//
// Tokens: 24 random bytes (base64url, ~32 chars).
// Expires after 7 days (set by DB default).
//
// Invite URL embedded in the response is `${PUBLIC_BASE_URL}/login.html?invite=<token>`.
// PUBLIC_BASE_URL defaults to https://treeqapp.com.

import { randomBytes } from "node:crypto";
import {
  cors204,
  json,
  ok,
  created,
  noContent,
  requireAuth,
  resolveProfile,
  requireRole,
  parseJson,
  getSupabase,
} from "./_lib/auth-guard.js";

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://treeqapp.com";
const VALID_ROLES = ["admin", "estimator", "viewer"];

function newToken() {
  return randomBytes(24).toString("base64url");
}

function inviteUrl(token) {
  return `${PUBLIC_BASE_URL.replace(/\/$/, "")}/login.html?invite=${encodeURIComponent(token)}`;
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return cors204();
  const supabase = getSupabase();
  if (!supabase) return json(500, { error: "Supabase not configured" });

  const path = event.path || "";
  const isLookup = /\/invitations\/lookup(?:\/|$)/.test(path);

  // Public lookup (no auth) -------------------------------------------------
  if (event.httpMethod === "GET" && isLookup) {
    const token = event.queryStringParameters?.token;
    if (!token) return json(400, { error: "Missing token" });

    const { data, error } = await supabase
      .from("invitations")
      .select("email, role, account_id, expires_at, accepted_at, accounts!inner(name)")
      .eq("token", token)
      .maybeSingle();

    if (error) return json(500, { error: error.message });
    if (!data) return json(404, { error: "Invitation not found" });
    if (data.accepted_at) return json(410, { error: "Invitation already accepted" });
    if (new Date(data.expires_at) < new Date()) return json(410, { error: "Invitation expired" });

    return ok({
      email: data.email,
      role: data.role,
      account_name: data.accounts?.name || null,
      expires_at: data.expires_at,
    });
  }

  // Authenticated routes ----------------------------------------------------
  const { claims, err } = await requireAuth(event);
  if (err) return err;

  let profile;
  try {
    profile = await resolveProfile(supabase, claims.sub);
  } catch (e) {
    return json(500, { error: e.message });
  }

  // Only owner/admin manage invitations
  const { err: roleErr } = requireRole(profile, ["owner", "admin"]);
  if (roleErr) return roleErr;

  // GET - list pending invitations for caller's account
  if (event.httpMethod === "GET") {
    const { data, error } = await supabase
      .from("invitations")
      .select("id, email, role, token, expires_at, accepted_at, created_at")
      .eq("account_id", profile.account_id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });

    if (error) return json(500, { error: error.message });

    const enriched = (data || []).map((row) => ({
      ...row,
      invite_url: inviteUrl(row.token),
      expired: new Date(row.expires_at) < new Date(),
    }));
    return ok({ invitations: enriched });
  }

  // POST - create a new invitation
  if (event.httpMethod === "POST") {
    let body;
    try { body = parseJson(event); } catch (e) { return json(400, { error: e.message }); }
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "").trim();

    if (!email || !email.includes("@")) return json(400, { error: "email is required" });
    if (!VALID_ROLES.includes(role)) {
      return json(400, { error: `role must be one of ${VALID_ROLES.join(", ")}` });
    }

    const token = newToken();
    const { data, error } = await supabase
      .from("invitations")
      .insert({
        account_id: profile.account_id,
        email,
        role,
        token,
        invited_by_user_id: profile.id,
      })
      .select("id, email, role, token, expires_at, created_at")
      .single();

    if (error) return json(500, { error: error.message });

    return created({
      invitation: {
        ...data,
        invite_url: inviteUrl(data.token),
      },
    });
  }

  // DELETE - revoke
  if (event.httpMethod === "DELETE") {
    const id = event.queryStringParameters?.id;
    if (!id) return json(400, { error: "Missing id" });

    const { error } = await supabase
      .from("invitations")
      .delete()
      .eq("id", id)
      .eq("account_id", profile.account_id);

    if (error) return json(500, { error: error.message });
    return noContent();
  }

  return json(405, { error: "Method not allowed" });
};
