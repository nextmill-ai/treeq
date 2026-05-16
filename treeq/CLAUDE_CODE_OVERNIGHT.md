# TreeQ — Claude Code Overnight Brief

**Paste this entire file into a new Claude Code session inside the TreeQ project folder.** This is a self-contained brief: it points you at the research, lays out the architectural decisions Cameron has already made, and gives you a sequenced queue of work with acceptance criteria. You should be able to chip away at this for hours without further input.

---

## 0. Working agreement

- **Project root (CANONICAL, do not write elsewhere):** `C:\Users\camer\Projects\Claude Cowork\TreeQ\`. This replaced both the Google Drive copy (deprecated 2026-05-10) and the OneDrive copy at `C:\Users\camer\OneDrive\Documents\Claude\Projects\TreeQ\` (deprecated 2026-05-12 due to write-truncation). The OneDrive copy still exists as read-only legacy — never write there. If your working directory is OneDrive when you start, STOP and switch to the canonical path before any write.
- **Read `CLAUDE.md` at the project root before any write.** It defines mandatory file-writing rules (shell writes via Python or heredoc for anything >5 lines, never use Edit/Write for big files in this folder). Truncation is still happening intermittently in canonical — verification is non-negotiable.
- **Verify every non-trivial write.** After any write >20 lines run `./verify_edit.sh PATH EXPECTED_LINES` (helper at project root) OR manually run `wc -l` + `tail -n 5` and compare against the source/expected. Treat unexpected line-count loss as truncation and stop.
- **Live at treeqapp.com on Netlify.** Production deploy is currently the single-file `index.html` at the project root (the cut-count estimator, v1.9). Don't break it.
- **Cameron is asleep when you start. Make decisions inline rather than asking. Document them in `HANDOFF.md` as you go.**
- **Workbook source of truth:** `Spartan_Pricing_Reference.xlsx` was cleaned 2026-05-12 (8" limb-as-tree threshold, no bucket-truck bundled minimum, multiplier order = base → hazard × work portion + non-work → percent multipliers chained → dollar subtractions → Priority Scheduling 25% LAST). The production system prompt at `netlify/functions/_prompts/system.md` already reflects this. Do not regress those rules.

## 1. Read these first

Get the full context before writing anything:

1. **`CONTEXT.md`** — the existing TreeQ math model, v1.8/v1.9 state, deploy/ folder explanation
2. **`HANDOFF.md`** — Cameron's overnight ticket queue (Playwright tests etc.). Don't disrupt these unless explicitly overridden by this brief.
3. **`ROADMAP.md`** — long-term TreeQ vision
4. **`QUICK_ESTIMATE_SETUP.md`** — what Cowork built last session for the interim Sonnet 4.6 estimator
5. **`research/spartan_pricing_extract.md`** — Spartan's real labor rates + service-line pricing + hazard modifiers. The methodology that drives the AI estimator. **Treat this as the source of truth.**
6. **`research/fms_competitors.md`** — Jobber, SingleOps, ArborGold, ServiceTitan, Housecall Pro deep dive. The "AI estimator wedge is empty" finding, the "side-car not replacement" positioning, the QBO-as-substrate import strategy.
7. **`research/capacitor_app_store.md`** — App Store path. Especially: Guideline 4.2 "minimum functionality" requires 3+ native integrations; B2B SaaS exemption from IAP; D-U-N-S Number is the blocker on Org enrollment; PowerSync as the offline stack.
8. **`research/ai_conversation_ux.md`** — UX patterns: one giant mic button, push-to-hold voice, inline source citations, web-only knowledge admin with test panel.
9. **`supabase/migrations/0001_stage1.sql`** — current tenant + operational + quotes schema. Extend, don't rewrite.
10. **`netlify/functions/quick-estimate.js`** + **`netlify/functions/_prompts/system.md`** — the working conversational estimator (tool-use enforced, Sonnet 4.6). System prompt now contains the REAL Spartan pricing methodology.
11. **`quick-estimate.html`** — the chat-style UI Cowork already built.

**Read everything in `research/` carefully — the same research won't be redone if you skip these.**

## 2. Architectural decisions already made

Don't relitigate these. Document the reasoning in `HANDOFF.md` if you find a strong reason to deviate, but default to following them:

| Decision | Why |
|---|---|
| **Stack:** static HTML + Netlify Functions + Supabase + Anthropic SDK for Stage 1. Migrate to Next.js 15 App Router when math engine ships. | Existing TreeQ is on Netlify; migrating now is churn. Next.js is the destination for multi-tenant auth + Capacitor wrap + streaming AI. |
| **Conversational LLM via Anthropic tool use** (`ask_question` / `answer_question` / `finalize_estimate`). Never free text. | Robust structured output. No JSON parsing of free responses. |
| **Methodology stays server-side** — system prompt + Edge Functions are trade secrets. Client never sees formulas. | TreeQ IP. |
| **Multi-tenant from day one.** RLS via `org_id` on every operational table. Spartan = first tenant. | TreeQ is SaaS; any tree company can sign up. |
| **Conversational FIRST, FMS second.** Position as "AI brain on top of however you run today," not "replace your Jobber." Build FMS-shaped data model in back end, surface only the AI Q&A + pricing in front end for v0.1. | FMS research confirms incumbents are entrenched on scheduling/dispatch; salespeople are the underserved persona. |
| **Capacitor wrap for iOS/Android App Store.** Minimum 3 native integrations (camera, geolocation, push) to clear Guideline 4.2. | Per App Store research. |
| **Push-to-hold voice default**, hands-free mode opt-in. Native Capacitor speech-recognition plugin, NOT Web Speech API. | Web Speech API doesn't work in iOS WKWebView. Whisper crushes it in chainsaw-adjacent audio anyway. |
| **No IAP. Stripe via web checkout.** TreeQ is B2B SaaS — exempt. | Apple's "services consumed outside the app" exception. |
| **Skip Sign in with Apple unless adding Google login.** B2B/enterprise carveout per 4.8. | Existing org accounts qualify. |
| **PowerSync + Supabase for offline support.** Native SQLite, durable, multi-tenant via sync rules. | Field tool needs offline; IndexedDB is fragile on iOS. (Defer to v0.2.) |
| **Knowledge admin is web-only.** Owners don't upload knowledge from phones. | Per UX research. |
| **All employee Q&A is grounded in tenant-uploaded sources. Inline source citations are non-negotiable.** | Single biggest trust-building feature per Arc Search / Perplexity learnings. |

## 3. The product shape (v0.1)

The salesperson opens the TreeQ app and sees ONE screen:

```
┌─────────────────────┐
│  TreeQ              │
│  Spartan Tree       │
│                     │
│  [recent question]  │   ← 3 chips: 2 derived from
│  [recent question]  │     this user's last 7 days,
│  [smart suggestion] │     1 generated from time/season
│                     │
│   ┌───────────────┐ │
│   │ Ask anything… │ │   ← text input
│   └───────────────┘ │
│                     │
│      ┌─────┐        │
│      │ 🎤  │        │   ← 96px mic button, thumb zone,
│      └─────┘        │     push-to-hold to record
│                     │
│  📷 Photo   📚 Knowledge │  ← tiny corner icons
└─────────────────────┘
```

When they tap or hold the mic, OR type into the input, OR pick a chip, they enter the AI conversation. The AI can:
- Answer any operational question about the tenant's data (vendors, dump sites, subs, pricing, SOPs)
- Price a job from photos + chat (the existing `quick-estimate` flow, just entered through this dashboard)

Owner-side admin (`/admin` on web only):
- Connected sources (Notion, Google Drive, QuickBooks Online, Jobber CSV import)
- Uploaded files list with indexing status
- Test panel — owner types a query, sees what the salesperson will see

## 4. Task queue (work in this order; stop and document blockers)

Each task has an explicit **definition of done**. After each completed task, append a one-paragraph entry to `HANDOFF.md` under a `## Overnight Run [YYYY-MM-DD]` heading.

### TASK A — Unified dashboard home page (`dashboard.html`)

Replace `quick-estimate.html` as the primary entry point. The dashboard:

1. Renders the home screen from §3 above
2. Persists the conversation by day (one thread per day, keyed by tenant + user + UTC date)
3. Calls `/.netlify/functions/treeq-ai` (rename `quick-estimate` to `treeq-ai` since it now does Q&A + pricing — see Task B)
4. Handles three input modalities: tap a chip → submit chip text as user_turn; type + send → submit text; tap-and-hold mic → record native audio → POST to a new `/.netlify/functions/transcribe` → submit transcript
5. Renders three response types: `ask_question` (the existing widget), `answer_question` (new: prose + source citations), `finalize_estimate` (the price card)
6. Camera button opens the photo-first job-pricing flow (pre-fills "Price this job")
7. Knowledge button on mobile is a read-only listing of indexed sources

**Definition of done:**
- `dashboard.html` is at the project root and renders the v0.1 shape from §3
- Calling `treeq-ai` with `{ messages: [], user_turn: "What's our chipper repair vendor?" }` returns an `answer_question` tool call with sources from the operational context
- Calling it with `{ user_turn: "Price a job", new_photos: [...] }` enters the pricing flow exactly as `quick-estimate.html` does today
- Three suggestion chips render and are tappable
- Daily-thread persistence works (localStorage v0.1; will migrate to Supabase later)
- Existing `quick-estimate.html` is kept but unlinked (don't delete — Cameron may want to A/B compare)

### TASK B — Add `answer_question` tool + Q&A mode to the Edge Function

Extend `netlify/functions/quick-estimate.js`:

1. Rename file/route to `treeq-ai` (update `netlify.toml`)
2. Add the `answer_question` tool definition (see schema below)
3. The system prompt already supports Q&A mode (see latest `_prompts/system.md`). When the user's question isn't pricing-related, the model should call `answer_question` not `ask_question`
4. The function logs all Q&A turns to a new `conversations` table (different from `quotes` — see Task C). Don't conflate.
5. Source citations must include the database row's `_id` from Notion so the frontend can deep-link

`answer_question` schema:
```json
{
  "answer": "string — concise, conversational, plain English",
  "sources": [
    {
      "title": "string — e.g. 'Vendors: All County Tractor & Trailer Center'",
      "snippet": "string — verbatim excerpt that grounds the answer",
      "kind": "vendor | dump_spot | subcontractor | plant_price | pickup_spot | uploaded_doc",
      "ref_id": "string — the Notion page ID or doc chunk ID"
    }
  ],
  "confidence": 0.0,
  "followups": ["short list of suggested next questions"]
}
```

**Definition of done:**
- POST `/.netlify/functions/treeq-ai` with `{ user_turn: "What's our 30-inch stump grinding rate?" }` returns an `answer_question` with the correct rate ($298 for primary, $150 for add-on) cited to the pricing methodology
- POST with `{ user_turn: "Who do we use for trailer repair?" }` returns three vendors from the Notion Vendors data with category=Trailers
- POST with `{ user_turn: "Price this job", new_photos: [...] }` flows into the existing pricing tool exactly as before
- All turns log to `conversations`, all pricing finalizations log to `quotes`

### TASK C — Extend Supabase schema for v0.1 + FMS-ready backbone

Write a new migration `supabase/migrations/0002_conversations_and_fms_backbone.sql`. This adds:

**For v0.1 (user-facing):**
- `conversations` — daily threads. Columns: id, org_id, user_id, thread_date, message_count, last_message_at, created_at, updated_at
- `conversation_turns` — individual user/assistant messages. Columns: id, conversation_id, role (user|assistant), content_json (raw), text_preview, tool_name (ask_question|answer_question|finalize_estimate|null), referenced_quote_id (nullable, FK to quotes), tokens_in, tokens_out, created_at
- `knowledge_sources` — connected sources per tenant. Columns: id, org_id, kind (notion|google_drive|quickbooks|jobber_csv|file_upload), config_json (per-kind config), status (connected|disconnected|error), last_synced_at, last_error
- `knowledge_documents` — individual files/pages. Columns: id, org_id, source_id (FK), external_id (Notion page ID, GDrive file ID, etc.), title, mime_type, size_bytes, indexed_status (pending|parsing|embedding|indexed|failed), indexed_status_detail, last_indexed_at
- `knowledge_chunks` — RAG chunks. Columns: id, org_id, document_id (FK), chunk_text, chunk_embedding (pgvector — enable extension), token_count, position_in_doc, metadata_json

**For FMS backbone (back-end only for now, no front-end yet):**
- `customers` — id, org_id, name, primary_phone, primary_email, addresses_json (array), source (manual|jobber|qbo|tenant_app), external_ids_json (Jobber id, QBO id), tags[], notes, created_at, updated_at
- `properties` — id, org_id, customer_id, address, lat, lng, access_notes, gate_code, dog_warning (bool), trees_json (denormalized tree inventory)
- `jobs` — id, org_id, customer_id, property_id, status (lead|estimated|approved|scheduled|in_progress|completed|cancelled), service_lines text[], scheduled_for date, completed_at, total_quoted, total_invoiced, total_paid, external_ids_json (Jobber job id, etc.), notes
- `job_tree_items` — id, org_id, job_id, species_key, dbh, height_ft, crown_radius_ft, lean, structure_proximity, action (remove|prune|cable|treat), photos_json, estimated_subtotal, actual_subtotal
- `job_events` — id, org_id, job_id, event_type (note|photo|status_change|crew_check_in|customer_message), payload_json, created_by_user_id, created_at
- `crews` — id, org_id, name, lead_user_id, member_user_ids[]
- `schedule_slots` — id, org_id, job_id, crew_id, scheduled_start, scheduled_end, status (planned|completed|missed)
- `external_integrations` — id, org_id, kind (jobber|qbo|stripe|twilio|fcm), oauth_token_encrypted, refresh_token_encrypted, scopes[], status, last_synced_at

Add RLS policies for ALL new tables matching the existing pattern.

Add the `pgvector` extension and a HNSW or IVFFlat index on `knowledge_chunks.chunk_embedding`.

**Definition of done:**
- Migration applies cleanly to a fresh Supabase project (test locally via `supabase db reset` if you have the CLI, or document the steps in `HANDOFF.md` for Cameron to apply manually)
- Every new table has RLS enabled and a sane `org_id = current_org_id()` policy
- pgvector extension enabled and an embedding index created
- Document in `HANDOFF.md` which FMS tables are unused-by-frontend-but-ready and what's needed to surface each one later

### TASK D — Knowledge ingestion: Notion connector (Stage 1)

Owner connects their Notion workspace. TreeQ ingests their TreeQ Source Data databases and uploaded docs. **Read `research/ai_conversation_ux.md` § 4 for the admin UX pattern.**

For v0.1, hardcode the Spartan tenant's Notion integration. Build the infrastructure that can scale to many tenants later.

1. New Edge Function `netlify/functions/sync-notion.js` — triggered manually or on schedule. Reads the 5 source databases (Dump Spots, Vendors, Subcontractors, Plant Prices, Pickup Spots) using the existing Notion API key.
2. Upserts each Notion page as a `knowledge_documents` row with `source_id` pointing to a "notion" knowledge_source.
3. Chunks the page (one chunk per record for these structured DBs; full-text chunking for general Notion pages).
4. Embeds chunks via Anthropic's embeddings (or OpenAI `text-embedding-3-small` — pick one and document why).
5. Stores in `knowledge_chunks`.

Then update `treeq-ai`:
- Instead of stuffing all Notion data into every prompt (current behavior — works for Spartan's small dataset but won't scale), do vector retrieval from `knowledge_chunks` filtered by `org_id`
- Top-K retrieval (start with K=8) → include in the prompt's operational context
- For pricing flows, ALWAYS include the full Spartan methodology block from system.md (don't try to retrieve methodology — it's prompt-embedded)

**Definition of done:**
- Manual trigger of `sync-notion` populates `knowledge_documents` + `knowledge_chunks` for Spartan
- `treeq-ai` retrieves contextually relevant chunks instead of stuffing everything
- Owner-side admin page (Task F) shows the sync status

### TASK E — Native bridges for App Store readiness (back-end only)

You will not ship to the App Store in this overnight run. But you can lay the groundwork:

1. Initialize Capacitor in the project: `npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`
2. Add `capacitor.config.ts` pointing `webDir` at `.` (the project root). Set `appId: "com.treeq.app"` and `appName: "TreeQ"`.
3. Install the three required-for-4.2 plugins: `@capacitor/camera`, `@capacitor/geolocation`, `@capacitor/push-notifications`
4. Install `@capacitor-community/speech-recognition`
5. Wire each plugin's basic API call into a small `/diagnostics.html` page so it's easy to verify each one works once Cameron runs `npx cap add ios` / `npx cap add android`
6. Add `@capacitor/splash-screen` config (forest green background, TreeQ logo)
7. Write `BUILD_NATIVE.md` documenting the steps Cameron needs to run on his Mac (Xcode build) and Windows (Android Studio build)

**Definition of done:**
- `package.json` updated with Capacitor + plugins
- `capacitor.config.ts` exists and is sensible
- `diagnostics.html` exists at root with buttons for "Test Camera", "Test Location", "Test Push", "Test Mic" — each calls the corresponding plugin and shows the result
- `BUILD_NATIVE.md` walks Cameron through `npx cap add ios`, opening Xcode, configuring Signing & Capabilities, and submitting to TestFlight
- DO NOT actually run `npx cap add ios` or generate native projects yet — Cameron will do that on his Mac

### TASK F — Owner admin page (`admin.html`)

Web-only. Per `research/ai_conversation_ux.md` § 4.

Sections:
1. **Connected Sources** — list `knowledge_sources` rows with status icons. "Connect another source" button (only Notion + file upload functional for v0.1; QBO and Jobber CSV are placeholders with "Coming soon" CTAs)
2. **Uploaded Files** — list `knowledge_documents` with indexing status (Uploaded → Parsing → Embedding → Indexed | Failed). Per-file "Retry" buttons on failed.
3. **Drag-and-drop upload zone** — POSTs files to `/.netlify/functions/upload-doc` (write a stub that accepts the upload and creates the `knowledge_documents` row with `indexed_status = 'pending'`)
4. **Test panel** — owner types a query, sees the salesperson's view in real time (calls `treeq-ai` and renders the response)

For v0.1, no auth on `/admin` — protect via Netlify password-protection (set in netlify.toml) until proper auth lands.

**Definition of done:**
- `admin.html` renders all four sections
- Notion source already shows "Synced" once Task D is done
- Drag-and-drop creates `knowledge_documents` rows
- Test panel works end-to-end

### TASK G — Auth scaffolding (FLAG-GATED OFF)

Per memory: build auth + Stripe scaffolding but flag-gated off (TreeQ is free during user-base build). Per UX research: Apple/Google + SMS OTP, magic link fallback.

1. Wire Supabase Auth (`@supabase/supabase-js` v2 is already installed)
2. Add a `/login.html` page with three buttons: "Continue with Apple" / "Continue with Google" / "Continue with phone" → wired but disabled with a "Coming soon" tooltip
3. Add an `auth.js` shared module that's a no-op when `WINDOW.TREEQ_AUTH_DISABLED === true` (default)
4. Add an environment flag `TREEQ_AUTH_ENABLED` (default false). When enabled in the future, `auth.js` will route unauthenticated users to `/login.html` and gate `dashboard.html` + `admin.html`
5. Stripe similarly: a stub `/billing.html` page wired to Supabase but flag-gated

**Definition of done:**
- `/login.html` renders the three options
- `auth.js` exists, is a no-op when the flag is off
- All other pages can import `auth.js` without breaking
- Documented in `HANDOFF.md` exactly what flips the flag

### TASK H — Bidirectional Jobber sync stub

Per FMS research, this is the "side-car not replacement" wedge. Don't build the whole thing tonight — build the back-end shape:

1. Add `external_integrations` rows for Jobber (kind='jobber') in the migration (already done in Task C)
2. Add an Edge Function stub `netlify/functions/jobber-webhook.js` that accepts Jobber webhooks (job created, quote viewed, etc.) and writes to `job_events` — even if it can't actually be triggered yet because we don't have OAuth tokens
3. Write `research/jobber_api_integration.md` documenting the Jobber API endpoints we'll need (https://api.getjobber.com/api/graphql), the OAuth flow, and the exact mutations for: read clients, read jobs, read quotes, push quote, push estimate-as-draft

**Definition of done:**
- Webhook function exists, parses Jobber payload shape, writes to job_events
- Documentation file exists with concrete API endpoint examples

### TASK I — Voice transcription Edge Function

For when the mic button is used:

1. New Edge Function `netlify/functions/transcribe.js`
2. Accepts a POST with base64 audio data + media_type
3. Calls OpenAI Whisper API (`whisper-1` or `gpt-4o-mini-transcribe`)
4. Returns `{ text: string, latency_ms: number, cost_usd: number }`
5. Logs every transcription to a new `transcriptions` table (so we can review accuracy on chainsaw audio later)
6. Add env var `OPENAI_API_KEY` to `.env.example`

**Definition of done:**
- Function works locally via `netlify dev` with a test audio file
- New migration `0003_transcriptions.sql` adds the table + RLS
- Dashboard wires the mic button to call this function

## 5. When you finish all the tasks (or get blocked)

If you blast through all of Tasks A–I before Cameron wakes up, work on these in priority order:

1. **Run the math regression tests in `HANDOFF.md` T2** — they were on Cameron's pre-existing queue
2. **Write 10 synthetic salesperson scenarios** and run them through the conversational estimator. Document where it shines and where it misses in `research/estimator_eval_round1.md`
3. **Build a QuickBooks Online OAuth stub** following the same shape as the Jobber stub
4. **Refine the dashboard's "smart suggestion" chip generator** — it currently shows static text. Wire it to a tiny Edge Function that calls Sonnet 4.6 with the tenant's operational data + time-of-day and returns 3 suggested questions
5. **Index existing Spartan Notion pages beyond the 5 source DBs** — Document Hub, SOP pages, anything operational. These are the materials for the "ask anything" use case
6. **Sketch a PowerSync proof-of-concept** in a separate branch — not for v0.1 production but the conceptual stub

If you get **blocked** on something (missing env var, missing API key, ambiguous design call), do this:
1. Document the blocker in `HANDOFF.md` under `## BLOCKERS NEEDING CAMERON`
2. Make the most reasonable assumption you can and continue
3. **Do not stop. Move to the next task.** There's enough work here that one blocker shouldn't stall the run.

## 6. Verification protocol

After each task:
1. Run any unit tests that exist
2. Manually verify the happy path
3. `Read` any file >200 lines you just wrote to confirm it didn't truncate
4. Append your `HANDOFF.md` entry

After all tasks:
1. Confirm `netlify dev` still starts cleanly
2. Confirm existing `index.html` cut estimator still works (don't break Cameron's production)
3. Final entry in `HANDOFF.md` summarizing what's done, what's blocked, and what's next

## 7. Tone / output guidance

- Don't pad. Cameron prefers terse, direct progress notes.
- Number choices when offering them. Never ask "should I do X or Y" — pick and document.
- File-share by computer:// link at the end of each task with a one-line description.
- Code comments should be short and explain "why," not "what."
- Memory is at `C:\Users\camer\AppData\Roaming\Claude\local-agent-mode-sessions\.../memory/` — read `MEMORY.md` at the start; update relevant memories if you learn something durable.

## 8. Open strategic questions Cameron hasn't decided yet

You may surface opinions on these in `HANDOFF.md`, but don't make irreversible choices:

1. **Embeddings provider** — Anthropic doesn't ship dedicated embeddings; default to OpenAI `text-embedding-3-small`. Document the choice.
2. **Per-tenant Notion integration** — Spartan has one. When Powell Arbor Solutions signs up, do they OAuth into Notion or upload exports? Pick the simpler path for v0.1.
3. **Daily-thread vs topic-thread persistence** — UX research says daily. Honor that unless you find a strong reason.
4. **Photo storage** — Stage 1 sends photos straight to Claude (not persisted). Stage 2 should persist to Supabase Storage tied to `job_events`. Defer the migration until Task A is done.
5. **"Smart suggestion" chip — generated or curated?** — Default to generated (LLM call). Cache for the day per user.

## 9. Final reminder

This is a real production codebase. Spartan's salespeople will use what you build. The bar isn't "works on my machine" — it's "doesn't break at 7am when Cameron's salesperson is on a roof."

Test the happy path. Handle the obvious errors. Log everything to `quotes` / `conversations` / `transcriptions` so the calibration corpus accumulates.

Cameron's contact for genuine blockers: 585-501-6111 — but he's asleep. Don't text. Document and continue.

Go.
