// TreeQ — drag-and-drop document upload stub.
// POST /.netlify/functions/upload-doc
//   body: { title: string, mime_type: string, size_bytes: number, content_b64?: string }
//   returns: { document_id, indexed_status: 'pending' }
//
// Stage 1: creates the knowledge_documents row + a file_upload knowledge_sources row
// if one doesn't exist yet. Does NOT actually parse or embed — that's a background
// job to add later. The admin page will show "Pending" until a real ingestion path lands.
//
// File bytes are not persisted to storage in this stub (Supabase Storage bucket
// + signed URL flow is the v0.2 piece).

import { createClient as createSupabase } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SPARTAN_ORG_ID } = process.env;

const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createSupabase(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

function json(status, body) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(body),
  };
}

async function ensureUploadSource(orgId) {
  const { data: existing } = await supabase
    .from("knowledge_sources")
    .select("*")
    .eq("org_id", orgId)
    .eq("kind", "file_upload")
    .maybeSingle();
  if (existing) return existing;
  const { data: created, error } = await supabase
    .from("knowledge_sources")
    .insert({
      org_id: orgId,
      kind: "file_upload",
      display_name: "Direct file uploads",
      status: "connected",
    })
    .select()
    .single();
  if (error) throw new Error(`knowledge_sources insert: ${error.message}`);
  return created;
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, body: "" };
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  if (!supabase) return json(500, { error: "Supabase not configured" });
  if (!SPARTAN_ORG_ID) return json(500, { error: "SPARTAN_ORG_ID not configured" });

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "Invalid JSON" }); }

  const { title, mime_type = null, size_bytes = null, external_id = null } = body;
  if (!title || typeof title !== "string") return json(400, { error: "title required" });
  if (size_bytes != null && size_bytes > 50 * 1024 * 1024) return json(413, { error: "Files >50MB not yet supported by the stub" });

  let source;
  try { source = await ensureUploadSource(SPARTAN_ORG_ID); }
  catch (e) { return json(500, { error: e.message }); }

  const { data: doc, error: docErr } = await supabase
    .from("knowledge_documents")
    .insert({
      org_id: SPARTAN_ORG_ID,
      source_id: source.id,
      external_id: external_id || null,
      title,
      mime_type,
      size_bytes,
      indexed_status: "pending",
      indexed_status_detail: "Awaiting ingestion (parse + embed pipeline not yet implemented)",
    })
    .select()
    .single();
  if (docErr) return json(500, { error: docErr.message });

  return json(200, {
    document_id: doc.id,
    source_id: source.id,
    indexed_status: doc.indexed_status,
  });
};
