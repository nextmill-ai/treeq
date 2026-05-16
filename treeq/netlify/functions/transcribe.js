// TreeQ — voice transcription via OpenAI Whisper.
// POST /.netlify/functions/transcribe
//   body: { audio_b64: string, media_type: 'audio/webm'|'audio/mp4'|'audio/wav'|..., language?: 'en' }
//   returns: { text, latency_ms, cost_usd, model, duration_sec }
//
// All transcriptions log to the `transcriptions` table (migration 0003) so we
// can review accuracy on chainsaw-adjacent audio later.
//
// Pricing: gpt-4o-mini-transcribe is $0.003 per minute (per OpenAI Sep 2025 pricing).
// We fall back to whisper-1 ($0.006/min) if mini fails.

import { createClient as createSupabase } from "@supabase/supabase-js";

const {
  OPENAI_API_KEY,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SPARTAN_ORG_ID,
} = process.env;

const PRIMARY_MODEL = "gpt-4o-mini-transcribe";
const FALLBACK_MODEL = "whisper-1";

// $/minute per OpenAI public pricing (2025).
const MODEL_COST_PER_MIN = {
  "gpt-4o-mini-transcribe": 0.003,
  "whisper-1":              0.006,
};

const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createSupabase(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

function json(status, body) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

function fileExtForMime(mt) {
  if (!mt) return "webm";
  if (mt.includes("webm")) return "webm";
  if (mt.includes("mp4") || mt.includes("m4a")) return "m4a";
  if (mt.includes("wav")) return "wav";
  if (mt.includes("ogg")) return "ogg";
  if (mt.includes("mpeg") || mt.includes("mp3")) return "mp3";
  return "webm";
}

// Probe duration from a WebM/MP4 buffer — best-effort. Falls back to estimate from byte size.
function estimateDurationSec(bytes, mediaType) {
  // Rough: voice-quality compressed audio averages ~12-24 kbps. Use 16 kbps as mid.
  const kbps = 16;
  const sec = (bytes * 8) / (kbps * 1000);
  return Math.max(0.5, Math.round(sec * 10) / 10);
}

async function callOpenAI(model, audioBytes, mediaType, language) {
  const form = new FormData();
  const ext = fileExtForMime(mediaType);
  const blob = new Blob([audioBytes], { type: mediaType || "audio/webm" });
  form.append("file", blob, `audio.${ext}`);
  form.append("model", model);
  if (language) form.append("language", language);
  form.append("response_format", "json");
  form.append("temperature", "0");

  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`OpenAI ${model} ${resp.status}: ${body.slice(0, 300)}`);
  }
  const data = await resp.json();
  return data.text || "";
}

export const handler = async (event) => {
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
  if (!OPENAI_API_KEY) return json(500, { error: "OPENAI_API_KEY not configured" });

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "Invalid JSON" }); }

  const { audio_b64, media_type = "audio/webm", language = "en", user_id = null } = body;
  if (!audio_b64) return json(400, { error: "audio_b64 required" });

  let audioBytes;
  try { audioBytes = Buffer.from(audio_b64, "base64"); }
  catch { return json(400, { error: "audio_b64 not valid base64" }); }
  if (audioBytes.length < 200) return json(400, { error: "audio too short" });
  if (audioBytes.length > 25 * 1024 * 1024) return json(413, { error: "audio exceeds 25MB (Whisper limit)" });

  const durationSec = estimateDurationSec(audioBytes.length, media_type);
  const started = Date.now();

  let text = "";
  let modelUsed = PRIMARY_MODEL;
  let lastErr = null;
  for (const model of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    try {
      text = await callOpenAI(model, audioBytes, media_type, language);
      modelUsed = model;
      lastErr = null;
      break;
    } catch (e) {
      console.warn(`transcribe ${model} failed:`, e.message);
      lastErr = e;
    }
  }
  if (lastErr) return json(502, { error: "Transcription failed", detail: lastErr.message });

  const latencyMs = Date.now() - started;
  const costPerMin = MODEL_COST_PER_MIN[modelUsed] || MODEL_COST_PER_MIN[FALLBACK_MODEL];
  const costUsd = Number(((durationSec / 60) * costPerMin).toFixed(5));

  // Log (best effort).
  if (supabase) {
    try {
      await supabase.from("transcriptions").insert({
        org_id: SPARTAN_ORG_ID || null,
        user_id: user_id,
        model: modelUsed,
        media_type,
        duration_sec: durationSec,
        size_bytes: audioBytes.length,
        text,
        latency_ms: latencyMs,
        cost_usd: costUsd,
      });
    } catch (e) {
      console.error("transcriptions log failed:", e);
    }
  }

  return json(200, {
    text,
    model: modelUsed,
    latency_ms: latencyMs,
    cost_usd: costUsd,
    duration_sec: durationSec,
  });
};
