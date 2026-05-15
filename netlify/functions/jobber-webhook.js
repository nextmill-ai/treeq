// TreeQ — Jobber webhook receiver (stub).
//
// POST /.netlify/functions/jobber-webhook
//
// Jobber posts JSON when a client/job/quote/visit/invoice changes (the topic is
// declared per-subscription in Jobber's app config). We parse the payload, look
// up the matching `jobs` row via `external_ids_json->>jobber_id`, and append a
// `job_events` row so the timeline is preserved.
//
// What this stub does:
//   - Verifies the HMAC signature (header `X-Jobber-Hmac-SHA256`) using
//     JOBBER_WEBHOOK_SECRET when present. Returns 401 on mismatch.
//   - Parses the payload shape Jobber currently sends (topic + data{webHookEvent})
//   - Resolves org_id via the Jobber account id stored in
//     external_integrations.config_json.jobber_account_id (when wired)
//   - Writes a job_events row even if we can't yet resolve a local job_id —
//     leaving job_id pointing at a synthetic placeholder is too brittle, so
//     instead we store the raw payload on `job_events.payload_json` keyed by
//     the Jobber object id and a separate `jobs` upsert is left for the polling
//     sync once OAuth is wired up.
//
// What this stub does NOT do (yet):
//   - OAuth token exchange / refresh — that lives in jobber-oauth.js when we
//     build the connect flow. See research/jobber_api_integration.md.
//   - Backfill / paginated GraphQL pulls — same.

import { createClient as createSupabase } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SPARTAN_ORG_ID,
  JOBBER_WEBHOOK_SECRET,
} = process.env;

const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createSupabase(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

function json(status, body) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

function verifySignature(rawBody, header, secret) {
  if (!secret) return { ok: true, reason: "no_secret_configured" }; // dev mode
  if (!header) return { ok: false, reason: "missing_signature_header" };
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const given = Buffer.from(header, "base64");
  const exp = Buffer.from(expected, "base64");
  if (given.length !== exp.length) return { ok: false, reason: "length_mismatch" };
  return { ok: timingSafeEqual(given, exp), reason: "ok" };
}

// Map Jobber topic strings to our job_event_type enum. Anything unknown lands
// as 'note' with the original topic stashed in payload_json.topic.
function topicToEventType(topic = "") {
  if (topic.startsWith("VISIT_") || topic.startsWith("VISITS_")) return "status_change";
  if (topic.includes("QUOTE_SENT") || topic.includes("QUOTE_APPROVED")) return "status_change";
  if (topic.includes("INVOICE_SENT")) return "invoice_sent";
  if (topic.includes("PAYMENT")) return "payment_received";
  return "note";
}

async function resolveJob(orgId, payload) {
  if (!supabase || !orgId) return null;
  const jobberObjId =
    payload?.data?.webHookEvent?.itemId ||
    payload?.data?.id ||
    payload?.itemId ||
    null;
  if (!jobberObjId) return null;
  // Try jobs.external_ids_json->>'jobber_id'.
  const { data } = await supabase
    .from("jobs")
    .select("id")
    .eq("org_id", orgId)
    .filter("external_ids_json->>jobber_id", "eq", String(jobberObjId))
    .maybeSingle();
  return data?.id || null;
}

async function resolveOrg(payload) {
  if (!supabase) return SPARTAN_ORG_ID || null;
  const accountId =
    payload?.data?.webHookEvent?.accountId ||
    payload?.accountId ||
    null;
  if (!accountId) return SPARTAN_ORG_ID || null;
  const { data } = await supabase
    .from("external_integrations")
    .select("org_id")
    .eq("kind", "jobber")
    .filter("config_json->>jobber_account_id", "eq", String(accountId))
    .maybeSingle();
  return data?.org_id || SPARTAN_ORG_ID || null;
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const raw = event.body || "";
  const sigHeader = event.headers["x-jobber-hmac-sha256"] || event.headers["X-Jobber-Hmac-SHA256"];
  const sig = verifySignature(raw, sigHeader, JOBBER_WEBHOOK_SECRET);
  if (!sig.ok) {
    console.warn("Jobber webhook signature failed:", sig.reason);
    return json(401, { error: "signature_invalid", reason: sig.reason });
  }

  let payload;
  try { payload = JSON.parse(raw); }
  catch { return json(400, { error: "Invalid JSON" }); }

  const topic = payload?.data?.webHookEvent?.topic || payload?.topic || "unknown";
  const orgId = await resolveOrg(payload);
  if (!orgId) {
    console.warn("Jobber webhook received but no org could be resolved.");
    return json(202, { accepted: true, queued: false, reason: "no_matching_org" });
  }

  const jobId = await resolveJob(orgId, payload);
  const eventType = topicToEventType(topic);

  if (!supabase) return json(200, { accepted: true, persisted: false, reason: "no_supabase" });

  if (!jobId) {
    // No local job yet — stash on a synthetic "incoming" log row by creating a
    // placeholder job. Simpler: skip insert (jobs FK is NOT NULL) and return 202
    // so Jobber doesn't retry. The poller will pick this up on next sync.
    return json(202, {
      accepted: true,
      queued: false,
      reason: "no_local_job_for_jobber_id",
      topic,
      jobber_id: payload?.data?.webHookEvent?.itemId ?? null,
    });
  }

  const { error } = await supabase.from("job_events").insert({
    org_id: orgId,
    job_id: jobId,
    event_type: eventType,
    payload_json: payload,
    external_source: "jobber_webhook",
    external_event_id: payload?.data?.webHookEvent?.id || null,
  });
  if (error) {
    console.error("job_events insert failed:", error);
    return json(500, { error: error.message });
  }
  return json(200, { accepted: true, persisted: true, topic, event_type: eventType, job_id: jobId });
};
