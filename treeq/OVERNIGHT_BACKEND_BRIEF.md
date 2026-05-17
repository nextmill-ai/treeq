# TreeQ — Overnight Backend Build Brief

> Paste this entire file into a fresh Claude Code session in the canonical project root. You are running for ~8 hours unattended while Cameron sleeps. Make judgment calls inline, log decisions to `HANDOFF.md`, never block on a question.

---

## 0. Working agreement (read before any write)

- **Canonical project root:** `C:\Users\camer\Projects\Claude Cowork\TreeQ\`. Edits must target here. The Google Drive copy is read-only.
- **Read `CLAUDE.md` at the project root first.** Follow its write-safety rules. Verify large writes.
- **Production is live at `treeqapp.com` (Netlify).** Beta is `treeqbeta.netlify.app`. Never deploy to prod tonight — push to beta only when a clean checkpoint exists, and only when explicitly safe (no broken pages).
- **Never run `git push` to remote, never run `npx netlify deploy --prod`, never modify Stripe/billing config.** Beta deploys to `treeqbeta` are fine (and welcomed) after each major checkpoint.
- **Append a one-paragraph entry to `HANDOFF.md` after each completed task** under `## Overnight Run 2026-05-17`. Include what changed, what files, what was verified, and any decisions made.
- **Stack constraints you must respect:**
  - Frontend: static HTML in `treeq/` (no build step). Server preview = Netlify Dev from `treeq/`.
  - Backend: Netlify Functions in `treeq/netlify/functions/` (Node 18+, ESM, `.js` extension).
  - DB: Supabase (Postgres). Migrations in `treeq/supabase/migrations/`, numbered sequentially.
  - Auth: Supabase Auth (Google OAuth + magic link). HS256 JWT verified by `_lib/auth-guard.js`.
  - No framework. No React. No TypeScript. Vanilla JS + native browser APIs.

---

## 1. Read these before writing anything

1. `CLAUDE.md` (project root) — write-safety rules
2. `treeq/ROADMAP.md` — the long-term product vision (you are implementing P3–P5 tonight)
3. `treeq/research/R5-auth-architecture.md` — auth + multi-tenancy decisions (read §1–§6)
4. `treeq/research/R8-data-architecture.md` — entity-relationship model for the entire FMS
5. `treeq/research/fms_competitors.md` — what Jobber/SingleOps/ArborGold/ServiceTitan/HousecallPro already do well, and where TreeQ wedges in
6. `treeq/supabase/migrations/*.sql` — the existing schema. **Extend, don't rewrite.** Read all six migrations.
7. `treeq/netlify/functions/_lib/auth-guard.js` — the canonical auth pattern. **All new functions must use `requireAuth` + `resolveAccountId`.**
8. `treeq/netlify/functions/favorites.js` and `saved-trees.js` — reference implementations of the auth-guard pattern. Copy this shape.
9. `treeq/spartan_pricing_tool.html` — the Quote Builder. You will wire its `state` object to a database tonight.
10. `treeq/login.html`, `treeq/settings.html`, `treeq/dashboard.html` — existing auth UI to extend.

Skim `treeq/CONTEXT.md` for the broader project framing.

---

## 2. The problem statement (one sentence)

TreeQ's frontend is mature — calculator, quote builder, species DB, pricing engine — but the backend has the **identity + RLS scaffold only** (accounts, profiles, favorites, saved_trees, resources, team). Tonight you build the **CRM + FMS spine**: companies, users with roles + permissions, customers, properties, **saved quotes with full line-item detail**, a quote list/detail UI, and a clean separation between draft/sent/won/lost states. The Quote Builder must persist to the cloud, not just `localStorage`.

---

## 3. What "done" looks like (acceptance criteria for the whole night)

A user can:

1. Sign up via Google OAuth → automatically gets a personal `account` (already works — verify).
2. **Invite a teammate** to their company by email (a new `invitations` table + `/invite` function). The invitee signs up and lands on the same `account_id` instead of creating a new one.
3. **See their team list** in `/settings.html` and assign roles (`owner` / `admin` / `estimator` / `viewer`).
4. **Create a customer** (with name, phone, email) and a **property** for that customer (address, optional GPS).
5. **Build a quote** in `spartan_pricing_tool.html`, link it to a customer + property, and **save it** to Supabase. The full `state` object (trees, hazards, mods, all line items, computed total) round-trips losslessly.
6. **Open `quotes.html`** and see a searchable, filterable list of all quotes for their account (filter by status, customer, date range).
7. **Tap a quote** to open `quote-detail.html` — see all line items, edit notes, change status (draft → sent → won/lost), see audit trail.
8. **RLS enforced:** a user in account A cannot read/write any row from account B. Cameron will verify this in the morning by creating two test accounts.

Bonus if time permits (in order):

9. Quote PDF generation (server-side, with letterhead).
10. Customer detail page showing all quotes for that customer.
11. Soft-delete (archive) instead of hard-delete on quotes/customers.
12. CSV export of quotes.

---

## 4. Architectural decisions already made — do not relitigate

| Decision | Why |
|---|---|
| **Supabase Postgres + RLS, multi-tenant via `account_id` FK on every row.** | R5/R8. Auth + DB one vendor. RLS via `auth.uid()` joined through `profiles`. |
| **Roles are stored on `profiles.role` (text).** Values: `owner` / `admin` / `estimator` / `viewer`. `owner` is auto-assigned on account creation. | Already partially in R5 §2. Extend. |
| **Permissions are derived from role, not stored separately** (no `permissions` table tonight). Role → capability matrix lives in JS + SQL policies. | Keeps it simple for v1. Can add per-permission grants later. |
| **Quote `state` snapshot is stored as `jsonb` in `quotes.snapshot_jsonb`** AND normalized into `quote_lines` for queryability. | The Quote Builder state is rich and evolving — JSON keeps fidelity; normalized lines power reports/filters. |
| **Customer + property are separate tables** (R8 §Layer 2). One customer can own many properties. | Industry standard FSM model. |
| **Quote status is a state machine.** Enum: `draft` / `sent` / `won` / `lost` / `dead`. Transitions logged in `quote_state_changes`. | R8 §quote_state_changes. |
| **Invitations are token-based, single-use, 7-day expiry.** Token is a URL-safe random string. | Standard SaaS pattern. |
| **No emails sent tonight** — the invite flow generates a link the inviter copies and shares manually. Wire actual email (Resend / Postmark) in a later session. | Avoids credential setup + spam concerns at 3am. |
| **All new tables: `account_id uuid not null references public.accounts(id) on delete cascade` + RLS + indexed.** | Universal pattern. |
| **API style: REST, one function per resource.** GET/POST/PUT/DELETE on the same path, dispatched by `event.httpMethod`. | Matches existing `favorites.js` / `saved-trees.js`. |
| **CRM/FMS best-practice schema reference:** `customers` → `properties` → `quotes` → `quote_lines` + `quote_state_changes`, with audit columns (`created_at`, `updated_at`, `created_by_user_id`) on every operational row. | Drawn from Jobber/SingleOps/ServiceTitan teardowns in `research/fms_competitors.md`. |

---

## 5. Task queue — work in this exact order

Each task lists files to touch, a definition of done (DoD), and a verification step. **Do not start a task until the prior task's DoD is met.** If a task is blocked, log the blocker in `HANDOFF.md` and move to the next. Spend no more than 90 minutes on any single task — if stuck, simplify and document.

---

### TASK 1 — Migration 0006: Roles + Invitations

**Files:** `treeq/supabase/migrations/0006_roles_and_invitations.sql` (new)

1. Add `role` column to `public.profiles`: `text not null default 'owner' check (role in ('owner','admin','estimator','viewer'))`.
2. Create `public.invitations` table:
   ```
   id uuid pk, account_id uuid fk, email text not null, role text not null check (...),
   token text unique not null, invited_by_user_id uuid fk profiles, expires_at timestamptz,
   accepted_at timestamptz nullable, accepted_by_user_id uuid fk profiles nullable, created_at timestamptz default now()
   ```
3. RLS on `invitations`: select/insert/delete only by users in the same `account_id` with role `owner` or `admin`.
4. Update `handle_new_user()` trigger: if `raw_user_meta_data->>'invitation_token'` is present and valid + unexpired, join the existing `account_id` instead of creating a new account; mark invitation as accepted; set `role` from the invitation.
5. Add a helper SQL function `public.current_account_id()` returning the caller's `account_id` from `profiles`. Use it in RLS policies on every per-tenant table going forward.

**DoD:** Migration applies cleanly to a fresh Supabase project. `select * from public.invitations;` returns 0 rows. `select role from public.profiles limit 1;` returns `owner`.

**Verify:** Open `treeq/supabase/migrations/`, ensure file is numbered correctly, run a lint pass with eyeballs (no syntax errors, all FKs reference real tables).

---

### TASK 2 — Migration 0007: CRM core (customers, properties)

**Files:** `treeq/supabase/migrations/0007_customers_properties.sql` (new)

1. Create `public.customers` per R8 §Layer 2:
   ```
   id uuid pk, account_id uuid fk, name text not null, primary_phone text, primary_email text,
   notes text, created_by_user_id uuid fk profiles, created_at timestamptz, updated_at timestamptz
   ```
2. Create `public.properties`:
   ```
   id uuid pk, account_id uuid fk, customer_id uuid fk customers,
   address_line1 text not null, address_line2 text, city text, state text, zip text,
   lat numeric, lng numeric, notes text, created_at, updated_at
   ```
3. RLS: `using (account_id = public.current_account_id())` for select; insert/update/delete restricted to `owner`/`admin`/`estimator` (NOT `viewer`).
4. Indexes: `customers (account_id, name)`, `properties (account_id, customer_id)`, full-text on `customers.name`.
5. `updated_at` trigger (one shared helper function, applied to both tables).

**DoD:** Migration applies. Indexes exist. RLS policies enumerable.

---

### TASK 3 — Migration 0008: Quotes + quote_lines + state machine

**Files:** `treeq/supabase/migrations/0008_quotes.sql` (new)

1. Create enum `quote_status as enum ('draft','sent','won','lost','dead')` if not already in 0001 (check — 0001 has it; reuse).
2. Create `public.quotes`:
   ```
   id uuid pk, account_id uuid fk, customer_id uuid fk nullable, property_id uuid fk nullable,
   quote_number text not null,  -- per-account autoincrement, see below
   status quote_status not null default 'draft',
   total_cents int not null default 0,
   snapshot_jsonb jsonb not null,  -- full Quote Builder state
   notes text,
   created_by_user_id uuid fk profiles, created_at, updated_at,
   sent_at timestamptz nullable, won_at timestamptz nullable, lost_at timestamptz nullable
   ```
3. Create `public.quote_lines`:
   ```
   id uuid pk, quote_id uuid fk on delete cascade, account_id uuid fk,
   line_type text not null,  -- 'tree_removal' | 'tree_trim' | 'takedown' | 'stump' | 'haul' | 'land_clearing' | 'landscaping' | 'phc' | 'planting' | 'labor' | 'adjustment'
   label text not null, detail text, amount_cents int not null, sort_order smallint,
   created_at
   ```
4. Create `public.quote_state_changes` per R8 §quote_state_changes.
5. **Per-account quote numbering:** Add `accounts.next_quote_number int not null default 1`. On insert into `quotes`, a `before insert` trigger sets `quote_number` from `accounts.next_quote_number` and increments it atomically.
6. RLS: same pattern as customers/properties. Quote `viewer` = select only. `estimator` = full CRUD on own-account quotes. `admin`/`owner` = same plus delete.
7. Indexes: `quotes (account_id, status, created_at desc)`, `quotes (account_id, customer_id)`, `quote_lines (quote_id, sort_order)`.

**DoD:** Migration applies. A handwritten test insert via Supabase SQL editor (or in your verification script) creates a quote with `quote_number = 1`, second insert = `2`.

---

### TASK 4 — Auth-guard extensions

**Files:** `treeq/netlify/functions/_lib/auth-guard.js` (extend)

1. Add `resolveProfile(supabase, userId)` — returns `{ id, account_id, role, full_name }`. Cache in-memory per warm function instance.
2. Add `requireRole(profile, allowedRoles)` — returns `{ err }` if role not in list, else `{}`.
3. Add `ok(data)` shorthand → `json(200, data)`.

**DoD:** Existing functions (`favorites.js`, `saved-trees.js`) still pass their existing tests. New helpers exported and importable.

---

### TASK 5 — Function: `invitations.js`

**Files:** `treeq/netlify/functions/invitations.js` (new)

Endpoints:
- `GET /.netlify/functions/invitations` — list pending invitations for caller's account (admin/owner only)
- `POST /.netlify/functions/invitations` `{ email, role }` — create invitation, return `{ token, invite_url }`. Invite URL = `https://treeqapp.com/login.html?invite=<token>`.
- `DELETE /.netlify/functions/invitations?id=<uuid>` — revoke
- `GET /.netlify/functions/invitations/lookup?token=<token>` — public, no auth; returns `{ account_name, role, email, expires_at }` so login UI can show "You're being invited to join X". 404 if invalid/expired.

Token generation: `crypto.randomBytes(24).toString('base64url')`.

**DoD:** Run via Netlify Dev locally. `curl` an invite create → returns token + URL. Lookup returns expected metadata. Revoke deletes the row.

---

### TASK 6 — Function: `team.js` (extend if it exists, else create)

**Files:** `treeq/netlify/functions/team.js`

Endpoints:
- `GET /.netlify/functions/team` — list all profiles in caller's account, with role + email + created_at. Any role can read.
- `PATCH /.netlify/functions/team?id=<profile_id>` `{ role }` — change a teammate's role. Only `owner` can promote/demote. Cannot demote the last `owner` (enforce in SQL via trigger OR in function code with a count check).
- `DELETE /.netlify/functions/team?id=<profile_id>` — remove a teammate from the account. **Do not delete `auth.users`.** Set `account_id` to a new orphan account so they keep their identity but lose access. Only `owner` can remove. Cannot remove self if last owner.

**DoD:** Live tested: owner creates an invite, second test user accepts, owner sees them in `GET /team`, owner promotes them to `admin`, owner removes them. All RLS-correct.

---

### TASK 7 — Function: `customers.js`

**Files:** `treeq/netlify/functions/customers.js` (new)

Endpoints:
- `GET /.netlify/functions/customers` — list, optional `?q=<search>` (full-text on name), `?limit` `?offset`. Returns `{ customers, total }`.
- `GET /.netlify/functions/customers?id=<uuid>` — single customer with their properties array.
- `POST /.netlify/functions/customers` — create.
- `PATCH /.netlify/functions/customers?id=<uuid>` — update.
- `DELETE /.netlify/functions/customers?id=<uuid>` — soft delete (add `archived_at` column in this task's migration if not present).

`estimator` and above can CRUD; `viewer` is read-only.

**DoD:** Locally tested via curl: create, list, search, update, archive.

---

### TASK 8 — Function: `properties.js`

**Files:** `treeq/netlify/functions/properties.js` (new)

Endpoints:
- `GET /.netlify/functions/properties?customer_id=<uuid>` — list customer's properties.
- `POST /.netlify/functions/properties` `{ customer_id, address_line1, ... }` — create.
- `PATCH /.netlify/functions/properties?id=<uuid>` — update.
- `DELETE /.netlify/functions/properties?id=<uuid>` — archive.

**DoD:** Same as customers.

---

### TASK 9 — Function: `quotes.js`

**Files:** `treeq/netlify/functions/quotes.js` (new)

Endpoints:
- `GET /.netlify/functions/quotes` — list with filters `?status` `?customer_id` `?q=<search>` `?from=<date>` `?to=<date>` `?limit` `?offset`. Returns `{ quotes, total }`. Includes joined `customer_name`, `property_address` for the list view.
- `GET /.netlify/functions/quotes?id=<uuid>` — single quote with full `snapshot_jsonb`, all `quote_lines`, all `quote_state_changes`, and joined customer/property.
- `POST /.netlify/functions/quotes` `{ customer_id?, property_id?, snapshot_jsonb, lines: [...], total_cents, notes? }` — create as `draft`.
- `PATCH /.netlify/functions/quotes?id=<uuid>` — update any field. Recomputes `total_cents` from lines server-side as a safety check.
- `POST /.netlify/functions/quotes/transition` `{ id, to_status, notes? }` — state machine transition. Writes a `quote_state_changes` row, sets the matching timestamp (`sent_at`, `won_at`, `lost_at`). Validates legal transitions: `draft → sent`, `sent → won|lost|dead`, anything → `draft` only by `owner`/`admin`.
- `DELETE /.netlify/functions/quotes?id=<uuid>` — archive (soft delete). Only `owner`/`admin`.

**DoD:** Curl test: create a quote with 3 lines, list shows it with customer name, transition to `sent`, GET single returns state change row.

---

### TASK 10 — Frontend: `auth-client.js` shared module

**Files:** `treeq/assets/auth-client.js` (new, or place in `treeq/scripts/` if that's the convention — check `treeq/login.html` for the existing pattern)

A single tiny ES module that:
1. Initializes the Supabase JS client from env-injected anon key.
2. Exposes `getSession()`, `getToken()`, `signOut()`, `requireSession(redirectTo)` — the last redirects to `login.html` if no session.
3. Exposes `apiFetch(path, opts)` — fetch wrapper that auto-adds `Authorization: Bearer <jwt>` and `Content-Type: application/json`.
4. Exposes `getProfile()` — caches the user's `{ account_id, role, full_name, email }` in `sessionStorage`.

**DoD:** Every other frontend file in the rest of this brief imports from here. No copy-pasted auth code anywhere else.

---

### TASK 11 — UI: `settings.html` extension (team + invitations)

**Files:** `treeq/settings.html` (extend)

Add a "Team" section:
1. Lists current teammates (name, email, role, joined date). Role displayed as a `<select>` if caller is `owner`; otherwise read-only text.
2. "Invite teammate" form: email + role select. On submit, calls `POST /invitations`, displays the generated link in a copyable text field with a "Copy link" button. Don't auto-send email — show "Send this link to your teammate" instruction.
3. Pending invitations list with revoke button.

Visual style: match existing `settings.html` (forest green + cream + Inter, mobile-first).

**DoD:** A second browser profile clicking the invite link can sign up and land on the same account.

---

### TASK 12 — UI: `customers.html`

**Files:** `treeq/customers.html` (new)

A list view (mobile-first):
1. Search box at top (debounced 300ms, calls `?q=`).
2. List of customers, each row shows name, primary_phone, # of properties, # of open quotes.
3. Tap a row → `customer-detail.html?id=<uuid>`.
4. FAB `+` opens a "New customer" modal: name (req), phone, email, notes.

**DoD:** Create 3 customers, search works, tap drills into detail.

---

### TASK 13 — UI: `customer-detail.html`

**Files:** `treeq/customer-detail.html` (new)

1. Header: customer name + edit button.
2. Properties section: list, with "Add property" inline form.
3. Quotes section: list of all quotes for this customer (status pill + total + date). Tap → `quote-detail.html?id=<uuid>`.
4. "New quote for this customer" button → opens `spartan_pricing_tool.html?customer_id=<uuid>&property_id=<uuid>` so the Quote Builder knows which customer it's quoting.

**DoD:** Page renders cleanly. Add a property. Quote list shows quotes filtered to this customer.

---

### TASK 14 — UI: `quotes.html` (list)

**Files:** `treeq/quotes.html` (new)

1. Filter bar: status pills (all / draft / sent / won / lost), customer dropdown, date range.
2. Search box (queries customer name OR quote number OR address).
3. Table/list: quote#, customer, property short address, status pill, total, date. Tap → detail.
4. "New quote" FAB → blank Quote Builder.

**DoD:** Filters compose correctly. Pagination works (50 per page).

---

### TASK 15 — UI: `quote-detail.html`

**Files:** `treeq/quote-detail.html` (new)

1. Header: quote # + status pill + total.
2. Customer + property block (clickable to their detail page).
3. Line items table (read-only render of `quote_lines`).
4. Notes (editable, autosaved on blur).
5. State transition buttons: Send (draft→sent), Won (sent→won), Lost (sent→lost), Reopen (any→draft for owner/admin).
6. "Open in Builder" button → loads `snapshot_jsonb` into `spartan_pricing_tool.html?quote_id=<uuid>` for editing.
7. State change history (audit trail).

**DoD:** State transitions land in DB. History reflects them.

---

### TASK 16 — Wire `spartan_pricing_tool.html` to the cloud

**Files:** `treeq/spartan_pricing_tool.html` (extend the `saveQuote`/`loadQuote` you added earlier)

1. Replace `localStorage` persistence with a cloud-first model:
   - If URL has `?quote_id=<uuid>`, load that quote via `GET /quotes?id=`. Populate `state` + DOM.
   - If URL has `?customer_id=<uuid>&property_id=<uuid>` and no quote_id, this is a new quote — store those IDs in state.
   - Autosave debounced 1500ms: `POST /quotes` (if new) or `PATCH /quotes?id=` (if existing). Server returns the quote `id`; replace URL via `history.replaceState` so reloads keep the quote.
2. Add a header bar showing: linked customer (name) + property (address) + "Change customer" button (opens a picker modal calling `/customers?q=`).
3. Add a `Save & Send` button: PATCH the quote, then `POST /quotes/transition { to_status: 'sent' }`, then redirect to `quote-detail.html`.
4. Keep `localStorage` as a fallback for **unauthenticated** users (the existing tool still works without login).
5. Build the `lines` array sent to the server by walking `computeQuoteLines()` output and mapping each line into the `quote_lines` row shape.

**DoD:** Build a quote while signed in → it appears in `/quotes.html` within 2 seconds without manual save. Reload preserves state. Sign out and reload → falls back to localStorage.

---

### TASK 17 — Dashboard rollup

**Files:** `treeq/dashboard.html` (extend)

Add four small cards at the top:
1. Quotes this month (count + sum) — `GET /quotes?from=...&status=sent,won`
2. Open quotes (count) — `?status=draft,sent`
3. Won this month (count + sum) — `?status=won&from=...`
4. Customers (count) — from `/customers`

Below: "Recent quotes" — last 10. "Recent customers" — last 5.

**DoD:** Cards render with real numbers from the DB.

---

### TASK 18 — Verification + HANDOFF write-up

1. **End-to-end smoke test** documented in `treeq/tests/OVERNIGHT_SMOKE.md`:
   - Create a second test Google account in a private window
   - Run through the full flow: sign up → owner creates customer → owner creates property → owner builds quote → owner sends to "customer" (mock — just transitions to sent) → second account is invited → invite link works → admin role correctly cannot demote the owner → quotes from account A invisible to account B.
2. **Update `HANDOFF.md`** with a section per completed task, listing files changed, key decisions, anything broken or deferred.
3. **Update `treeq/ROADMAP.md`** to mark P3 (saved trees) — already partially done — and P5 (team management) phase boxes as ✅ Stage 1 complete. Don't claim P4 (resources) done unless you actually shipped it.

---

## 6. CRM/FMS best practices to lean on

Drawn from the research already in the repo (R8, fms_competitors). You don't need to re-research these; just respect them.

- **Soft delete > hard delete.** Customers, properties, quotes — `archived_at timestamptz`, not `DELETE`. Quotes a homeowner accepts then disputes are evidence; never throw away.
- **Audit columns on every operational row.** `created_at`, `updated_at`, `created_by_user_id`. We add these on tables we own. We do NOT add them on reference data (species, vocab tables).
- **Per-tenant numbering.** Customers in account A see quote #1, #2, #3 — not global UUIDs. UUIDs are the PK, but `quote_number` is the human-visible identifier per-account.
- **State machines have audit tables.** Every quote status change is a row. Never overwrite a `status` field without writing the history.
- **Tenant scoping via RLS, not application code.** If a function forgets to add `.eq('account_id', ...)`, RLS still blocks the read. Defense in depth.
- **Use `current_account_id()` SQL function in policies** — single source of truth for the tenant scope. Don't inline the join.
- **Indexes on (account_id, frequent_filter, sort_column).** Every list query starts with `account_id`; the leading index column must be `account_id`.
- **JSON snapshot + normalized lines.** Store the full Quote Builder state as `jsonb` (rich, evolving shape) AND normalize line items into a flat table (queryable). Reconcile on every save.
- **One vendor for auth + DB.** Supabase. No JWT-introspection bridge between systems.
- **Roles, not permissions, at this stage.** A capability matrix in JS + SQL is enough until users ask for "share quote with just one teammate" — then you add `quote_collaborators`.
- **Customer + Property + Quote is the canonical FSM triple.** Don't shortcut to `quote.address text`. Even if 80% of quotes will be tied to a customer with one property, model it correctly day one — migrating later is hell.
- **Migrations are append-only.** Never edit a shipped migration. New file, new number.
- **API contracts in the function header comments.** Future Claude reads those comments first.

---

## 7. What NOT to do tonight

- Don't touch the math model (`spartan_pricing_extract.md`-derived pricing rules). Pricing logic stays in the frontend.
- Don't migrate the existing single-file `index.html` (Advanced Billing) to multi-page or React. Leave it.
- Don't add Stripe / billing flows.
- Don't add email sending — invitations return a copyable link.
- Don't add SMS — that's a separate spec (`SMS_FALLBACK_SPEC.md`).
- Don't deploy to prod (`treeqapp.com`). Beta is fine after each checkpoint.
- Don't modify `species-db.js`, the species reference table, or anything that affects calibration.
- Don't add a CRDT, offline sync, or PowerSync tonight — single-source-of-truth Supabase is fine for v1.
- Don't create a `permissions` table. Roles are sufficient for the cardinality of features we have.
- Don't relitigate Supabase vs Clerk vs Auth0. Supabase is decided.

---

## 8. If you get stuck or confused

1. **Read the relevant `research/R*.md` doc.** Almost every architectural question has been answered there.
2. **Look at the existing pattern.** `favorites.js` + `saved-trees.js` for functions. `settings.html` for UI. Existing migrations for SQL style.
3. **Make a decision and document it.** The cost of stopping for clarification is higher than the cost of being slightly wrong. Cameron will course-correct in the morning.
4. **If a task takes >90 minutes, simplify and document the cut.** Better to ship 14 of 18 tasks cleanly than 6 of 18 perfectly.
5. **Never destructive ops without explicit log entry.** `drop table`, `delete from`, `git reset --hard` — none of these tonight without writing to `HANDOFF.md` first.

---

## 9. Final morning report

When you're done (or out of time), write a **TL;DR section** at the top of `HANDOFF.md`:

```
## Morning Report — 2026-05-17

**Status:** [X of 18 tasks complete]
**Deployed to beta:** [yes/no, with treeqbeta URL]
**Migrations applied:** [list]
**Schema diagrams up to date:** [yes/no]
**Smoke test passed:** [yes/no, link to results]

**What works end-to-end now:**
- [bullet list]

**Known issues / things to verify in the morning:**
- [bullet list]

**Decisions I made without you:**
- [bullet list with brief rationale]

**Recommended next session:**
- [3 highest-value follow-ups]
```

Then stop. Don't keep iterating. Better to leave a clean checkpoint than a half-finished 19th task.

Good luck. See you in the morning.
