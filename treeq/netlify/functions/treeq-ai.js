// TreeQ — Conversational AI Assistant (Stage 1)
// Netlify Function. POST /.netlify/functions/treeq-ai
// (Aliased to /api/treeq-ai via netlify.toml redirect.)
//
// Three modes, all enforced via Anthropic tool use:
//   - ask_question     → continue an estimate / collect more info
//   - answer_question  → Q&A grounded in tenant operational data (cites sources)
//   - finalize_estimate→ produce final price, log to `quotes`
//
// Stateless from the server's perspective. Frontend maintains conversation history
// (messages[]) and passes back conversation_id + quote_id once the server has issued them.
//
// Persistence:
//   - One `conversations` row per (org, user, UTC date), created lazily on first turn.
//   - Each turn (user + assistant) inserted into `conversation_turns`.
//   - finalize_estimate inserts into `quotes` and back-references from conversation_turns.referenced_quote_id.

import Anthropic from "@anthropic-ai/sdk";
import { Client as NotionClient } from "@notionhq/client";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { retrieveChunks, chunksToContextMessage } from "./_lib/retrieval.js";

// ----- env -----
const {
  ANTHROPIC_API_KEY,
  OPENAI_API_KEY,
  NOTION_API_KEY,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SPARTAN_ORG_ID,
  NOTION_DB_DUMP_SPOTS,
  NOTION_DB_VENDORS,
  NOTION_DB_SUBCONTRACTORS,
  NOTION_DB_PLANT_PRICES,
  NOTION_DB_PICKUP_SPOTS,
} = process.env;

const MODEL_ID = "claude-sonnet-4-6";
const MAX_TOKENS = 2048;
const MAX_TURNS = 14;

// Anthropic per-million pricing (Sonnet 4.6) for cost tracking.
const COST_INPUT_PER_MTOK = 3.00;
const COST_OUTPUT_PER_MTOK = 15.00;

// ----- clients -----
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;
const notion = NOTION_API_KEY ? new NotionClient({ auth: NOTION_API_KEY }) : null;
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createSupabase(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

// ----- system prompt loaded at cold start -----
const __dirname = dirname(fileURLToPath(import.meta.url));
let SYSTEM_PROMPT_TEMPLATE = "";
try {
  SYSTEM_PROMPT_TEMPLATE = readFileSync(join(__dirname, "_prompts", "system.md"), "utf8");
} catch (e) {
  console.error("FATAL: could not load system prompt:", e);
}

function renderSystemPrompt({ orgName = "Spartan Tree & Landscape", primaryMarket = "Rochester NY" } = {}) {
  return SYSTEM_PROMPT_TEMPLATE
    .replaceAll("{{ORG_NAME}}", orgName)
    .replaceAll("{{PRIMARY_MARKET}}", primaryMarket);
}

// ----- Notion cache (5 min TTL) -----
let notionCache = null;
let notionCacheTime = 0;
const NOTION_TTL_MS = 5 * 60 * 1000;

async function fetchNotionContext() {
  if (!notion) return null;
  if (notionCache && Date.now() - notionCacheTime < NOTION_TTL_MS) {
    return notionCache;
  }
  const dbs = [
    NOTION_DB_DUMP_SPOTS,
    NOTION_DB_VENDORS,
    NOTION_DB_SUBCONTRACTORS,
    NOTION_DB_PLANT_PRICES,
    NOTION_DB_PICKUP_SPOTS,
  ];
  if (dbs.some((id) => !id)) return null;
  const [dumpSpots, vendors, subs, plantPrices, pickupSpots] = await Promise.all(
    dbs.map((id) => notion.databases.query({ database_id: id, page_size: 100 }))
  );
  notionCache = {
    dump_spots: dumpSpots.results.map(flattenPage),
    vendors: vendors.results.map(flattenPage),
    subcontractors: subs.results.map(flattenPage),
    plant_prices: plantPrices.results.map(flattenPage),
    pickup_spots: pickupSpots.results.map(flattenPage),
    fetched_at: new Date().toISOString(),
  };
  notionCacheTime = Date.now();
  return notionCache;
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
    case "place":
      return prop.place
        ? { address: prop.place.address ?? null, lat: prop.place.lat ?? null, lng: prop.place.lng ?? null }
        : null;
    default:              return null;
  }
}

// ---------- Tool definitions ----------
// Three tools, every assistant turn picks exactly one.
const TOOLS = [
  {
    name: "ask_question",
    description:
      "Ask the employee exactly one question to make progress on a pricing job. The frontend will render the input widget you specify. Prefer buttons/checkboxes over free text. Keep messages short.",
    input_schema: {
      type: "object",
      required: ["message", "input"],
      properties: {
        message: { type: "string", description: "Short, conversational question. Under 120 chars when possible." },
        rationale: { type: "string", description: "Internal: why you're asking. Server-side log only." },
        input: {
          type: "object",
          required: ["kind"],
          properties: {
            kind: { type: "string", enum: ["buttons", "checkboxes", "photo_request", "text", "species_picker", "number"] },
            options: {
              type: "array",
              description: "For buttons / checkboxes.",
              items: {
                type: "object",
                required: ["label", "value"],
                properties: {
                  label: { type: "string" },
                  value: { type: "string" },
                  emoji: { type: "string" },
                },
              },
            },
            placeholder: { type: "string" },
            photo_role: { type: "string" },
            allow_skip: { type: "boolean", default: true },
            min: { type: "number" },
            max: { type: "number" },
            unit: { type: "string" },
          },
        },
      },
    },
  },
  {
    name: "answer_question",
    description:
      "Answer a non-pricing operational question about the tenant's data (vendors, dump sites, subs, plant prices, SOPs). ALWAYS cite sources by referencing the operational context records you used (use their _id as ref_id).",
    input_schema: {
      type: "object",
      required: ["answer", "sources", "confidence"],
      properties: {
        answer: {
          type: "string",
          description: "Concise, conversational, plain English. Under ~400 chars when the answer fits.",
        },
        sources: {
          type: "array",
          description: "Records from the operational context that ground this answer. Empty array if no concrete source.",
          items: {
            type: "object",
            required: ["title", "kind", "ref_id"],
            properties: {
              title: { type: "string", description: "Human label, e.g. 'Vendor: All County Tractor & Trailer Center'" },
              snippet: { type: "string", description: "Verbatim excerpt or key facts that ground the answer." },
              kind: {
                type: "string",
                enum: ["vendor", "dump_spot", "subcontractor", "plant_price", "pickup_spot", "material_price", "methodology", "uploaded_doc"],
              },
              ref_id: { type: "string", description: "Notion page _id or doc chunk id. Use 'methodology' if from the embedded Spartan pricing prompt." },
            },
          },
        },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        followups: {
          type: "array",
          description: "Up to 3 short suggested next questions.",
          items: { type: "string" },
        },
      },
    },
  },
  {
    name: "finalize_estimate",
    description: "Produce the final estimate. Use when you have enough info to confidently price the job (or when escalating).",
    input_schema: {
      type: "object",
      required: ["price", "price_low", "price_high", "line_items", "reasoning", "confidence", "escalate"],
      properties: {
        price: { type: ["number", "null"], description: "Best estimate (USD)." },
        price_low: { type: ["number", "null"] },
        price_high: { type: ["number", "null"] },
        line_items: {
          type: "array",
          items: {
            type: "object",
            required: ["label", "subtotal"],
            properties: {
              label: { type: "string" },
              quantity: { type: "number" },
              unit: { type: "string" },
              unit_price: { type: "number" },
              subtotal: { type: "number" },
              notes: { type: "string" },
            },
          },
        },
        reasoning: { type: "string", description: "2-4 sentences. Salesperson-only, never customer." },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        escalate: { type: "boolean" },
        escalate_reason: { type: ["string", "null"] },
        salesperson_followups: { type: "array", items: { type: "string" } },
      },
    },
  },
];

// ---------- helpers ----------
function json(status, body) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function previewText(blocks) {
  if (!Array.isArray(blocks)) return null;
  const txt = blocks
    .map((b) => {
      if (b?.type === "text") return b.text;
      if (b?.type === "tool_use") return `[tool:${b.name}] ${JSON.stringify(b.input).slice(0, 200)}`;
      if (b?.type === "tool_result") return `[tool_result] ${typeof b.content === "string" ? b.content : JSON.stringify(b.content).slice(0, 200)}`;
      if (b?.type === "image") return "[image]";
      return null;
    })
    .filter(Boolean)
    .join(" | ");
  return txt.slice(0, 500);
}

function estimateCostUsd(usage) {
  if (!usage) return null;
  const inTok = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
  const outTok = usage.output_tokens || 0;
  return Number(((inTok / 1_000_000) * COST_INPUT_PER_MTOK + (outTok / 1_000_000) * COST_OUTPUT_PER_MTOK).toFixed(4));
}

function todayUTCDate() {
  return new Date().toISOString().slice(0, 10);
}

// Lazily create-or-fetch a conversation row for (org, user, today).
async function getOrCreateConversation(orgId, userId, conversationId) {
  if (!supabase) return null;
  if (conversationId) {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .maybeSingle();
    if (!error && data) return data;
  }
  const thread_date = todayUTCDate();
  // Try upsert keyed on the unique (org_id, user_id, thread_date).
  const { data: existing } = await supabase
    .from("conversations")
    .select("*")
    .eq("org_id", orgId)
    .eq("thread_date", thread_date)
    .is("user_id", userId ?? null)
    .maybeSingle();
  if (existing) return existing;
  const { data: created, error: insertErr } = await supabase
    .from("conversations")
    .insert({ org_id: orgId, user_id: userId ?? null, thread_date })
    .select()
    .single();
  if (insertErr) {
    console.error("conversations insert failed:", insertErr);
    return null;
  }
  return created;
}

async function logTurn(orgId, conversationId, turnIndex, role, contentBlocks, extras = {}) {
  if (!supabase || !conversationId) return;
  const payload = {
    org_id: orgId,
    conversation_id: conversationId,
    turn_index: turnIndex,
    role,
    content_json: contentBlocks,
    text_preview: previewText(contentBlocks),
    ...extras,
  };
  const { error } = await supabase.from("conversation_turns").insert(payload);
  if (error) console.error("conversation_turns insert failed:", error);
}

async function bumpConversation(conversationId, addCount) {
  if (!supabase || !conversationId) return;
  // Two-step read/write: easier than RPC for now.
  const { data: row } = await supabase
    .from("conversations")
    .select("message_count")
    .eq("id", conversationId)
    .maybeSingle();
  const next = (row?.message_count || 0) + addCount;
  await supabase
    .from("conversations")
    .update({ message_count: next, last_message_at: new Date().toISOString() })
    .eq("id", conversationId);
}

async function persistQuote({
  orgId,
  userId,
  quoteId,
  finalize,
  body,
  modelId,
  usage,
}) {
  if (!supabase) return { id: quoteId, persisted: false };
  const apiCost = estimateCostUsd(usage);
  const totalTokens = (usage?.input_tokens || 0) + (usage?.output_tokens || 0);

  const row = {
    org_id: orgId,
    user_id: userId ?? null,
    status: finalize.escalate ? "escalated" : "draft",
    engine: "llm_sonnet",
    customer_name: body.customer_name ?? null,
    customer_phone: body.customer_phone ?? null,
    job_address: body.job_address ?? null,
    description: body.user_turn ?? null,
    photos_json: body.photos_summary ?? null,
    structured_inputs_json: body.structured_inputs ?? null,
    model_id: modelId,
    estimated_price: finalize.price,
    estimated_price_low: finalize.price_low,
    estimated_price_high: finalize.price_high,
    line_items_json: finalize.line_items ?? [],
    reasoning: finalize.reasoning ?? null,
    escalated: !!finalize.escalate,
    escalate_reason: finalize.escalate_reason ?? null,
    prompt_tokens: usage?.input_tokens ?? null,
    completion_tokens: usage?.output_tokens ?? null,
    api_cost_usd: apiCost,
  };

  if (quoteId) {
    const { data, error } = await supabase
      .from("quotes")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", quoteId)
      .select()
      .single();
    if (error) {
      console.error("quotes update failed:", error);
      return { id: quoteId, persisted: false };
    }
    return { id: data.id, persisted: true };
  }
  const { data, error } = await supabase.from("quotes").insert(row).select().single();
  if (error) {
    console.error("quotes insert failed:", error);
    return { id: null, persisted: false };
  }
  return { id: data.id, persisted: true };
}

// Build the first-turn operational-context user message.
function buildContextMessage(context) {
  if (!context) {
    return {
      role: "user",
      content: [
        {
          type: "text",
          text:
            "## Operational context\n\n" +
            "_(Notion fetch unavailable — operating without live operational data. Tell the user if asked for specifics.)_\n",
        },
      ],
    };
  }
  const txt =
    `## Operational context (live from Notion, fetched ${context.fetched_at})\n\n` +
    "Use the records below as the ONLY source for answers about vendors, dump spots, subs, plant prices, and pickup spots. " +
    "When citing in answer_question, use each record's `_id` as the source ref_id.\n\n" +
    "```json\n" +
    JSON.stringify(
      {
        dump_spots: context.dump_spots,
        vendors: context.vendors,
        subcontractors: context.subcontractors,
        plant_prices: context.plant_prices,
        pickup_spots: context.pickup_spots,
      },
      null,
      2
    ) +
    "\n```\n";
  return { role: "user", content: [{ type: "text", text: txt }] };
}

// Build the user turn content (text + optional inline images).
function buildUserTurn(userTurn, newPhotos = []) {
  const content = [];
  for (const p of newPhotos) {
    if (!p?.data || !p?.mediaType) continue;
    content.push({
      type: "image",
      source: { type: "base64", media_type: p.mediaType, data: p.data },
    });
  }
  if (userTurn && typeof userTurn === "string" && userTurn.trim()) {
    content.push({ type: "text", text: userTurn.trim() });
  }
  if (content.length === 0) {
    content.push({ type: "text", text: "[opens chat]" });
  }
  return { role: "user", content };
}

// ---------- handler ----------
export const handler = async (event) => {
  // CORS preflight (in case the dashboard ever sits on a different origin during dev).
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
  if (!anthropic) return json(500, { error: "ANTHROPIC_API_KEY not configured." });

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "Invalid JSON body" }); }

  const {
    messages = [],
    user_turn = null,
    new_photos = [],
    quote_id = null,
    conversation_id: requestedConvId = null,
    user_id = null,
    customer_name = null,
    customer_phone = null,
    job_address = null,
  } = body;

  if (messages.length >= MAX_TURNS * 2) {
    return json(400, { error: "Conversation too long — restart." });
  }

  const orgId = SPARTAN_ORG_ID || null;

  // ---- Build the working conversation ----
  const working = [...messages];

  // First-turn bootstrap: inject operational context once.
  //   1) Preferred: vector retrieval (top-K chunks indexed by sync-notion).
  //   2) Fallback: live Notion fetch (Stage 0 behavior — works on a fresh tenant
  //      whose chunks aren't indexed yet).
  let bootstrappedContext = false;
  let retrievalMeta = null;
  if (working.length === 0) {
    let contextMsg = null;
    if (orgId && supabase && OPENAI_API_KEY && user_turn) {
      try {
        const r = await retrieveChunks({
          supabase,
          openaiApiKey: OPENAI_API_KEY,
          orgId,
          queryText: user_turn,
          k: 8,
        });
        retrievalMeta = { used: r.used_retrieval, count: r.chunks.length, reason: r.reason || null };
        if (r.used_retrieval && r.chunks.length > 0) {
          contextMsg = chunksToContextMessage(r.chunks);
        }
      } catch (e) {
        console.error("retrieveChunks failed:", e);
      }
    }
    if (!contextMsg) {
      let context = null;
      try { context = await fetchNotionContext(); }
      catch (e) { console.error("Notion fetch failed:", e); }
      contextMsg = buildContextMessage(context);
    }
    working.push(contextMsg);
    bootstrappedContext = true;
  }

  // Append the user's latest turn.
  working.push(buildUserTurn(user_turn, new_photos));

  // Ensure a conversations row exists (best effort).
  let convRow = null;
  if (orgId) {
    try { convRow = await getOrCreateConversation(orgId, user_id, requestedConvId); }
    catch (e) { console.error("getOrCreateConversation failed:", e); }
  }
  const conversationId = convRow?.id ?? null;
  let turnIndex = convRow?.message_count ?? 0;

  // ---- Call Anthropic ----
  const started = Date.now();
  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: MAX_TOKENS,
      system: renderSystemPrompt(),
      tools: TOOLS,
      tool_choice: { type: "any" },        // FORCE a tool call every turn
      messages: working,
    });
  } catch (e) {
    console.error("Anthropic call failed:", e?.message || e);
    return json(502, { error: "AI provider error", detail: e?.message || String(e) });
  }
  const latencyMs = Date.now() - started;

  // Append the assistant's response to working history for the frontend to send back next time.
  working.push({ role: "assistant", content: response.content });

  // Extract the tool call (server forces tool use).
  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock) {
    console.error("No tool_use block in response. Stop reason:", response.stop_reason);
    return json(502, { error: "AI did not return a tool call.", stop_reason: response.stop_reason });
  }

  // ---- Persist the user + assistant turns to conversation_turns ----
  // We log the user turn (which we just appended) and the assistant turn together.
  try {
    if (conversationId) {
      // Log the just-appended user turn (the one before assistant)
      const userTurnContent = working[working.length - 2]?.content;
      await logTurn(orgId, conversationId, turnIndex, "user", userTurnContent);
      turnIndex += 1;
      const extras = {
        tool_name: toolBlock.name,
        tokens_in: response.usage?.input_tokens ?? null,
        tokens_out: response.usage?.output_tokens ?? null,
        latency_ms: latencyMs,
      };
      if (toolBlock.name === "answer_question") {
        extras.citations_json = toolBlock.input?.sources ?? [];
      }
      await logTurn(orgId, conversationId, turnIndex, "assistant", response.content, extras);
      turnIndex += 1;
      await bumpConversation(conversationId, 2);
    }
  } catch (e) {
    console.error("Turn logging failed:", e);
  }

  // ---- Branch on tool name ----
  const baseResp = {
    conversation_id: conversationId,
    bootstrapped_context: bootstrappedContext,
    retrieval: retrievalMeta,
    messages: working,                  // full updated history for the client to echo back
    usage: {
      input_tokens: response.usage?.input_tokens,
      output_tokens: response.usage?.output_tokens,
      cost_usd: estimateCostUsd(response.usage),
      latency_ms: latencyMs,
    },
  };

  if (toolBlock.name === "ask_question") {
    return json(200, {
      ...baseResp,
      kind: "ask_question",
      question: toolBlock.input,
      tool_use_id: toolBlock.id,
    });
  }

  if (toolBlock.name === "answer_question") {
    return json(200, {
      ...baseResp,
      kind: "answer_question",
      answer: toolBlock.input,
      tool_use_id: toolBlock.id,
    });
  }

  if (toolBlock.name === "finalize_estimate") {
    let persisted = { id: quote_id, persisted: false };
    if (orgId) {
      try {
        persisted = await persistQuote({
          orgId,
          userId: user_id,
          quoteId: quote_id,
          finalize: toolBlock.input,
          body,
          modelId: MODEL_ID,
          usage: response.usage,
        });
        // Back-link the assistant turn to the quote.
        if (conversationId && persisted.id && supabase) {
          await supabase
            .from("conversation_turns")
            .update({ referenced_quote_id: persisted.id })
            .eq("conversation_id", conversationId)
            .eq("turn_index", turnIndex - 1);   // we just inserted the assistant turn
        }
      } catch (e) {
        console.error("persistQuote failed:", e);
      }
    }
    return json(200, {
      ...baseResp,
      kind: "finalize_estimate",
      estimate: toolBlock.input,
      quote_id: persisted.id,
      quote_persisted: persisted.persisted,
      tool_use_id: toolBlock.id,
    });
  }

  return json(502, { error: `Unknown tool '${toolBlock.name}'.` });
};
