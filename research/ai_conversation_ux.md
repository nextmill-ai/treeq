# TreeQ — AI-Conversation-First Dashboard UX Brief

Compiled 2026-05-12 via WebSearch + WebFetch of Perplexity, Arc Search, ChatGPT, Claude mobile, Granola, Notion AI, Glean, Jobber/ServiceTitan field apps.

## TL;DR — opinionated stack

1. Home screen = one giant voice button in thumb zone, single-line text input above it, three "Recent / Smart-Suggested" chips. **No nav drawer, no tabs, no dashboard.**
2. Voice: push-to-hold default, optional "hands-free mode" toggle for in-truck. Server-side Whisper or Anthropic native audio — not Web Speech API.
3. Knowledge admin lives on **web only**, not in the mobile app. Drag-drop + Google Drive/Notion connectors. Indexing status as percentage bars with per-file states.
4. Auth: Sign in with Apple + Google primary, SMS OTP third option, magic link as fallback. Company picker appears only if user belongs to multiple tenants.

## 1. Home screen — the "one big button" pattern

```
┌─────────────────────┐
│  TreeQ              │  ← logo + company name (tiny, top-left)
│  Spartan Tree       │
│                     │
│  [recent chip]      │  ← 3 chips: "Maple removal 40ft", 
│  [recent chip]      │     "Brush hauling rate", 
│  [smart suggestion] │     "Stump grinding ash"
│                     │
│   ┌───────────────┐ │  ← single-line text input
│   │ Ask anything… │ │     (tap to expand to multi-line)
│   └───────────────┘ │
│                     │
│   ┌─────────────┐   │
│   │     🎤      │   │  ← 96px mic button, centered in thumb zone
│   └─────────────┘   │
│                     │
│  Photo  Knowledge   │  ← two tiny icon buttons, bottom corners
└─────────────────────┘
```

**Why:**
- 96px mic in Wroblewski's "natural zone" (bottom-center) — fastest one-thumb tap. Far exceeds 44–48px minimum. Matches Jobber's "large buttons, 3–4 taps to complete core tasks" pattern that beats ServiceTitan in technician usability tests.
- Text input above covers typing-preferred minority (loud chipper, in-store) without making them hunt for a keyboard mode.
- Three chips solve Granola's discoverability problem. Two auto-derived "Recent" (this user's last 7 days), one "Smart Suggestion" generated from time-of-day + season (e.g., 7am Monday in October → "Ash + emerald ash borer pricing").
- Photo / Knowledge corners are tiny. Photo opens camera-first job-pricing flow. Knowledge surfaces read-only library on mobile.

**Don't ship:** bottom tab bar (compresses thumb zone), side drawer (invisible on first launch), dashboard with metrics tiles (irrelevant to salesperson at a curb).

## 2. The AI conversation surface

**Steal from ChatGPT mobile:** voice orb lives in input row, tapping it streams live transcript into the same thread typed messages live in. One thread, one surface, no mode switch.

**Steal from Perplexity:** **always cite sources inline.** When TreeQ answers "What's our stump grinding rate for 30-inch oaks?", include a chip like `[Pricing Sheet 2026, row 47]` that taps open to the source. **This is what builds owner trust that the AI isn't hallucinating.**

**Arc Search's three-step transparency animation** ("searching… reading… composing") is the model for showing work during longer queries.

**Conversation thread rules:**
- **Persist by day, not by topic.** Tree-service salespeople won't manage "chats." Daily threads are findable by date.
- Show small "fresh as of [timestamp]" footer when an answer cites a knowledge file — user knows whether pricing is current.
- **Photo-first job pricing:** tapping camera icon opens system camera, captures 1–5 photos, pre-fills prompt "Price this job." Conversation asks one species/access question at a time — never a form.

## 3. Voice handling — the hard decision

**Three points and one tradeoff:**

1. **Whisper crushes Web Speech API in noise** — 9.3/10 vs 2.5/10 on noisy-audio benchmarks. 55% fewer errors.
2. **WKWebView mic permissions are painful on iOS** — "forgets" granted permissions on relaunch. Use native Capacitor mic plugin, not `getUserMedia` in WebView.
3. **Push-to-hold beats continuous in noisy field settings.** Construction-focused Benetics AI ships with voice primary, but model is "tap to start, listen until you stop talking" — not always-listening. Chainsaw firing up mid-question = garbage prompts.

**Tradeoff:** continuous (ChatGPT mode) is beloved for casual use but assumes quiet phone-to-face. Field workers in trucks want predictability.

**Recommendation:**
- **Default: tap-and-hold mic to record, release to send.** Button swells, thin waveform pulses, partial transcript appears above input as it streams.
- **Optional: "Hands-free mode" toggle** in settings. When on, single-tap enters ChatGPT-style continuous mode with stop button.
- **Stack:** Capacitor native microphone plugin → record locally → POST audio chunk to Supabase Edge Function → Anthropic native audio (when available in your tier) or OpenAI Whisper API → text answer streams to WebView.
- **Background listening:** don't ship. iOS WKWebView doesn't support it; Android foreground-service requirement creates Play Store review pain.

## 4. Knowledge-upload admin surface

**Web-only.** Owners aren't uploading vendor lists from their phones.

**Reference apps:**
- **Notion AI Q&A** — ties indexing to workspace. Elegant for Notion-native users but doesn't translate to TreeQ (source data lives in Excel/PDFs/Notion separately).
- **Glean** — gold standard for admin clarity. Deployment console with connector cards, OAuth in minutes, dashboards for indexing progress + permission errors + connector health. Permissions inherited from source.
- **Claude Projects** — 30MB/file, unlimited count, PDF/DOCX/CSV/TXT/HTML/RTF/EPUB.
- **ChatGPT Custom GPTs** — 20-file lifetime cap. Famously frustrating. **DO NOT replicate.**

**Recommended TreeQ admin layout:**

```
treeqapp.com/admin → "Train your TreeQ"

┌ Connected Sources ────────────────────────────┐
│ ✓ Notion          Spartan workspace    Synced │
│ ✓ Google Drive    Pricing folder       Synced │
│ ✓ Spreadsheet     Live import          Synced │
│ + Connect another source                      │
└───────────────────────────────────────────────┘

┌ Uploaded Files (47) ──────────────────────────┐
│ ▣ 2026 Price Sheet.xlsx     12.3MB  ✓ Indexed │
│ ▣ Crew SOP - Removals.pdf    4.1MB  ◐ 67%     │
│ ▣ Vendor Contacts.csv        0.2MB  ✓ Indexed │
│ ▣ Dump Spots.pdf             1.8MB  ✗ Failed  │
│   [Retry] OCR couldn't read pages 3–5         │
└───────────────────────────────────────────────┘

┌ Test Your TreeQ ──────────────────────────────┐
│  "What's our rate for 40ft maple removal?"    │
│  → [preview answer with source citations]     │
└───────────────────────────────────────────────┘
```

**Upload UX details:**
- **Drag-drop the whole page** + a "Browse" button. Multi-file. Per-file progress bars.
- **Connectors first, files second.** Spartan's source-of-truth schemas live in Notion; connector should sync continuously, not require re-uploading exports. Matches existing data-model memory.
- **Status taxonomy:** Uploaded → Parsing → Embedding → Indexed (or Failed with retry CTA + human-readable error).
- **Freshness:** "Last synced 4 minutes ago" per connector. For one-off files: "Updated [date]" + small re-upload button. **RAG freshness is a known pain point — automatic re-indexing on file change is essential.**
- **File support:** PDF, DOCX, XLSX, CSV, TXT, Notion pages, Google Docs/Sheets. **Skip OpenAI's 20-file cap — unlimited count, 50MB/file.**
- **Test panel at bottom** — owner types a query, sees exactly what salesperson sees, with cited sources. **Single most important trust-building feature.**

**Permissions:** keep simple at launch. Two roles per tenant: `owner` (sees and edits everything, uploads knowledge) and `member` (only converses, doesn't see admin). Owner can mark individual files as `owner-only` with lock icon. Don't try to mirror Glean's full ACL propagation — TreeQ tenants are 5–50 person shops, not enterprises.

## 5. Quick-start — sub-60-second onboarding

A salesperson at a customer's curb installing TreeQ for the first time has maybe 30 seconds before they bail.

**Auth recommendation:**
1. **Sign in with Apple + Google as primary buttons.** Sign in with Apple required if any third-party auth offered anyway. Both eliminate email-typing.
2. **Magic link as fallback.** Real mobile pain: universal links / deep linking required to avoid landing in mobile browser; enterprise spam scanners can pre-consume tokens. For small tree-service tenants, link scanners aren't the threat — but get Capacitor deep-link config right.
3. **SMS OTP as third option** for users without iCloud/Google auth. Modern iOS/Android auto-fills SMS codes from keyboard suggestion bar — faster than magic links in practice.
4. **Skip passwords entirely.** No password creation, reset flow, or support burden.

**Multi-tenant picker:**
- If user belongs to exactly one company (common case), drop them straight into home screen.
- If 2+ companies (rare — contractor working for two tree services), show one-screen picker with company logos as tap targets. Cache last choice, skip on next launch.

**First-run home screen:**
- **Pre-populate three chips** with: "How do we price a 30ft pine?", "Who's our chipper repair vendor?", "What's our dump rate at [closest dump spot to current GPS]?" — derived from tenant's actual loaded data. User immediately sees TreeQ has something useful.
- **Skip tutorial carousel.** Granola's onboarding carousel is the moment users disengage. Let suggestion chips do the teaching.
- First conversation completion triggers single in-context tooltip: "Tap and hold the mic to talk hands-free." That's the whole onboarding.

## 6. Decision matrix

| Decision | Recommendation | Confidence |
|---|---|---|
| Home screen layout | Mic button center-bottom, text input above, 3 suggestion chips, two corner icons | High |
| Voice activation | Push-to-hold default, hands-free mode opt-in | High |
| Speech-to-text | Server-side Whisper or Anthropic native audio | High |
| Mic capture | Capacitor native plugin, not WebView getUserMedia | High |
| Conversation surface | Single thread/day with inline source citations | High |
| Knowledge admin | Web-only, connector-first, file-fallback, with live test panel | High |
| File limits | 50MB/file, unlimited count | Medium |
| Auth | Apple + Google + SMS OTP, magic link only as fallback | High |
| Multi-tenant picker | Skip if 1 tenant, one-screen picker if 2+ | High |
| Onboarding | Zero forms, suggestion chips do the teaching | High |

## 7. Biggest UX risk

Same one that hurts Arc Search: **when the AI doesn't have the answer, the experience collapses.**

Two non-negotiable mitigations:
1. **Owner-side test panel** so owner sees and fixes gaps before salespeople hit them.
2. **Inline source citations** so when the AI is wrong, salesperson can find and verify source in one tap.
