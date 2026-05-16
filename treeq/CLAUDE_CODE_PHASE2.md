# TreeQ — Claude Code Phase 2 Brief

**Paste the kickoff message at the end of this file into a fresh Claude Code session.** This brief picks up where `CLAUDE_CODE_OVERNIGHT.md`'s Overnight Run [2026-05-12] left off — all 9 of those tasks (A–I) are complete. This phase is deploy + verify + light extension.

---

## 0. Working agreement (read before any write)

- **Canonical project root:** `C:\Users\camer\Projects\Claude Cowork\TreeQ\`. Never write to the OneDrive copy at `C:\Users\camer\OneDrive\Documents\Claude\Projects\TreeQ\` — that folder is deprecated, contains only a redirect CLAUDE.md, and OneDrive sync there has been the source of past truncation incidents.
- **Read `CLAUDE.md` at project root before any write.** It defines the file-writing rules (bash heredocs / python writes for anything >5 lines, never use Edit/Write for big files in this folder, verify after every non-trivial write with `wc -l`+`tail` or `./verify_edit.sh PATH [EXPECTED_LINES]`).
- **The workbook (`Spartan_Pricing_Reference.xlsx`) was cleaned 2026-05-12.** Source-of-truth pricing rules are:
  - Limb-as-Tree threshold = **8"** at the union (not 6").
  - Bucket Truck has NO bundled-minimum rule — its 2-hr minimum applies only to its own line item.
  - Multiplier stacking order: base → hazard×work_portion + non_work_items → percent multipliers chained (poison ivy × leave-all × no-small-cleanup) → dollar subtractions (leave-half-load, leave-full-load) → Priority Scheduling 25% LAST.
  - The production system prompt at `netlify/functions/_prompts/system.md` already encodes all of these. Do NOT regress them.
- **There is a separate slimmed prompt at `office-staff-pricing-assistant-prompt.md`** for an office-staff workbook-driven assistant (different product from the live TreeQ AI). It was tested against 3 Worked Examples and produces correct quotes. Don't edit unless explicitly asked.
- **Make decisions inline. Document them in `HANDOFF.md` under `## Phase 2 Run [YYYY-MM-DD]` as you go.** Cameron is interactive but may not be looking — assume he's not. Don't text him.

## 1. Read these first

In order:

1. `HANDOFF.md` — read the entire **Overnight Run [2026-05-12]** section (lines ~474–776). That's the full record of what was built last night and any flagged TODOs. The Final wrap-up has the deploy steps.
2. `CLAUDE_CODE_OVERNIGHT.md` — task definitions (A–I) for context on what each new file does. Architectural decisions in §2 still apply.
3. `netlify/functions/treeq-ai.js` — the rebuilt Edge Function. Confirm it parses (`node -c netlify/functions/treeq-ai.js`).
4. `netlify/functions/_prompts/system.md` — the production system prompt. Used by treeq-ai.js.
5. `supabase/migrations/0002_conversations_and_fms_backbone.sql` + `0003_transcriptions.sql` — schema extensions that need to apply against Cameron's Supabase project.
6. `dashboard.html` and `admin.html` — the new front-end pages.

## 2. Phase 2 task queue (work in order, document blockers)

### TASK J — Local build sanity check

Verify the overnight build doesn't have obvious breakage before any deploy attempt.

1. `npm install` from the canonical project root. Note any peer-dep warnings or install errors in HANDOFF.md.
2. `node -c netlify/functions/treeq-ai.js` and the same for every other `.js` file under `netlify/functions/`. Fix any syntax errors immediately (these would be artifacts of overnight truncation — verify file size matches what `HANDOFF.md` says it should be).
3. `node -c auth.js`.
4. Open each `.html` file (`dashboard.html`, `admin.html`, `login.html`, `billing.html`, `diagnostics.html`) and tail -50 it to confirm the closing `</body></html>` is present and not truncated.
5. Read the head of each Supabase migration and confirm it ends with the expected statement (no mid-statement cutoff).

**Definition of done:** every `.js` parses, every `.html` ends cleanly, every `.sql` is intact. Document file sizes in HANDOFF.md so future sessions can detect regressions.

### TASK K — Migration prep (Cameron applies, you verify)

The two new migrations (`0002` and `0003`) need to land in Cameron's Supabase project, but **Cameron does this step in the Supabase web SQL editor — do not attempt API calls to Supabase from this session.**

Your job:

1. Read both migrations end-to-end. Confirm they reference only objects defined in 0001 or in themselves (no broken FKs).
2. Generate a `MIGRATIONS_TO_APPLY.md` at project root that lists, for each migration:
   - Filename and one-paragraph summary of what it does
   - Any prerequisites (e.g., "needs the `vector` extension — included in the migration itself")
   - Acceptance check: a `SELECT` query Cameron can run after applying to confirm it worked (e.g., `SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='conversations';` should return 1)
3. Append a note to HANDOFF.md that this file is ready for Cameron.

**Definition of done:** `MIGRATIONS_TO_APPLY.md` exists, each migration has a self-contained section, and the acceptance checks are syntactically valid SQL.

### TASK L — Environment variable final pass

`.env.example` got updated overnight. Reconcile it against what `treeq-ai.js`, `transcribe.js`, `sync-notion.js`, `admin-data.js`, `upload-doc.js`, and `jobber-webhook.js` actually require.

1. `grep -rn "process.env\." netlify/functions/` and list every distinct env var name.
2. Compare against `.env.example`. Any name in code but not in example → add to example with a placeholder + comment. Any name in example but not in code → flag in HANDOFF.md (maybe leftover from removed features).
3. Update `.env.example` if needed.

**Definition of done:** every env var referenced by any function is documented in `.env.example` with a one-line comment explaining what it's for and where to get it.

### TASK M — Local dev smoke test

Run `npx netlify dev` from canonical. **Don't deploy to prod yet.** Goals:

1. Confirm the dev server starts without errors.
2. Visit `http://localhost:8888/dashboard.html`. Confirm it renders (no blank page, no console errors in the dev-server output).
3. POST a test request to `http://localhost:8888/.netlify/functions/treeq-ai` with the body `{"user_turn":"What's our chipper repair vendor?","messages":[]}`. Confirm it returns either an `answer_question` tool call or a documented error (auth, missing API key, etc.) — not a 500 with a stack trace.
4. If the function 500s with a real bug (not a missing env var), document the bug in HANDOFF.md and try the obvious fix. Do NOT spend more than 30 minutes total on this task — if the smoke test exposes deeper issues, stop and document them for Cameron's awareness.

**Definition of done:** either (a) treeq-ai responds successfully to a Q&A turn locally, or (b) HANDOFF.md has a clear "Smoke test failed because X; needs Cameron to do Y" entry.

### TASK N — Pre-deploy review of `netlify.toml` and redirects

The overnight run modified `netlify.toml` for the new functions. Confirm:

1. The function paths match what's actually in `netlify/functions/`.
2. Function timeouts are reasonable (treeq-ai needs >15s for Anthropic + retrieval; default is 10s — confirm overnight set it correctly).
3. Any redirects don't accidentally route old `/quick-estimate` calls to dead endpoints (overnight noted `quick-estimate.js` is now a re-export of `treeq-ai` — confirm the file actually does that and the redirect works).

**Definition of done:** `netlify.toml` is correct for the function layout; redirects are non-circular and route to live endpoints.

### TASK O — Slimmed office-staff prompt review

The file `office-staff-pricing-assistant-prompt.md` is a NEW deliverable — a 104-line prompt for an office-staff pricing assistant that defers to the workbook for all numeric rules. It is separate from the production TreeQ AI system prompt and should NOT be deployed via Netlify (it's for a Claude Project / Custom GPT context).

1. Read the prompt end-to-end. Confirm it correctly references the workbook's 8" threshold, the new multiplier order with Priority Scheduling last, and the no-bucket-truck-bundled-min rule.
2. Add a one-line note at the top of the file noting it was validated against Worked Examples 3, 8, and 9 on 2026-05-12 — those produce the workbook's expected quotes ($614, $3,720, $13,078) when the prompt's rules are followed.
3. Do NOT make substantive edits unless you find a contradiction with the workbook.

**Definition of done:** the prompt's validation provenance is captured in its header. No changes to substance.

### TASK P — Final HANDOFF wrap-up + readiness summary

Append to HANDOFF.md a **Phase 2 Final wrap-up** with:

1. Summary of each task's outcome (J–O).
2. Updated NEW / MODIFIED file list since the Overnight Run wrap-up.
3. The exact next step Cameron should take when he reads this (e.g., "Apply migrations per MIGRATIONS_TO_APPLY.md, then run `npx netlify deploy --prod`").
4. Anything still unverified / risky that Cameron should know.

**Definition of done:** Cameron can pick up HANDOFF.md cold and know exactly what's deploy-ready and what isn't.

## 3. Out of scope for this phase (DON'T do these)

- Don't deploy to production. Local dev verification only — Cameron flips the deploy switch when he wakes up to find this finished.
- Don't apply Supabase migrations. Cameron does that in the web SQL editor manually.
- Don't set Netlify env vars. Same — Cameron does this in the Netlify dashboard.
- Don't touch the workbook (`Spartan_Pricing_Reference.xlsx`). It was cleaned 2026-05-12. Read it if you need a rule; don't edit.
- Don't touch the production `index.html` — that's the live cut estimator. Untouched is correct.
- Don't try to delete the OneDrive copy. OneDrive sync is restoring it. Cameron will handle that separately.

## 4. Contact

Cameron Miller — 585-501-6111 — cameron@spartantreeny.com. Don't text. Document in HANDOFF.md.

Go.

---

## KICKOFF MESSAGE (paste into fresh Claude Code session)

```
Confirm your working directory is C:\Users\camer\Projects\Claude Cowork\TreeQ — NOT the OneDrive copy. If you're in OneDrive or in C:\Users\camer (home), stop and switch.

Then read these in this order before any write:
1. CLAUDE.md (file-writing rules — shell writes for >5 lines, verify with wc -l + tail after non-trivial writes)
2. CLAUDE_CODE_PHASE2.md (this session's full brief — working agreement, task queue J through P, definition of done for each)

Follow CLAUDE_CODE_PHASE2.md exactly. Decisions inline, document them in HANDOFF.md under "## Phase 2 Run [2026-05-13]" as you go. Cameron is interactive but assume he's not watching — don't pause to confirm, don't text.

Begin at Task J. Stop only when all six tasks (J–P) are complete or you hit a documented blocker.
```
