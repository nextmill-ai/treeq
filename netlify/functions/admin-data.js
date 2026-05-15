// TreeQ — read-only data feed for the owner admin page.
// GET /.netlify/functions/admin-data
//   returns: { sources: [...], documents: [...], counts: {...} }
//
// Stage 1: hardcoded to SPARTAN_ORG_ID, no auth. When auth lands, this needs
// to read the org_id from the auth.uid().

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

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, body: "" };
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });
  if (!supabase) return json(500, { error: "Supabase not configured" });
  if (!SPARTAN_ORG_ID) return json(500, { error: "SPARTAN_ORG_ID not configured" });

  const [sourcesRes, docsRes, chunksCount] = await Promise.all([
    supabase
      .from("knowledge_sources")
      .select("*")
      .eq("org_id", SPARTAN_ORG_ID)
      .order("created_at", { ascending: false }),
    supabase
      .from("knowledge_documents")
      .select("id,source_id,title,uri,mime_type,indexed_status,indexed_status_detail,chunk_count,last_indexed_at,updated_at,metadata_json,external_id")
      .eq("org_id", SPARTAN_ORG_ID)
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("knowledge_chunks")
      .select("*", { count: "exact", head: true })
      .eq("org_id", SPARTAN_ORG_ID),
  ]);

  if (sourcesRes.error) return json(500, { error: sourcesRes.error.message });
  if (docsRes.error) return json(500, { error: docsRes.error.message });

  return json(200, {
    sources: sourcesRes.data || [],
    documents: docsRes.data || [],
    counts: {
      sources: (sourcesRes.data || []).length,
      documents: (docsRes.data || []).length,
      chunks: chunksCount.count || 0,
    },
  });
};
