// TreeQ — Notion sync for the RAG layer.
// Reads the 5 Spartan source DBs (Dump Spots, Vendors, Subcontractors,
// Plant Prices, Pickup Spots), upserts each page as a knowledge_documents row,
// chunks (one chunk per record for these structured DBs), embeds via OpenAI
// text-embedding-3-small, stores in knowledge_chunks.
//
// Manual trigger: POST /.netlify/functions/sync-notion
//   body (all optional): { source_db?: 'all'|'vendors'|... , dry_run?: bool }
//
// For v0.1 this hardcodes Spartan (SPARTAN_ORG_ID env var). A future
// multi-tenant sync iterates `external_integrations` rows where kind='notion'.
//
// Embedding provider choice: OpenAI text-embedding-3-small (1536 dim).
// See HANDOFF.md for the decision record.

import { Client as NotionClient } from "@notionhq/client";
import { createClient as createSupabase } from "@supabase/supabase-js";

const {
  NOTION_API_KEY,
  OPENAI_API_KEY,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SPARTAN_ORG_ID,
  NOTION_DB_DUMP_SPOTS,
  NOTION_DB_VENDORS,
  NOTION_DB_SUBCONTRACTORS,
  NOTION_DB_PLANT_PRICES,
  NOTION_DB_PICKUP_SPOTS,
} = process.env;

const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIM = 1536;
const EMBED_BATCH = 96;          // OpenAI accepts up to 2048 inputs but we keep it small.

const notion = NOTION_API_KEY ? new NotionClient({ auth: NOTION_API_KEY }) : null;
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createSupabase(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

const SOURCE_DBS = [
  { key: "dump_spots",     envId: NOTION_DB_DUMP_SPOTS,     kindLabel: "Dump Spot",     titleProp: "site_name" },
  { key: "vendors",        envId: NOTION_DB_VENDORS,        kindLabel: "Vendor",        titleProp: "name" },
  { key: "subcontractors", envId: NOTION_DB_SUBCONTRACTORS, kindLabel: "Subcontractor", titleProp: "company_or_contact_name" },
  { key: "plant_prices",   envId: NOTION_DB_PLANT_PRICES,   kindLabel: "Plant Price",   titleProp: "plant_name" },
  { key: "pickup_spots",   envId: NOTION_DB_PICKUP_SPOTS,   kindLabel: "Pickup Spot",   titleProp: "site_name" },
];

// ---------- helpers ----------
function json(status, body) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

function flattenPage(page) {
  const out = { _id: page.id };
  for (const [name, prop] of Object.entries(page.properties || {})) {
    const v = readProp(prop);
    if (v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)) out[name] = v;
  }
  return out;
}

function readProp(prop) {
  switch (prop?.type) {
    case "title":         return prop.title.map((t) => t.plain_text).join("");
    case "rich_text":     return prop.rich_text.map((t) => t.plain_text).join("");
    case "number":        return prop.number;
    case "select":        return prop.select?.name ?? null;
    case "multi_select":  return prop.multi_select.map((s) => s.name);
    case "status":        return prop.status?.name ?? null;
    case "checkbox":      return prop.checkbox;
    case "url":           return prop.url;
    case "email":         return prop.email;
    case "phone_number":  return prop.phone_number;
    case "date":          return prop.date?.start ?? null;
    case "relation":      return prop.relation.map((r) => r.id);
    case "place":         return prop.place ? `${prop.place.address ?? ""} (${prop.place.lat ?? "?"}, ${prop.place.lng ?? "?"})` : null;
    default:              return null;
  }
}

// Render a single Notion page into a clean prose-ish chunk for embedding + retrieval.
function recordToChunkText(record, dbConfig) {
  const lines = [`${dbConfig.kindLabel}:`];
  for (const [k, v] of Object.entries(record)) {
    if (k === "_id") continue;
    if (v == null || v === "") continue;
    const val = Array.isArray(v) ? v.join(", ") : String(v);
    lines.push(`  ${k}: ${val}`);
  }
  return lines.join("\n");
}

function recordTitle(record, dbConfig) {
  // Try the configured title prop; fall back to any string-ish field; fall back to the kind+id.
  if (record[dbConfig.titleProp]) return `${dbConfig.kindLabel}: ${record[dbConfig.titleProp]}`;
  for (const k of Object.keys(record)) {
    if (k === "_id") continue;
    if (typeof record[k] === "string" && record[k].length < 80) return `${dbConfig.kindLabel}: ${record[k]}`;
  }
  return `${dbConfig.kindLabel} ${record._id.slice(0, 8)}`;
}

async function openaiEmbed(texts) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts, dimensions: EMBED_DIM }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`OpenAI embeddings ${resp.status}: ${body.slice(0, 300)}`);
  }
  const data = await resp.json();
  return data.data.map((d) => d.embedding);
}

// Batch helper: embed in chunks of EMBED_BATCH to stay under any per-request limits.
async function embedAll(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    const embeds = await openaiEmbed(batch);
    out.push(...embeds);
  }
  return out;
}

// Upsert the per-tenant Notion knowledge_sources row, return its id.
async function ensureNotionSource(orgId) {
  const { data: existing, error: selErr } = await supabase
    .from("knowledge_sources")
    .select("*")
    .eq("org_id", orgId)
    .eq("kind", "notion")
    .maybeSingle();
  if (selErr) throw new Error(`knowledge_sources lookup: ${selErr.message}`);
  if (existing) return existing;
  const { data: created, error: insErr } = await supabase
    .from("knowledge_sources")
    .insert({
      org_id: orgId,
      kind: "notion",
      display_name: "Notion — Spartan workspace",
      status: "connected",
      config_json: {
        databases: {
          dump_spots: NOTION_DB_DUMP_SPOTS,
          vendors: NOTION_DB_VENDORS,
          subcontractors: NOTION_DB_SUBCONTRACTORS,
          plant_prices: NOTION_DB_PLANT_PRICES,
          pickup_spots: NOTION_DB_PICKUP_SPOTS,
        },
      },
    })
    .select()
    .single();
  if (insErr) throw new Error(`knowledge_sources insert: ${insErr.message}`);
  return created;
}

// ---------- main sync ----------
async function syncDatabase(orgId, sourceId, dbConfig) {
  if (!dbConfig.envId) return { skipped: true, reason: `${dbConfig.key} db id env var missing` };

  // 1. fetch all pages
  const pages = [];
  let cursor = undefined;
  while (true) {
    const resp = await notion.databases.query({
      database_id: dbConfig.envId,
      page_size: 100,
      start_cursor: cursor,
    });
    pages.push(...resp.results);
    if (!resp.has_more) break;
    cursor = resp.next_cursor;
  }

  // 2. flatten + build chunk texts
  const records = pages.map(flattenPage);
  const chunkTexts = records.map((r) => recordToChunkText(r, dbConfig));
  const titles = records.map((r) => recordTitle(r, dbConfig));

  // 3. embed in batches
  const embeddings = await embedAll(chunkTexts);

  // 4. upsert documents + replace chunks
  let docCount = 0;
  let chunkCount = 0;
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const title = titles[i];
    const chunkText = chunkTexts[i];
    const embed = embeddings[i];

    // Upsert document by (source_id, external_id) unique constraint.
    const { data: doc, error: docErr } = await supabase
      .from("knowledge_documents")
      .upsert(
        {
          org_id: orgId,
          source_id: sourceId,
          external_id: rec._id,
          title,
          uri: `https://www.notion.so/${rec._id.replace(/-/g, "")}`,
          mime_type: "application/notion+json",
          indexed_status: "embedding",
          metadata_json: { db: dbConfig.key, raw: rec },
          last_indexed_at: new Date().toISOString(),
          chunk_count: 1,
        },
        { onConflict: "source_id,external_id" }
      )
      .select()
      .single();
    if (docErr) {
      console.error(`doc upsert failed for ${dbConfig.key}/${rec._id}:`, docErr);
      continue;
    }
    docCount += 1;

    // Replace chunks for this document (single chunk per structured-DB record).
    await supabase.from("knowledge_chunks").delete().eq("document_id", doc.id);
    const { error: chunkErr } = await supabase.from("knowledge_chunks").insert({
      org_id: orgId,
      document_id: doc.id,
      position_in_doc: 0,
      chunk_text: chunkText,
      chunk_embedding: embed,
      token_count: Math.ceil(chunkText.length / 4),
      metadata_json: { db: dbConfig.key, notion_id: rec._id, title },
    });
    if (chunkErr) {
      console.error(`chunk insert failed for ${dbConfig.key}/${rec._id}:`, chunkErr);
      continue;
    }
    chunkCount += 1;

    // Promote the doc to indexed.
    await supabase
      .from("knowledge_documents")
      .update({ indexed_status: "indexed" })
      .eq("id", doc.id);
  }

  return { docCount, chunkCount, totalPages: pages.length };
}

// ---------- handler ----------
export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, body: "" };
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });

  if (!notion) return json(500, { error: "NOTION_API_KEY not configured" });
  if (!supabase) return json(500, { error: "Supabase service-role not configured" });
  if (!OPENAI_API_KEY) return json(500, { error: "OPENAI_API_KEY not configured (needed for embeddings)" });
  if (!SPARTAN_ORG_ID) return json(500, { error: "SPARTAN_ORG_ID not configured" });

  const body = (() => { try { return JSON.parse(event.body || "{}"); } catch { return {}; } })();
  const target = body.source_db || "all";
  const dbsToSync = target === "all" ? SOURCE_DBS : SOURCE_DBS.filter((d) => d.key === target);

  if (dbsToSync.length === 0) return json(400, { error: `Unknown source_db '${target}'` });

  let source;
  try { source = await ensureNotionSource(SPARTAN_ORG_ID); }
  catch (e) { return json(500, { error: e.message }); }

  // Flip source to syncing.
  await supabase.from("knowledge_sources")
    .update({ status: "syncing", last_error: null })
    .eq("id", source.id);

  const results = {};
  let totalDocs = 0;
  let totalChunks = 0;
  let lastError = null;

  for (const db of dbsToSync) {
    try {
      const r = await syncDatabase(SPARTAN_ORG_ID, source.id, db);
      results[db.key] = r;
      totalDocs += r.docCount || 0;
      totalChunks += r.chunkCount || 0;
    } catch (e) {
      console.error(`sync ${db.key} failed:`, e);
      results[db.key] = { error: e.message };
      lastError = e.message;
    }
  }

  // Update source row.
  await supabase.from("knowledge_sources")
    .update({
      status: lastError ? "error" : "connected",
      last_error: lastError,
      last_synced_at: new Date().toISOString(),
      document_count: totalDocs,
    })
    .eq("id", source.id);

  return json(200, {
    org_id: SPARTAN_ORG_ID,
    source_id: source.id,
    embed_model: EMBED_MODEL,
    embed_dim: EMBED_DIM,
    total_documents: totalDocs,
    total_chunks: totalChunks,
    last_error: lastError,
    per_db: results,
  });
};
