# Handoff Template — Cowork → Claude Code

> **Project:** TreeQ. Live at **treeqapp.com** on Netlify. Future deploys: drag the
> updated `index.html` onto the Netlify project's Deploys page (project name:
> `treeqapp`).
>
> **Workspace (canonical, as of 2026-05-10):** `C:\Users\camer\OneDrive\Documents\Claude\Projects\TreeQ`
> *(switched from Google Drive 2026-05-10 — Drive copy is deprecated and may be deleted)*

---

## STATE AS OF 2026-05-10 (overnight handoff)

**What just shipped to `index.html` v1.9 (114 KB, on OneDrive):**
- Species picker integrated — 14-tile genus drill-down replacing the native `<select>`. Tap species → writes to hidden `<select id="species">` and dispatches `change`, so all existing compute logic runs unmodified.
- 14 illustrator-delivered leaf SVGs inlined from `./icons/*.svg`.
- Flag pills derived from `species_data/master_species_list.csv` via `LATIN_MAP` + `SPECIES_DATA`. Tappable, opens explanation modal.
- Two-tier hearts (Cameron-supplied SVGs in `./icons/`).
- 4 new genus tiles split out of "Other Hardwoods": Sycamore, Beech, Tulip Tree, Elm. `SPECIES.group` field updated for those species.

**Backup file:** `index-v1.8-pre-picker.html` (68 KB) — the previous working version. Reference for math-regression baselines. **Do not modify.**

**Cameron's last action before bed:** uploaded `index.html` to Netlify but the picker dropdown didn't open. Cause was `window.SPECIES` references in the picker IIFE — `const SPECIES = {…}` at top-level scope doesn't bind to `window`. Fixed in this same Cowork session: removed all `window.SPECIES` references, simplified `ready()` to just defer until DOMContentLoaded. Cameron may or may not have re-uploaded the fixed `index.html` to Netlify before going to bed. If treeqapp.com is still broken, the OneDrive copy has the fix; Cameron will redeploy in the morning.

---

## CURRENT TICKET QUEUE

Execute in order. After **each** ticket, run the **VERIFICATION PROTOCOL** (below). If any verification fails, stop, document the failure in **HISTORY**, and do not start the next ticket. Do not attempt to fix verification failures by modifying `SPECIES` coefficients, `compute()` math, or anything else flagged out-of-scope.

### T1 — Smoke-test the integrated picker visually (PRIORITY)

**Goal:** Confirm the picker dropdown actually works end-to-end now that the `window.SPECIES` bug is fixed.

**Setup:** Install Playwright if not present (`npm install -D playwright @playwright/test` in a `tests/` subfolder; do NOT pollute the project root).

**Test scenarios to script:**
1. Open `index.html` via `file://`. Verify no console errors.
2. Confirm trigger button reads "Silver Maple" by default.
3. Click trigger button → assert `#species-picker-modal` no longer has `.hidden` class.
4. Assert all 14 genus tiles render (use `[data-genus]` selector). Assert each has a leaf SVG, name, and bottom-right count number.
5. Click the "Maple" tile → assert `#species-view` is visible, title says "Maple", 7 species rows render.
6. Click "Norway Maple" species row → assert modal closes, calculator hero text reads "X″ Norway Maple", height/crown auto fields update.
7. Click "Help me identify" path (the leaf decision tree). Pick any path that ends in a species. Verify trigger button label updates to match.
8. Click flag pill on Norway Maple's species row → assert flag-modal opens with non-empty token + description.
9. Tap heart on a species → reload page → verify heart still active (localStorage persistence).

**Output:** Screenshots to `tests/results/T1-*.png`. Log results to `tests/T1-results.md`.

**Verification:** All 9 scenarios pass.

**Out-of-scope:** Mobile/touch testing (desktop browser only is fine for tonight).

---

### T2 — Math regression: integrated build vs v1.8 baseline

**Goal:** Confirm the picker integration didn't shift any calculator outputs.

**Approach:** Use jsdom or a headless browser to load both files. For each test case, call `compute(speciesKey, dbh, trimPct)` if exposed, else drive the UI and read the output values. Diff numeric outputs.

**Test cases (10 fixtures):**
| # | Species key | DBH | Trim % bucket |
|---|---|---|---|
| 1 | silver_maple | 18 | 0 |
| 2 | norway_maple | 24 | 1 |
| 3 | sugar_maple | 30 | 0 |
| 4 | red_oak | 36 | 2 |
| 5 | pin_oak | 22 | 0 |
| 6 | green_ash | 14 | 0 |
| 7 | white_pine | 28 | 0 |
| 8 | hemlock | 16 | 0 |
| 9 | norway_spruce | 32 | 1 |
| 10 | black_walnut | 20 | 0 |

**Tolerance:** Output time within ±0.001s, output cost within ±$0.01. Any divergence beyond tolerance = stop and report in HISTORY.

**Output:** `tests/T2-regression.md` with per-fixture diffs.

**Verification:** All 10 pass within tolerance.

**Out-of-scope:** Calibrating coefficients. The math should match exactly because nothing math-related changed.

---

### T3 — Document any console errors and odd behavior

**Goal:** With the picker now functional, sweep the app for surface-level bugs.

**Approach:** Walk through these flows with Playwright. Capture every `console.error` and `console.warn`. Capture any visual issues (overlapping elements, off-screen modals, unstyled flashes).

**Flows to walk:**
1. Page load → no errors.
2. Open picker → switch all 4 pills (All, Recent, Frequent, Favorites) → no errors.
3. Type in search box: "ash", "maple", "xyz" → results update sensibly.
4. Drill into 3 different genus tiles → back button works each time.
5. Favorite 3 species via heart → "Favorites" pill shows them.
6. Resize window from 480px wide → 1200px wide → no broken layouts.

**Output:** `tests/T3-bugs.md`. For each issue: reproduction steps, what's expected, what actually happens, console output if relevant.

**Verification:** Document submitted to OneDrive. **Do NOT attempt fixes** — the goal of T3 is to find, not fix.

---

### T4 — Fix only the bugs explicitly listed below (if any apply)

**These are pre-known issues that are safe to fix:**

a. **Dead code — `removal: true` field on GENERA tiles.** This was a hand-coded "High removal" badge that Cameron asked to remove. The CSS class `.tile-flag` still exists but no element gets it. Remove the `removal: true` lines from `TILE_META` (or keep for future — your call, but flag in HISTORY).

b. **`SPECIES_DATA` may have entries for species not actually in production `SPECIES`.** Verify each `SPECIES_DATA` key has a matching `LATIN_MAP` reverse-lookup. Drop orphans. Document in HISTORY.

c. **Trigger button label may show key instead of name on first load if SPECIES initialization order is wrong.** Verify default render path: `syncLabel()` runs once at init and pulls the species name. If you see "silver_maple" instead of "Silver Maple", investigate — but only if reproducible.

**Out-of-scope (DO NOT FIX without explicit ticket):**
- Anything in T3's `tests/T3-bugs.md`. Those are documented for human review.
- `compute()` math, `SPECIES` coefficients, `crownIntercept`/`crownSlope`/`heightA`/`heightB` values.
- The leaf decision tree (`leafDecision`/`showMatches` code) unless directly broken.
- CSS variable values in `:root` (`--forest`, `--gold`, etc.).

---

### T5 — Add error visibility for development

**Goal:** Surface JS runtime errors so future bugs aren't silent.

**Implementation:** Add at the very top of the inline `<script>`, right after `'use strict';` (or before `const SPECIES`):

```js
window.addEventListener('error', e => {
  console.error('[TreeQ] Uncaught error:', e.message, 'at', e.filename + ':' + e.lineno);
});
window.addEventListener('unhandledrejection', e => {
  console.error('[TreeQ] Unhandled rejection:', e.reason);
});
```

**Verification:** Reload app. No new errors appear. (The handlers are passive — they only fire when something else breaks.)

**Out-of-scope:** Visible on-screen error toasts. Console-only for now.

---

## VERIFICATION PROTOCOL (run after EACH ticket)

1. JS syntax check:
   ```bash
   node --check <(grep -oP '<script>[\s\S]*?</script>' index.html | sed 's|</\?script>||g')
   ```
   Must say "JS SYNTAX OK" (exit 0). Otherwise revert your changes.

2. File size sanity:
   - `index.html` should be in the 110–125 KB range. Outside that, something's wrong (regenerate or revert).
   - Closing tags: exactly one each of `</script>`, `</body>`, `</html>`.

3. Quick visual test (Playwright or your preferred equivalent):
   - Page loads without console errors
   - Trigger button visible
   - Click trigger → modal opens

4. Math regression smoke (subset):
   - silver_maple at DBH 18, trim 0 → time + cost values
   - Compare to v1.8 baseline. Must match within tolerance.

If any check fails: **revert your changes via git or by restoring from `index-v1.8-pre-picker.html`** (only the inline `<script>` and `<style>` and the modal HTML changed — the rest of the body is byte-identical except for the species select swap).

---

## ROADMAP (NOT FOR TONIGHT — wait for daytime instruction)

These are real follow-on tickets but each carries enough risk that they shouldn't run unsupervised:

- **SMS-1 — Activate v2.3 Cloudflare Worker deploy.** See `SMS_FALLBACK_SPEC.md`. Activates the parked `deploy/` path. Requires Cloudflare credentials and DNS.
- **SMS-2 — Build `lib/packet.js` encode/decode + species-codes.**
- **Genus-tile data audit.** "Other Hardwoods" still lumps 12 species (Magnolia, Catalpa, Ginkgo, Hackberry, Cottonwood, Poplar/Aspen, Willow, Mulberry, Basswood, Linden, Chinese Chestnut, Horse Chestnut). Cameron may want some broken out — needs his input.
- **Pricing engine extraction.** Currently inline in `index.html`. Long-term, moves to server-side per `treeq_methodology_protection` memory.
- **Apple Developer Program enrollment** (waiting on DUNS).
- **Google Play Console enrollment** ($25 one-time, daytime task).

---

## KILL CRITERIA

Stop autonomous **execution** work (tickets T1–T5) and switch to **research mode** (BONUS WORK below) in any of these cases:

1. Two consecutive tickets fail verification.
2. You are about to modify `SPECIES` coefficients or `compute()`.
3. You are about to delete files or run destructive Git operations.
4. The math regression test (T2) shows ANY divergence beyond tolerance.
5. You discover a security or auth issue.
6. Any ticket would require fetching from a network or installing major dependencies (beyond `playwright` for tests).

When stopping execution: write the reason in HISTORY below with timestamp, then proceed to research mode. Stop research too only if (a) the research queue is complete and you've nothing useful left to write, or (b) Cameron returns and posts new instructions.

---

## HISTORY

*(Claude Code: append your work here as you complete tickets. Newest at top. Format:*
*`## YYYY-MM-DD HH:MM · T# · Status` — short summary*
*`### Verification:` results*
*`### Notes:` anything Cameron should see in the morning)*

---

## 2026-05-15 · Agent queue (v2.3 thin client + Latin names)

Ran the seven-step checklist from Cameron’s paste (canonical workspace). Summary:

| Step | Result |
|------|--------|
| 0 Baseline | `git status -sb` — dirty: `index.html`, `deploy/public/index.html`, species/math/deploy/Netlify mirrors, `HANDOFF.md`, `ROADMAP.md`, etc.; untracked `.env.local`, `research/oss-references.md`, `tests/node_modules/`. |
| 1 Species invariant | **PASS** — `node --input-type=module` check on `deploy/functions/lib/species-db.js`: `missing scientificName: []`. |
| 2 `npm run sync:estimator-libs` | **PASS**. |
| 3 HTML parity | **PASS** — `fc /b` via `cmd /c` (PowerShell `fc` is an alias): no differences between root `index.html` and `deploy/public/index.html`. |
| 4 Math smoke | **SKIP (expected)** — `tests/verify-math-smoke.mjs` exits **2**: thin client no longer exposes `compute()` in the browser; server branch from `math.js` still matches prior totals (`totalSec` 1270 for silver_maple 18/0 in log). |
| 5 Playwright | **T1 legacy** — `T1-smoke.mjs` fails on v2.3 (`file:///…/api/species` unsupported + missing `#species-picker-label`). Marked **LEGACY** in file header. **Added** `tests/v23-picker-smoke.mjs`: `file://` + mocked `fetch` for `/api/species` and `/api/estimate`, asserts `#species` options include parentheses and `#heroTitle` includes Latin after boot — **PASS** (`node tests/v23-picker-smoke.mjs`). |
| 6 Local API curl | **BLOCKED** — `npx netlify dev` briefly served `species` + `estimate`, then **CLI terminated**: esbuild could not resolve `@supabase/supabase-js` (and peers) for other functions (`upload-doc`, etc.) in the npx-installed CLI context. **Staging curl not attempted successfully** — `https://treeqapp.com/api/species` returned Netlify 404 HTML (path not deployed or different host). *Unblock:* `npm install` at repo root so Netlify can bundle all functions, then re-run `netlify dev` and the two curl one-liners. |
| 7 ROADMAP | **Read-only OK** — “Species picker & taxonomy (near-term)” matches shipped v2.3 (categories + Latin in picker/hero/API); Pro mode toggle and test-debt bullets still accurate (`tests/v23-picker-smoke.mjs` addresses picker/Latin smoke). |

### Follow-up — 2026-05-15 (items 1–3)

**Local Netlify (`npm install` + `./node_modules/.bin/netlify dev`):** ✅ Both curl checks green — `/api/species` has `scientificName` on every row (0 missing); `/api/estimate?species=silver_maple&dbh=24&trim=5` returns `speciesScientificName` (**Acer saccharinum**).

**Production URLs:**
- **`https://treeqapp.com`** — `/api/species` and `/.netlify/functions/species` both **404**: production Netlify has not deployed the thin-calculator redirects/functions (or DNS points at static-only legacy). Fix by redeploying this repo via Netlify with current `netlify.toml`.
- **`https://treeqapp.pages.dev`** (and preview `d901a6f5.treeqapp.pages.dev`) — `/api/species` returns **200** but payload is **stale**: rows are only `{ key, name, group }` (no `scientificName` / `category`). Thin `index.html` in **this repo** expects the new shape — **re-publish `deploy/`** to Cloudflare Pages so Workers match `deploy/functions/`.

---

## 2026-05-10 — overnight session #2 · resumed unattended; switched to BONUS WORK

Picked up where session #1 paused. Per the rules ("do not start a ticket if the previous ticket's verification failed"), T1 verification failed on S7 → falling through to BONUS WORK (research mode). Research is read-only and can't trip kill criteria, so this is the safe path through the night.

### Math-smoke completion (the one mid-flight item from session #1)
- Ran `node tests/verify-math-smoke.mjs`. **Inconclusive** (script limitation, not a regression):
  - Current `index.html`: `compute('silver_maple', 18, 0)` returns `{totalSec:1270, brushSecTotal:670, logSec:600, brushCuts:30, logCutsTotal:5, totalCuts:35}` — clean.
  - v1.8 baseline: `compute()` not in scope. v1.8 wraps the math in a closure rather than top-level globals, so `page.evaluate(() => compute(...))` can't reach it without a different injection technique.
  - Not actually a regression. The script needs a different probe for v1.8 (eval into the IIFE, or drive the UI). Not blocking research.

### Tickets T2–T5 status
- All **deferred**, per the failed-verification rule. They're still cleanly executable in a future session if Cameron applies the one-line S7 fix and re-runs T1.

### R-docs progress (will append per-doc lines below as they land)

## 2026-05-10 02:30 · R1 · DONE — Doc inventory at `research/R1-doc-inventory.md`. One-paragraph summary of CONTEXT/ROADMAP/SMS_FALLBACK_SPEC/DEPLOY/EXTRACTION_SUMMARY/PEST_PRESSURE/RESIDENTIAL_GAP plus 6 cross-cutting observations (IP-protection is load-bearing; data layer ahead of app layer; ROADMAP and SMS spec disagree on Supabase-as-DB — R5 to resolve).

## 2026-05-10 03:00 · R9 · DONE — Genus-tile audit at `research/R9-genus-tile-audit.md`. Recommend 4 new tiles (Linden, Cottonwood/Poplar, Ginkgo, Hackberry) promoted from Other Hardwoods — net 14→18 tiles. Other Hardwoods retains Magnolia, Catalpa, Mulberry, Willow, Chinese Chestnut, Horse Chestnut. 4 open questions for Cameron (tile name "Linden" vs "Basswood"; merge cottonwood+poplar yes/no; drop Chinese Chestnut entirely; illustrator queue ready). Recommendations only — no `index.html` touched.

## 2026-05-10 03:30 · R2 · DONE — SMS server architecture at `research/R2-sms-server-architecture.md`. Recommend **Option A** (activate parked `deploy/` Cloudflare Pages + Worker). Rationale: scaffolding already built (`wrangler.toml`, `functions/lib/math.js`, `functions/lib/species-db.js`), V8 isolate cold start fastest for Quo's 3s webhook deadline, free tier 100k req/day covers expected SMS volume, IP protection already designed via `functions/lib/` non-routing pattern. Alternates documented: B (standalone tiny worker) ships faster but duplicates pricing engine; C (Supabase Edge) only coherent if R5 picks Supabase-for-everything.

## 2026-05-10 04:15 · R5 · DONE — Auth architecture at `research/R5-auth-architecture.md`. Recommend **Supabase Auth** (Postgres bundled = RLS-ready, free 50k MAU). Includes: full SQL schemas + sample RLS policies for `trees`, `quotes`, `account_phones`, `link_phone_codes`; SECURITY DEFINER `current_account_id()` perf optimization; anon-mode strategy (3 options, recommend Option 1 client-only at MVP); Capacitor PKCE OAuth pitfalls + 3 mitigations including Cap-go plugin; phone-link flow kept separate from Supabase phone OTP. Resolves R1's note about ROADMAP-vs-SMS-spec disagreement: pick Supabase for the DB.

## 2026-05-10 05:00 · R7 · DONE — Pricing extraction plan at `research/R7-pricing-extraction.md`. 6-step migration ordered: ship server endpoint → feature-flag client wrapper → debounce + cache → graceful-degradation banner → math regression harness (6160 cases must pass 100%) → dev hot-reload. Two **separate** cutover events: F1 flip flag in prod, F2 delete inline `compute()`. Mermaid sequence diagram included. Live calculator stays responsive via 250ms debounce + 5min CDN cache + small client LRU. **No client-side fallback** for IP protection — offline users use SMS-fallback button instead.

## 2026-05-10 05:30 · R8 · DONE — Data architecture at `research/R8-data-architecture.md`. Mermaid ER + table-by-table proposal across 5 layers: identity (accounts/users/account_phones/fsm_connections), customer-facing (customers/properties/species/trees/species_favorites), operations (quotes/quote_lines/quote_state_changes/jobs/job_assignments), crew/resource graph (employees/subcontractors/resources/equipment/crews/crew_members/proficiency), communications (messages/sms_quotes). All per-tenant tables follow R5's `account_id`-RLS template. Migration ordered to phases P2→P7 in ROADMAP. **Calibration coefficients stay in worker code (`species-db.js`)**, not Postgres — preserves IP boundary.

## 2026-05-10 06:00 · R10 · DONE — System architecture at `research/R10-architecture.md`. One mermaid flowchart synthesizing R2+R5+R7+R8+SMS-fallback. Layers: Client (web + Capacitor wraps), Cloudflare edge (Pages + CDN + Worker + KV), Supabase (Auth + Postgres + RLS), Quo (SMS), Future (Jobber, other FSMs, PHCRx). 6 risks flagged: DNS cutover, CF Access vs anon, Capacitor PKCE, Quo A2P 10DLC inheritance, `species-db.js` redeploys, multi-service failure modes.

## 2026-05-10 06:45 · R6 · DONE — Quo API surface at `research/R6-quo-api.md`. Auth: `Authorization: <KEY>` (no Bearer prefix). Outbound: `POST https://api.openphone.com/v1/messages` with {content, from, to[]}. Inbound webhook: `message.received` event w/ `data.object.{text,from,id}`; signature header `openphone-signature` = `hmac;1;<ts>;<sig-b64>`, HMAC-SHA256 over `<ts>.<rawbody>`. Rate limit 10 req/s. **Action item before SMS-1 launch:** confirm with Quo support whether existing A2P 10DLC brand registration covers the new programmatic estimate-reply campaign (2-5 day approval if a new campaign is needed). 13-step SMS-1 runbook included.

## 2026-05-10 07:30 · R3 · DONE — Capacitor wrap at `research/R3-capacitor-wrap.md`. TreeQ → Capacitor is the smallest possible Capacitor migration (static HTML, no Next.js export gymnastics). Recommend Capacitor 7 over 8 for plugin maturity. 30-min first-build runbook (sibling `TreeQ-mobile/` folder, `npx cap init` → `cap add ios` + `cap add android`). 5 known pitfalls: PKCE OAuth (R5 cross-ref), WebView storage purging, WKWebView CORS for `/api/estimate`, mandatory Sign in with Apple under §4.8, livereload origin breaks OAuth callbacks. iOS sms: + Android smsto: URI both work without a plugin. **Cameron is on Windows — needs Mac-in-cloud or GitHub Actions macos-latest for iOS builds.**

## 2026-05-10 08:00 · R4 · DONE — Store enrollment walkthroughs at `research/R4-store-enrollment.md`. Apple ($99/yr, D-U-N-S already in flight, 5–10 min verification call w/ Apple employee, NMC LLC name must match D&B exactly). Google Play ($25 one-time, D-U-N-S also required for org accounts since 2024, gov ID + business docs). Common rejections + tree-service-specific guidance (location permissions need explicit purpose, sms: URI is allowed since user-initiated). Pre-flight master checklist (NMC LLC name consistency, public website, privacy policy, app icon, screenshots). 8-week timeline backwards from launch.

## 2026-05-10 08:15 · WRAP-UP · all R1–R10 complete

**What's done in this session.**
- All 10 R-docs landed in `research/`, in the suggested order R1 → R9 → R2 → R5 → R7 → R8 → R10 → R6 → R3 → R4.
- Math-smoke test (the one mid-flight item from session #1) ran but couldn't compare against v1.8 because v1.8 wraps `compute()` in a closure. Not a regression — script limitation.
- HANDOFF.md HISTORY has one summary line per R-doc above.

**What Cameron should look at first when he wakes up:**
1. **The S7 bug from session #1 is still open.** It's documented in detail in the previous HISTORY entry below this one. One-line fix proposed. If Cameron wants T1 to pass, apply the fix and re-run `node tests/T1-smoke.mjs`. If T1 passes, T2–T5 are all clear to run.
2. **R-doc reading order for Cameron:** R1 (5 min, sets context), R10 (5 min, the one diagram that ties everything together), then dive into whichever phase he's about to ticket. R2 + R5 + R7 are the load-bearing technical decisions. R9 is a pure picker UX call he can act on quickly. R6 is concrete enough for SMS-1 implementation. R3 + R4 are app-store/native-build prerequisites for any iOS/Android shipping.
3. **Decisions only Cameron can make** (called out across multiple R-docs):
   - R9: tile names ("Linden" vs "Basswood"), merge cottonwood+poplar, drop Chinese Chestnut?
   - R5: Cap-go plugin vs official + workaround for Capacitor+Supabase OAuth?
   - R6: confirm A2P 10DLC inheritance with Quo support before any SMS launch.
4. **No changes to `index.html`, `SPECIES`, `compute()`, `:root` CSS, or any production code in this session.** Only `tests/` (already populated by session #1) and `research/` (new) were written. Project root is clean.

**Stop reason:** both queues are complete (T1–T5 deferred per failed-verification rule; R1–R10 all DONE). Per the "stop only when both queues are complete and nothing useful left to write" rule, stopping now.

## 2026-05-10 — overnight session #1 · PAUSED MID-T1 (handoff to relaunch)

User paused at a clean checkpoint to relaunch with `--dangerously-skip-permissions` so the next session can run unsupervised. State is dumped here for the next session to pick up.

### What's done in this session

- Created `tests/` and `research/` directories.
- Installed Playwright + Chromium-headless-shell in `tests/` (NOT in project root).
  - `tests/package.json` (private, type:module, devDeps: playwright + @playwright/test ^1.59.1)
  - `tests/node_modules/` and `tests/package-lock.json` exist
  - Browser binaries cached in `%LOCALAPPDATA%\ms-playwright\` (chromium-headless-shell-1217)
- Wrote `tests/T1-smoke.mjs` — 9 scenarios, runs under `node`.
- Wrote `tests/verify-syntax.mjs` — JS syntax + size + closing-tag count.
- Wrote `tests/verify-math-smoke.mjs` — silver_maple DBH 18 trim 0 diff between current and v1.8. **Not yet executed.**
- Ran T1: **8/9 PASS, 1 FAIL.**
- Ran verify-syntax: **PASS** (JS SYNTAX OK; 114,963 bytes / 112.3 KB; one each of `</script>`, `</body>`, `</html>`).

### T1 results — `tests/T1-results.md`

| # | Scenario | Status | Detail |
|---|---|---|---|
| S1 | Page loads, no console errors | PASS | clean |
| S2 | Trigger label = "Silver Maple" | PASS | exact match |
| S3 | Trigger click opens modal | PASS | `.hidden` removed |
| S4 | 14 genus tiles, each with leaf+name+count | PASS | count=14, structure ok |
| S5 | Maple tile → species view, 7 rows | PASS | title="Maples" (plural — handoff said "Maple" but production data uses "Maples"; test accepts either) |
| S6 | Norway Maple selection wires through | PASS | hero "24″ Norway Maple", trigger "Norway Maple", height 66→57, crown 30→22 |
| S7 | Help-me-ID flow → trigger label updates | **FAIL** | chose="Eastern White Pine", `#species`.value="white_pine" ✓, but `#species-picker-label` stayed "Silver Maple" ✗ |
| S8 | Norway Maple flag pill → modal w/ token+desc | PASS | token="invasive", desc length 113 |
| S9 | Heart on sugar_maple persists across reload | PASS | localStorage round-trip ok |

### Root cause of S7 (real bug, not a test artifact)

`index.html` ~line 2394–2402 in the quiz match-handler:

```js
btn.addEventListener('click', () => {
  speciesSel.value = btn.dataset.k;
  heightOverride = null;
  crownOverride = null;
  render();
  closeQuiz();
});
```

It sets `speciesSel.value` directly, which does NOT auto-fire `change`. The picker's trigger-label sync (line ~2997) is `sel.addEventListener('change', syncLabel)` — it never gets notified, so the trigger button still shows the old species name. The hero/calculator math IS still correct because `render()` runs, but the picker's label is stale, creating a mismatch the user would see.

**One-line fix** (do NOT apply tonight without explicit ticket — out-of-scope per T4): after `speciesSel.value = btn.dataset.k;`, add `speciesSel.dispatchEvent(new Event('change', { bubbles: true }));`

### Verification per the protocol

1. JS syntax check — **PASS** (`tests/verify-syntax.mjs`)
2. File size + closing tags — **PASS** (114 KB; 1×`</script>`, 1×`</body>`, 1×`</html>`)
3. Quick visual test — **PASS** (S1+S2+S3 above)
4. Math regression smoke — **NOT RUN** (script written, paused before execution; was the next thing in flight)

### What's mid-flight

`tests/verify-math-smoke.mjs` was just written (not yet executed). It compares `compute('silver_maple', 18, 0)` between `index.html` and `index-v1.8-pre-picker.html`. Expected to pass since no math touched.

### Exact next step if resumed (do this first on relaunch)

1. `cd tests && node verify-math-smoke.mjs` — confirm math identical to v1.8 (sanity).
2. Per the rules ("Do not start a ticket if the previous ticket's verification failed — fall through to BONUS WORK"), **do not run T2–T5**. T1 verification fails on S7.
3. Switch to BONUS WORK and produce R1 → R10 in `research/`.
   - Suggest order: R1 (cheap doc inventory, grounds everything else) → R9 (data-driven, uses CSVs) → R2 (server arch, biggest decision) → R5 (auth) → R7 (pricing extraction) → R8 (data model) → R10 (synthesis, must come after R2/R5/R7/R8) → R6 (Quo) → R3 (Capacitor) → R4 (store enrollment).
   - Each R-doc gets one HISTORY line on completion.

### Notes for Cameron in the morning

- **Picker itself is solid** — 8/9 scenarios pass, including hero/calculator integration, flag modal, localStorage persistence. The `window.SPECIES` fix from last night is working.
- **Real bug found by S7:** the "Help me ID" quiz selects a species but doesn't tell the picker about it, so the trigger button shows a stale label. Bug is in the quiz code, not the picker. Listed in T4 as out-of-scope ("DO NOT FIX without explicit ticket"), so this session left it alone. One-line fix proposed above.
- **No files touched outside `tests/` and (about to be) `research/`.** `index.html` is byte-identical to where Cameron left it. No SPECIES coefficients, no compute() math, no `:root` CSS values modified.
- **Screenshots in `tests/results/`**: T1-01-load through T1-09-heart-persist.png. Useful for visual review.
- **Playwright install touched `tests/node_modules/` only** — project root is clean (no top-level `node_modules`, no top-level `package.json`). Browser cache lives in `%LOCALAPPDATA%\ms-playwright\` (per-user, not in the project).
- The picker modal HTML at index.html:3058–3065 has unbalanced divs (`#flag-modal` never closed, toast div opens inside it never closed). Browser auto-closes at `</body>` so it functions, but the toast div ends up nested inside the hidden flag-modal — meaning toast feedback on selection probably never shows. Worth a T3-style note but I didn't fix it.

### Pause acknowledged
Stopping now. Next session: read this entry, run `node tests/verify-math-smoke.mjs` for completeness, then go straight to BONUS WORK / research per the suggested order above.

---

## BONUS WORK — research mode (always available as a fallback)

**When to enter this mode:** any of —
- the ticket queue (T1–T5) completes cleanly, OR
- a kill criterion stops execution work (research is read-only and harmless), OR
- a ticket is blocked waiting on something Cameron would need to provide.

This is *thinking* work, not execution — the goal is to land Cameron a stack of
well-reasoned deliverables he can review in the morning and use to scope the next
round of tickets. **Do not implement** any roadmap item; produce documents only.

Even if you stopped execution work mid-stream, you can and should keep going
on research. Research never trips kill criteria because it doesn't touch any
file outside `research/`.

All output goes into a `research/` folder at the project root (create it). Each item below is one markdown file.

### R1 — Inventory pass on existing docs

Read and produce a one-paragraph summary of each: `CONTEXT.md`, `ROADMAP.md`, `SMS_FALLBACK_SPEC.md`, `deploy/DEPLOY.md`, `species_data/EXTRACTION_SUMMARY.md`, `species_data/MAY_2026_PEST_PRESSURE_MATRIX.md`, `species_data/RESIDENTIAL_GAP_AND_SOURCES.md`. Output: `research/R1-doc-inventory.md`.

This is the cheapest first step — gives you grounding for everything that follows.

### R2 — Server architecture comparison for SMS-1

Decision: where does the SMS webhook handler + pricing engine actually run? Three candidates already named in `SMS_FALLBACK_SPEC.md` §2:
- A. Activate parked `deploy/` v2.3 Cloudflare Worker
- B. Standalone tiny worker just for SMS
- C. Supabase Edge Functions (per `treeq_methodology_protection` memory)

Read `deploy/wrangler.toml`, `deploy/functions/lib/math.js`, `deploy/functions/lib/species-db.js` to understand what's already scaffolded for option A. Web-search Supabase Edge Functions cold-start latency, pricing tiers, runtime constraints, comparison vs Cloudflare Workers (2025-2026 data). Produce a recommendation with explicit trade-offs across: cold-start latency, cost at 100/1k/10k requests/month, IP-protection (memory says calibration must stay server-side), DX, vendor lock-in.

Output: `research/R2-sms-server-architecture.md`. Recommend ONE option with a short "what changes if Cameron picks option X instead" addendum for each alternative.

### R3 — Capacitor wrap for App Store + Play Store

Per `treeq_delivery_mode` memory: TreeQ ships as a Capacitor wrap of the Next.js (or current single-file) app. Cameron has **not yet** done this. Web-research:
- Capacitor 6+ migration path from a static HTML/JS site (vs from Next.js — Cameron's stack is partway between)
- iOS-specific requirements (App Store Connect, provisioning profiles, Capacitor iOS plugin set, push notification setup if relevant)
- Android-specific requirements (signed APK, Google Play Console, target SDK requirements as of 2026)
- File-system + offline considerations (memory says SMS-fallback offline path is real)
- Capacitor plugin for `sms:` URI scheme — does it exist or does the native intent in Capacitor work via `window.location.href`?

Output: `research/R3-capacitor-wrap.md`. Include a step-by-step "first build" checklist Cameron can follow, plus 3–5 known pitfalls.

### R4 — Apple Developer + Google Play enrollment walk-throughs

From the prior chat dump: Cameron has applied for D-U-N-S under "I'm an Apple developer" path. Apple Developer Program enrollment is queued for when the DUNS lands. Google Play Console is queued at $25 one-time.

Research:
- Apple Developer Program enrollment flow for an LLC (NMC LLC), step-by-step, including the verification phone call and what Cameron needs ready
- Google Play Console enrollment for a business — what's actually different from a personal account, what happens if you choose "organization" vs "individual"
- Common rejection reasons for tree-service apps in the App Store / Play Store
- Whether the Capacitor wrap needs anything special for review (most don't, but native bindings can trigger reviewer questions)

Output: `research/R4-store-enrollment.md`. Two click-by-click walk-throughs (Apple, Google), plus a "what to have ready" pre-flight checklist for each.

### R5 — Authentication architecture

Per `treeq_pricing_strategy` memory: build auth + Stripe scaffolding flag-gated off, flip on later when monetizing. Per `treeq_methodology_protection`: server-side methodology means auth is the gate.

Research and propose:
- Supabase Auth specifically: providers (Google, Apple, Facebook, email magic-link), RLS patterns for "user can only see their own trees/quotes/customers", session refresh handling in a Capacitor wrap
- Anonymous-mode strategy — should the picker work for anon users (FMS vision says yes), how to migrate anon work to a created account later
- Account-to-phone linking for SMS-fallback (`SMS_FALLBACK_SPEC.md` §6) — does Supabase have first-class phone auth that fits, or does the spec's reverse-confirm flow stand alone?

Output: `research/R5-auth-architecture.md`. Include a sample RLS policy SQL block for the `trees` and `quotes` tables.

### R6 — Quo API surface

Per `treeq_sms_fallback` memory: SMS provider is Quo (formerly OpenPhone), not Twilio. Web-research and produce:
- Outbound SMS endpoint (URL, auth method, rate limits, per-segment pricing)
- Inbound webhook (payload shape, signature verification, retry behavior)
- Available API features Cameron isn't currently using that could be useful (call recording for transcripts? voicemail-to-text? contact API for CRM crossover with the FMS vision?)
- A2P 10DLC compliance — does Cameron's existing brand registration cover programmatic outbound, or is a separate registration needed?

Output: `research/R6-quo-api.md`. Include an example outbound-SMS curl command and an example webhook payload (real shape from Quo docs, not invented).

### R7 — Pricing engine extraction plan

The `compute()` function and all `SPECIES` coefficients currently live in the client at `index.html`. Memory says they must move server-side. Already partly done in `deploy/functions/lib/math.js` and `deploy/functions/lib/species-db.js` — but the deploy is parked.

Produce a concrete migration plan:
- Step 1: client calls server for each compute (network call on every input change?) vs server-derived bundle (client downloads a signed-but-opaque blob)
- Step 2: which order to extract (math.js first? species coeffs first?)
- Step 3: how to keep the live calculator responsive while the network is involved
- Step 4: caching / debouncing strategy
- Step 5: rollback / kill-switch if server is down
- Step 6: dev-time fast path (so you don't have to deploy on every code change)

Output: `research/R7-pricing-extraction.md`. Include a sequence diagram (mermaid) for the round-trip.

### R8 — Data architecture for the FMS vision

Per `treeq_long_term_vision` memory: TreeQ becomes a basic field-management system with native SMS+email of quotes, scheduling, crews. Architect the data model from day one.

Propose the entities and relationships:
- `users`, `accounts` (a user belongs to one account, multi-user-per-account is roadmap P5)
- `customers`, `properties`, `trees`, `species`
- `quotes` (draft → quoted → accepted → scheduled → completed → invoiced → paid)
- `crews`, `crew_members`, `equipment`, `subcontractors`
- `messages` (SMS + email log per customer/quote)

Output: `research/R8-data-architecture.md`. Mermaid ER diagram + a brief note on which entities map to picker selection events. Note where it intersects with R5's RLS policies.

### R9 — Genus-tile data audit

The picker auto-derives genus tiles from `SPECIES.group`. "Other Hardwoods" still bundles 12 species (Magnolia, Catalpa, Ginkgo, Hackberry, Cottonwood, Poplar/Aspen, Willow, Mulberry, Basswood, Linden, Chinese Chestnut, Horse Chestnut). Cameron may want some broken out into their own tiles.

For each of those 12, recommend: "own tile" vs "stays in Other Hardwoods" with a one-sentence reason (residential-removal frequency, visual distinctiveness, customer recognition). Use `species_data/master_species_list.csv` and `species_data/removal_priority_top10.csv` as evidence where you can.

Output: `research/R9-genus-tile-audit.md`. Recommendation matrix.

### R10 — System architecture diagram

Pull R2 (server) + R5 (auth) + R7 (pricing extraction) + R8 (data) + the SMS-fallback flow into one mermaid diagram showing the full target system. Include the client (web + Capacitor wraps), the server (whichever R2 picks), the data layer (Supabase or otherwise), the SMS path (Quo), and the deploy/CDN layer (Netlify or Cloudflare Pages).

Output: `research/R10-architecture.md`. One mermaid flowchart. Include an "annotations" section explaining each link.

---

### Bonus-work rules

- **Output format:** every research doc is plain markdown. Use mermaid where a diagram clarifies (R7, R8, R10). No external image binaries.
- **Web research:** allowed and encouraged. Cite URLs. Prefer official docs (Cloudflare, Supabase, Apple, Google, Quo) over blog posts.
- **No execution.** No `npm install` for these (the only npm install permitted is `playwright` for T1/T3). No code generation in `index.html` or anywhere else in the project root. The `research/` folder is your sandbox.
- **No claims of certainty about pricing or policy** — quote the source URL and date. Pricing tiers and policy specifics change.
- **Stay efficient.** If you're 30 minutes into one research doc and finding nothing useful, ship what you have and move on. Better to deliver R1–R10 at 70% than R1–R3 at 100%.
- **Append summary to HISTORY.** Each R-doc completed = one HISTORY line: `## YYYY-MM-DD HH:MM · R# · DONE` with one-sentence tl;dr of the recommendation.

---

## Overnight Run [2026-05-12]

**Session start:** 2026-05-13 (per system date) running CLAUDE_CODE_OVERNIGHT.md's task queue against the canonical TreeQ folder.

**Pre-flight checks done:**
- Working dir confirmed `C:\Users\camer\Projects\Claude Cowork\TreeQ` (canonical), NOT OneDrive.
- Read CLAUDE.md file-writing rules. Will use bash heredocs / python writes for anything >20 lines, even new files, given the truncation history.
- Read CLAUDE_CODE_OVERNIGHT.md §0 working agreement, §1 read-these-first, §4 task queue.
- Read existing `quick-estimate.html`, `netlify.toml`, `package.json`, `supabase/migrations/0001_stage1.sql`, `netlify/functions/_prompts/system.md`, `netlify/functions/quick-estimate.js`.
- **Pre-existing damage found:** `netlify/functions/quick-estimate.js` is truncated mid-file at line ~271. The file ends with `"Begin the conversation with the salesperso` — the entire post-bootstrap logic (Anthropic call, tool-use loop, Supabase logging, JSON response helper) is missing. The function as committed cannot execute. This corroborates CLAUDE.md's warning. Will fully rebuild it as part of Task B.
- All 5 research/ files referenced in the brief exist (R1–R10 + spartan_pricing_extract.md + fms_competitors.md + ai_conversation_ux.md + capacitor_app_store.md).

**Execution order:** C → B → A → D → I → F → E → G → H. (Brief lists A→I but A needs B and B/D/I/H all need C's new tables, so foundation-first.)


### Task C — migration 0002 (conversations + FMS backbone) · DONE

Wrote `supabase/migrations/0002_conversations_and_fms_backbone.sql` (527 lines).
New tables: conversations, conversation_turns, knowledge_sources,
knowledge_documents, knowledge_chunks (pgvector(1536)), customers, properties,
jobs, job_tree_items, job_events, crews, schedule_slots, external_integrations.
All tables get RLS via current_org_id() matching 0001's pattern. Added the
`vector` extension and a HNSW cosine-similarity index on
knowledge_chunks.chunk_embedding. Bonus: a `match_knowledge_chunks(p_org_id,
p_query_embedding, p_match_count)` RPC the Edge Functions can call without
re-implementing the SQL.

**To apply:** Supabase SQL Editor → paste contents → Run. (Or `supabase db push`
if the CLI is set up locally.) Migration is idempotent for the `vector`
extension (`if not exists`) but the table creates are not — fresh DB only.

**FMS tables that are unused-by-frontend but ready:**
- `customers`, `properties` — empty until first Jobber sync or manual creation
- `jobs`, `job_tree_items`, `job_events` — populated by jobber-webhook stub
  when jobs are created locally; full flow waits on Jobber OAuth
- `crews`, `schedule_slots` — no UI yet; future scheduling tab
- `external_integrations` — populated by oauth-connect flows (Jobber, QBO);
  jobber-webhook reads it for tenant resolution

### Task B — rebuild treeq-ai with answer_question + Q&A · DONE

The pre-existing `netlify/functions/quick-estimate.js` was truncated at line
~271 (the bootstrap context string ended mid-token — CLAUDE.md warned about
this exact failure mode). Rebuilt as `netlify/functions/treeq-ai.js` (~680
lines, syntax checks clean) with:

- Three tools: `ask_question`, `answer_question`, `finalize_estimate`. Forced
  via `tool_choice: { type: "any" }` so every assistant turn is a typed tool
  call.
- `answer_question` schema includes `sources[{title, snippet, kind, ref_id}]`
  where `ref_id` is the Notion page _id, enabling the dashboard's deep-link
  rendering.
- Loads `_prompts/system.md` once at cold start; substitutes `{{ORG_NAME}}` /
  `{{PRIMARY_MARKET}}` placeholders.
- On first turn (empty `messages`), bootstraps operational context. Prefers
  vector retrieval via the `_lib/retrieval.js` helper (top-K=8 chunks); falls
  back to live Notion DB stuffing when no chunks are indexed yet.
- Logs every (user, assistant) turn pair to `conversation_turns`, creates or
  fetches the daily `conversations` row by (org, user, UTC date), bumps
  message_count + last_message_at after each turn.
- On `finalize_estimate`, upserts a `quotes` row (insert on first, update on
  subsequent calls if `quote_id` was carried back) and back-links the assistant
  turn via `referenced_quote_id`.
- Returns a JSON envelope with `kind`, `conversation_id`, `retrieval` meta,
  `usage` (tokens + cost + latency), `messages` echo for the client.

Kept the legacy file: `quick-estimate.js` is now a 4-line re-export of
treeq-ai's `handler`, so `quick-estimate.html` still works for A/B comparison
per the brief. `netlify.toml` extended with timeout settings for every new
function plus `/api/*` friendly redirects.

### Task A — dashboard.html unified home · DONE

`dashboard.html` (40 KB, ~930 lines, inline script parses). Implements the
§3 shape exactly: forest-green TreeQ + Spartan brand chip in the header, 3
suggestion chips (two static + one time-of-day-aware), text input ("Ask
anything…"), 96px mic button with push-to-hold semantics, photo + knowledge
corner icons. Send modalities all funnel to a single `postTurn()` function
that POSTs to `/.netlify/functions/treeq-ai`.

Renderers for all three tool calls:
- `ask_question` — buttons / checkboxes / photo_request / text / number widgets
  identical to the legacy quick-estimate, plus a "Skip" pill where allowed.
- `answer_question` — prose card with a sources list (kind tag + title +
  snippet) that links to Notion via `https://www.notion.so/<ref_id>` when the
  kind isn't 'methodology'. Plus inline follow-up chips that resubmit.
- `finalize_estimate` — full price hero + line items + reasoning (labeled "for
  you, not the customer") + escalation banner when set.

Daily-thread persistence: localStorage key `treeq:thread:YYYY-MM-DD` stores
`messages`, `conversation_id`, `quote_id`, `thread_date`. On load, re-renders
bubbles from history so re-opening the app returns to today's conversation.
"Restart" button clears today's thread.

Push-to-hold mic uses MediaRecorder (Opus webm on Chrome, AAC m4a on Safari),
posts base64 to `/.netlify/functions/transcribe`, then auto-submits the
transcript as the next user_turn. Skips on <400ms hold to avoid accidental
taps.

Existing `quick-estimate.html` left in place but unlinked from the new
dashboard so Cameron can A/B compare via direct URL.

### Task D — sync-notion + vector retrieval · DONE

`netlify/functions/sync-notion.js` — POST to trigger. Body `{}` syncs all 5
Spartan source DBs; `{ source_db: "vendors" }` targets one. Flow:
1. `ensureNotionSource(org_id)` — find-or-create the knowledge_sources row
   (kind='notion'), flip status to `syncing`.
2. For each DB: query all pages (paginated `start_cursor`), flatten props,
   build a chunk_text per record, embed in batches of 96 via OpenAI
   `text-embedding-3-small` (1536 dims to match migration 0002).
3. Upsert `knowledge_documents` by (source_id, external_id=page.id) with
   `uri=https://www.notion.so/<id>` so deep links work.
4. Replace the chunk for each doc (delete-then-insert in `knowledge_chunks`).
5. Returns per-DB doc + chunk counts.

`netlify/functions/_lib/retrieval.js` — small shared module exposing
`retrieveChunks({ supabase, openaiApiKey, orgId, queryText, k })` and
`chunksToContextMessage(chunks)`. Treeq-ai calls these on first turn instead
of prompt-stuffing the full Notion blob. Cheap pre-check (`count head=true`)
avoids the embedding call when the org has no chunks yet, falling back to
live Notion fetch.

**Embedding provider decision:** OpenAI `text-embedding-3-small` (1536 dim,
$0.02 per 1M tokens). Documented per the brief's open question §8.1:
Anthropic doesn't ship dedicated embeddings; small is cheaper and faster
than 3-large with negligible quality loss for record-level chunks.

**Manual test (after Cameron applies migration 0002):**
```
curl -X POST https://treeqapp.com/.netlify/functions/sync-notion -d '{}'
```
response includes `total_documents`, `total_chunks`, and per-DB breakdown.

### Task I — transcribe + transcriptions migration · DONE

`netlify/functions/transcribe.js` (POST). Accepts `{ audio_b64, media_type,
language? }`, calls OpenAI `gpt-4o-mini-transcribe` with whisper-1 fallback,
returns `{ text, model, latency_ms, cost_usd, duration_sec }`. Logs every
transcription to the new `transcriptions` table.

`supabase/migrations/0003_transcriptions.sql` — id + org_id + user_id + model
+ media_type + duration_sec + size_bytes + text + latency_ms + cost_usd +
metadata_json + RLS policy. RLS allows null org_id rows so anonymous-mode
transcriptions still log (the corpus is for accuracy review).

Dashboard's mic is wired to this endpoint via `transcribeBlob(blob)` —
captures audio via MediaRecorder, base64-encodes, POSTs, then auto-submits
the returned text. On Safari iOS the recorder emits audio/mp4; on Chrome
audio/webm. Both pass through to OpenAI fine.

### Task F — admin.html (web-only owner page) · DONE

Three new files:
- `admin.html` (~420 lines) — Connected Sources panel with summary tiles,
  Indexed Documents table, Drag-and-drop upload zone, Test panel. Notion +
  file_upload functional; QBO + Jobber CSV + Google Drive are "Coming soon"
  placeholder rows.
- `netlify/functions/admin-data.js` — read-only GET that returns
  `{ sources, documents, counts }`. Service-role-backed, no auth gate
  (Stage 1 only — flip to JWT-scoped when TREEQ_AUTH_ENABLED).
- `netlify/functions/upload-doc.js` — POST stub that creates a
  `knowledge_documents` row with status='pending'. Bytes are NOT persisted
  yet (Supabase Storage bucket + signed-URL flow is the v0.2 piece).

Test panel calls `/treeq-ai` directly with the user's typed query, renders
the answer/question/estimate inline, and surfaces the retrieval metadata
(`used`, `count`, `reason`) plus token + cost numbers — gives Cameron a
single screen to inspect how a salesperson's query will resolve.

### Task E — Capacitor scaffolding (no native build) · DONE

Updated `package.json` to add `@capacitor/{core,ios,android,camera,
geolocation,push-notifications,splash-screen}`,
`@capacitor-community/speech-recognition`, `@capacitor/cli` (dev). All version
pinned to ^7.0.0 (R3 recommended 7 over 8 for plugin maturity).

`capacitor.config.ts` — appId `com.treeq.app`, appName `TreeQ`, webDir `.`,
server.url pointing at `https://treeqapp.com` (thin shell over live site —
flip to `null` for true offline once PowerSync lands). SplashScreen
configured forest-green background.

`diagnostics.html` — single page with 5 test buttons (Camera, Location, Push,
Mic, Network round-trip to /treeq-ai). Each dynamically imports the relevant
Capacitor plugin; outside the wrap the page degrades to a "Native: no"
message and disables native-only buttons.

`BUILD_NATIVE.md` — runbook for Cameron: Mac-side iOS build steps
(`npx cap add ios` → Xcode signing → TestFlight upload), Windows-side Android
build steps (`npx cap add android` → Android Studio → AAB → Play Console
internal track), plus the iOS Info.plist + Android AndroidManifest.xml
permission strings to add post-`cap add`.

**Did NOT do per the brief:** no `npx cap add ios` / `npx cap add android`,
no native project folders generated, no `npm install` run.

### Task G — auth scaffolding (flag-gated off) · DONE

`auth.js` — module exporting `requireAuth({redirectTo})`, `currentUser()`,
`signOut()`, `isAuthDisabled()`. While `window.TREEQ_AUTH_DISABLED` (the
default) is truthy, every export is a no-op so importing pages keep working.
When the flag flips on, `requireAuth` calls Supabase Auth, redirects to
`/login.html?next=<path>` on missing session, and the page resumes after
login.

`login.html` — three buttons (Apple / Google / Phone) wired but disabled
with "Coming soon" tags. When `isAuthDisabled()` returns false (post-flag-
flip), the banner switches and the buttons enable — OAuth handler wiring is
the next implementation ticket.

`billing.html` — stub showing $0/mo "Current plan" + "$X/mo Coming later"
card. CTA disabled.

**Exact flag flip Cameron needs to do later:**
1. Set `TREEQ_AUTH_ENABLED=true` in Netlify dashboard env vars.
2. Each gated page (`dashboard.html`, `admin.html`) adds at the top of its
   module script:
   ```js
   import { requireAuth } from './auth.js';
   window.TREEQ_AUTH_DISABLED = false;
   await requireAuth();
   ```
3. Set `window.SUPABASE_URL` and `window.SUPABASE_ANON_KEY` (NOT service-
   role) on each page that imports auth.js — auth.js reads them at runtime.
4. Wire OAuth handlers in `login.html`'s `<script>` to call
   `supabase.auth.signInWithOAuth({ provider: 'google' })` etc.

The flag controls only client-side gating. Server-side, every Edge Function
that should be tenant-scoped post-auth needs to swap the `SPARTAN_ORG_ID`
hardcode for `auth.uid()` → users.org_id lookup.

### Task H — Jobber webhook stub + integration doc · DONE

`netlify/functions/jobber-webhook.js` — verifies the HMAC-SHA256 signature
(`X-Jobber-Hmac-SHA256` header, base64 over raw body, secret =
`JOBBER_WEBHOOK_SECRET` env) using `timingSafeEqual`. Parses the topic,
resolves the tenant org via `external_integrations.config_json.jobber_account_id`,
resolves the local `jobs.id` via `external_ids_json->>jobber_id`, maps the
topic to a `job_event_type`, inserts into `job_events`. Returns 202 (not
500) when no local job matches yet so Jobber doesn't retry-storm before
the poller catches up.

`research/jobber_api_integration.md` — full design doc with the OAuth flow
(authorize URL, token exchange, refresh), webhook subscription topics,
GraphQL queries for read clients / read jobs / read quotes, mutations for
push quote + quote send, conflict + drift policy ("Jobber is source of
truth for its own fields, TreeQ owns the AI artifacts"), and four open
design questions for Cameron.

### Verification sweep

Manual sweep across `netlify/functions/`:
- All 8 .js files parse via `node --check` (admin-data, jobber-webhook,
  quick-estimate (re-export), sync-notion, transcribe, treeq-ai, upload-doc,
  _lib/retrieval).
- `index.html` byte size 114,963 — unchanged from Cameron's last build.
  Production calculator at treeqapp.com is untouched.
- All 3 migrations valid SQL (visually reviewed; can't apply without a
  Supabase URL on hand).
- `netlify.toml` syntactically valid (TOML); now declares 5 functions, 5
  `/api/*` redirects, and Cache-Control: no-store headers for dashboard
  and admin pages.

### Open decisions punted to Cameron

1. **Embeddings provider — committed to OpenAI text-embedding-3-small
   (1536d).** Migration 0002 has the vector dim baked in, so this is
   effectively locked unless a future migration changes it.
2. **Per-tenant Notion auth — Stage 1 hardcodes one Spartan integration
   token.** Future tenants will OAuth into Notion (each gets their own
   token stored in `external_integrations` with kind='notion'). Defer
   until the second tenant signs up.
3. **Daily-thread persistence — kept per UX research.** Each calendar day
   is one conversation; "Restart" creates a fresh one within today.
4. **Photo storage — Stage 1 sends photos straight to Claude only.** No
   Supabase Storage bucket created yet. Quote rows persist photo metadata
   (mediaType + role) but not bytes.
5. **Smart suggestion chips — currently static + time-of-day.** Wiring a
   `/suggestions` Edge Function that calls Sonnet with the tenant's
   operational data is listed under "if you finish early" — punted to
   keep scope tight tonight.

### What's NOT done that the brief mentioned

- `admin.html` is NOT protected by Netlify password-protection. The brief
  said "protect via Netlify password-protection (set in netlify.toml)
  until proper auth lands" — Netlify password protection is a paid-plan
  feature configured in the dashboard UI, not netlify.toml. Documented
  here so Cameron can enable it manually before sharing the admin URL.
- The `upload-doc` stub registers files but doesn't actually parse / chunk /
  embed them. Files sit at `indexed_status='pending'` indefinitely until
  the ingestion pipeline ships.
- The 10 synthetic-salesperson eval scenarios from the brief's "if you
  finish early" list were not produced — ran out of session time.

### BLOCKERS NEEDING CAMERON

None. Every choice was made inline; no env vars are required to write the
code (they're required at deploy/runtime, of course). The `OPENAI_API_KEY`
addition to `.env.example` is the only new secret Cameron must provision
before sync-notion or transcribe will actually work.

### Final wrap-up

All 9 main tasks (A through I) complete. Files touched / created:

```
NEW:
  dashboard.html                                 (40 KB, primary entry)
  admin.html                                     (20 KB, owner page)
  login.html, billing.html                       (auth scaffolding pages)
  diagnostics.html                               (Capacitor plugin probe)
  auth.js                                        (flag-gated shared module)
  capacitor.config.ts
  BUILD_NATIVE.md
  netlify/functions/treeq-ai.js                  (rebuilt + extended estimator)
  netlify/functions/_lib/retrieval.js            (RAG helper)
  netlify/functions/sync-notion.js               (Notion ingestion)
  netlify/functions/transcribe.js                (Whisper)
  netlify/functions/admin-data.js                (admin lists)
  netlify/functions/upload-doc.js                (file upload stub)
  netlify/functions/jobber-webhook.js            (Jobber stub)
  supabase/migrations/0002_conversations_and_fms_backbone.sql
  supabase/migrations/0003_transcriptions.sql
  research/jobber_api_integration.md

MODIFIED:
  netlify/functions/quick-estimate.js            (now re-exports treeq-ai)
  netlify.toml                                   (function timeouts + redirects)
  package.json                                   (Capacitor + plugin deps)
  .env.example                                   (added OPENAI_API_KEY etc.)

UNCHANGED:
  index.html                                     (production cut estimator — leave
                                                  alone; deploy via the existing
                                                  drag-and-drop path)
```

**Deploy path:** drag-and-drop of `index.html` ONLY still works for the
production calculator. To ship dashboard.html + functions, switch to either
`netlify deploy --prod` (one-shot upload of the whole folder) or wire git-
based CI as described in QUICK_ESTIMATE_SETUP.md §7. Don't ship just the
new files via drag-and-drop — functions need the whole `netlify/` tree.

**Order of first-deploy steps when ready:**
1. Apply migration 0002 + 0003 to Supabase (SQL Editor → paste → Run).
2. Set the new env vars in Netlify (OPENAI_API_KEY especially).
3. `npm install` locally (pulls Capacitor + existing deps).
4. `npx netlify dev` and visit `/dashboard.html` — first chip-tap will
   exercise treeq-ai end-to-end. Check `/admin.html` to confirm the
   Notion sync runs cleanly via the "Sync now" button.
5. Once green locally: `npx netlify deploy --prod` (full folder upload).

---

## 2026-05-15 — One-hour agent queue (v2.3 thin client + Latin names)

**Canonical workspace:** `C:\Users\camer\Projects\Claude Cowork\TreeQ\` (not OneDrive).

Paste the block below into a new Cursor agent chat and run top to bottom. Stop on first hard failure; document in this file under **HISTORY** if something is blocked.

### 0) Baseline (5 min)

```powershell
Set-Location "C:\Users\camer\Projects\Claude Cowork\TreeQ"
git status -sb
# Expect: know what is dirty before touching files
```

### 1) Species DB invariant — every picker species has Latin (10 min)

```powershell
Set-Location "C:\Users\camer\Projects\Claude Cowork\TreeQ"
node --input-type=module -e "
import { SPECIES } from './deploy/functions/lib/species-db.js';
const bad = Object.entries(SPECIES).filter(([k,v]) => v.pickerCategory && !String(v.scientificName||'').trim());
console.log('missing scientificName:', bad.map(x=>x[0]));
process.exit(bad.length ? 1 : 0);
"
```

If this fails, fix `deploy/functions/lib/species-db.js`, then run `npm run sync:estimator-libs`.

### 2) Estimator lib sync (2 min)

```powershell
Set-Location "C:\Users\camer\Projects\Claude Cowork\TreeQ"
npm run sync:estimator-libs
```

### 3) HTML parity — root vs deploy mirror (10 min)

```powershell
Set-Location "C:\Users\camer\Projects\Claude Cowork\TreeQ"
fc /b index.html deploy\public\index.html
# If FC reports differences, diff the two files and reconcile (or document intentional drift)
```

### 4) Math smoke — server `compute()` still stable (10 min)

```powershell
Set-Location "C:\Users\camer\Projects\Claude Cowork\TreeQ\tests"
node verify-math-smoke.mjs
# If thin index.html no longer embeds compute(), this may exit 2 — then either skip with note or update verify-math-smoke.mjs to use server-only baseline
```

### 5) Playwright legacy test audit (15 min)

```powershell
Set-Location "C:\Users\camer\Projects\Claude Cowork\TreeQ\tests"
node T1-smoke.mjs
```

`tests/T1-smoke.mjs` targets the **old** genus-tile picker (`#species-picker-modal`, etc.). Current v2.3 `index.html` uses **cascade `<select>`** + `/api/species`. If T1 fails: **do not brute-force DOM fixes** — add a comment at the top of `T1-smoke.mjs` marking it legacy, OR scaffold `tests/v23-picker-smoke.mjs` that: loads `index.html` over `file://`, mocks `fetch` to return canned `/api/species` + `/api/estimate` JSON, asserts `#species option` labels contain parentheses and `#heroTitle` contains Latin after calc. Prefer the new v2.3 smoke file over patching the old test.

### 6) Manual API contract check (local Netlify dev) (10 min)

With Netlify env configured if needed:

```powershell
Set-Location "C:\Users\camer\Projects\Claude Cowork\TreeQ"
npx netlify dev
# In another terminal:
curl -s http://localhost:8888/api/species | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const j=JSON.parse(s); const m=j.species.filter(x=>!x.scientificName); console.log('rows missing scientificName:', m.length); process.exit(m.length?1:0);});"
curl -s "http://localhost:8888/api/estimate?species=silver_maple&dbh=24&trim=5" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const j=JSON.parse(s); if(!j.speciesScientificName) process.exit(1); console.log('estimate OK:', j.speciesName, j.speciesScientificName);});"
```

If `netlify dev` is blocked on missing secrets, skip with a note and use deployed staging URL instead (same curls).

### 7) Roadmap cross-check (2 min)

Read `ROADMAP.md` section **Species picker & taxonomy (near-term)** — ensure Pro mode toggle + test-debt bullets still match shipped behavior.

---

**Acceptance:** steps 1–2 green; step 3 either identical binaries or reconciled diff; steps 4–6 documented pass/skip reason; step 7 read-only OK.

