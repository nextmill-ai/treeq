// Shared retrieval helper — embeds a query and pulls top-K knowledge_chunks
// scoped to a single org via the match_knowledge_chunks RPC.
//
// Stateless. The caller passes in a supabase client (service-role) so this
// module doesn't reimplement env loading.

const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIM = 1536;

export async function embedQuery(text, openaiApiKey) {
  if (!openaiApiKey) throw new Error("OPENAI_API_KEY not configured");
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiApiKey}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: [text], dimensions: EMBED_DIM }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`OpenAI embeddings ${resp.status}: ${body.slice(0, 300)}`);
  }
  const data = await resp.json();
  return data.data[0].embedding;
}

// Returns { chunks: [...], used_retrieval: bool }.
// Falls through with used_retrieval=false if no chunks exist for the org
// or the embedding call fails — caller decides what to do then.
export async function retrieveChunks({ supabase, openaiApiKey, orgId, queryText, k = 8 }) {
  if (!supabase || !orgId) return { chunks: [], used_retrieval: false, reason: "no_supabase_or_org" };
  if (!queryText || !queryText.trim()) return { chunks: [], used_retrieval: false, reason: "empty_query" };

  // Cheap pre-check: do we have ANY chunks for this org?
  const { count, error: cntErr } = await supabase
    .from("knowledge_chunks")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);
  if (cntErr || !count) return { chunks: [], used_retrieval: false, reason: cntErr ? cntErr.message : "no_chunks_indexed" };

  let embedding;
  try { embedding = await embedQuery(queryText, openaiApiKey); }
  catch (e) {
    console.error("embedQuery failed:", e.message);
    return { chunks: [], used_retrieval: false, reason: "embed_failed" };
  }

  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    p_org_id: orgId,
    p_query_embedding: embedding,
    p_match_count: k,
  });
  if (error) {
    console.error("match_knowledge_chunks rpc failed:", error.message);
    return { chunks: [], used_retrieval: false, reason: error.message };
  }
  return { chunks: data || [], used_retrieval: true };
}

// Build a system-context message body from retrieved chunks. Pass to Anthropic
// as the first user message (same shape as the legacy Notion-stuffing path).
export function chunksToContextMessage(chunks) {
  const lines = [
    `## Operational context (retrieved ${chunks.length} relevant records)`,
    "",
    "Each item below is one record from the tenant's indexed sources. When citing in `answer_question`, use the `ref_id` shown.",
    "",
  ];
  for (const c of chunks) {
    lines.push("---");
    lines.push(`title: ${c.document_title}`);
    lines.push(`kind: ${c.document_source_kind}`);
    lines.push(`ref_id: ${c.external_id || c.chunk_id}`);
    lines.push(`similarity: ${(c.similarity || 0).toFixed(3)}`);
    lines.push("");
    lines.push(c.chunk_text);
    lines.push("");
  }
  return { role: "user", content: [{ type: "text", text: lines.join("\n") }] };
}
