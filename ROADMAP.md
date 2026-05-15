# TreeQ — Future Roadmap

> Strategic plan for evolving TreeQ from a single-file cut-time estimator into a full
> tree-job pricing platform with user profiles, saved trees, resource modeling, team
> management, and field-management integrations. Captured 2026-05-09 from a planning
> brainstorm — nothing here is shipped, none of it is committed to a release. This
> document organizes the ideas and proposes an architecture to support them.

---

## North Star

TreeQ today calculates **dismantling time** for a single tree. The product vision is to
price an entire **trade** — not just the cut. Pricing requires knowing:

1. The tree (already modeled — biomass, cuts, time)
2. **The crew** doing the work (skill, headcount, role mix)
3. **The resources** the crew has access to (cranes, lifts, trucks, attachments, mats)
4. **The site** (obstacles, structures, drag distance — partly v3 roadmap)
5. **The post-cut work** (chip volume, log loads, stump, cleanup, plant health)

The work below is what bridges (1) → (5). Until profiles + resources land, the app is
"a calculator." After they land, it becomes "a pricing engine."

---

## Phase plan (proposed ordering)

The order below assumes we want to ship value at every step rather than wait six
months for a Big Reveal. Each phase produces a usable app on its own.

| Phase | Theme | Ships |
|-------|-------|-------|
| **P1** | Favorites (no auth) | Local-storage favorites + a "Favorites" toggle on the species picker |
| **P2** | Auth foundation | Google/Apple/Facebook login, minimal profile, account settings page |
| **P3** | Tree history | Save calculation results to the user's profile + GPS stamp button |
| **P4** | Resources page | Equipment toggles + size/reach matrices, stored on the profile |
| **P5** | Team management | Employees + subcontractors, roles, proficiency-per-equipment matrix |
| **P6** | Jobber integration | Pull active employees from Jobber API, sync deactivations |
| **P7** | Pricing engine v1 | First pricing layer that consumes everything in P3–P6 |
| **P8** | Other FSM integrations | ServiceTitan, Aspire, ArboStar, etc. |
| **P9** | PHCRx integration | Plant-health pricing handoff (friend's app) |
| **P10** | Trimming model | Move beyond removal-only into trim/prune pricing |

Phases 1–3 are user-facing wins that compound. Phase 4 is the heavy lift. Phase 7 is
the moat — once we have the resource graph and team graph, pricing flows naturally.

---

## Feature specs

### F1. Favorites — quick-access species list

**Why:** Cameron uses ~6–8 species in the field repeatedly (Ashes, Maples, Conifers
dominate the Rochester market). Scrolling through 56 species is friction.

**UX:**

- Settings page: "Manage favorites" — checkbox list of all species, persists per user
- On the index page (Calculate flow): a small toggle/segmented control next to the
  Species selector with two states: **All species** | **Favorites**
- Default: All species (since favorites is empty for new users)
- If favorites list is empty, the toggle is disabled / hidden

**Data:** `favoriteSpecies: string[]` on the user profile (or in localStorage in P1).

**P1 implementation note:** ship favorites with localStorage *before* auth lands so
people can use it immediately. Migrate to server-side storage in P3 when profiles
exist; carry over local favorites on first login.

---

### F2. Save tree to profile + GPS stamp

**Why:** A tree the crew quoted last Thursday should still be in the system today
when they arrive on site. Also: GPS stamp means we can later cluster trees by
neighborhood, see which species/sizes recur in which markets, and back-fill the
calibration data.

**UX:**

- After a calculation, an unobtrusive "Save tree" button (icon + label) below the
  hero stat
- Modal or sheet: optional name/notes, optional GPS stamp button
- "GPS stamp my location" button uses `navigator.geolocation.getCurrentPosition()` —
  browser-native, free, no API needed; works on iOS Safari and Android Chrome
- Saved trees appear on a "My trees" page sortable by date / species / location
- Per the brief: cutting time is saved with the tree, but **pricing the dismantling
  is not yet the priority** — it's a milestone on the path to pricing the whole job

**Data shape (sketch):**

```
SavedTree {
  id: uuid
  userId: uuid
  createdAt: timestamp
  species: string         // species key
  dbh: number             // inches
  heightFt: number | auto
  crownFt: number | auto
  trimBucket: 0..4
  computedCuts: number
  computedSeconds: number
  notes?: string
  geo?: { lat, lng, accuracyMeters, capturedAt }
  jobId?: uuid            // future: link to a job/quote
}
```

**Privacy note:** GPS coords on a tree are technically property location data. Plan
for an option to store as "neighborhood/zip-only" rather than precise lat/lng.

---

### F3. User profiles & authentication

**Why:** required to make F2/F4/F5 useful. Each user (= tree-service operator) needs
their own resource list, team, saved trees.

**Approach:** **Don't build it ourselves.** Use a managed auth provider that supports
Google, Apple, and Facebook OAuth out of the box. Evaluation:

| Provider | OAuth-as-a-service? | Free tier (MAU) | Notes |
|---|---|---|---|
| **Supabase Auth** | Google/Apple/Facebook + 20+ others | 50,000 MAU free | Postgres included — DB + Auth in one; Cloudflare-friendly |
| **Clerk** | Google/Apple/Facebook + many | 10,000 MAU free | Best UX components out of the box; pricier above free tier |
| **Auth0 (Okta)** | Google/Apple/Facebook + many | 25,000 MAU free | Mature; pricing jumps at scale |
| **Firebase Auth** | Google/Apple/Facebook + many | Generous | Locks us closer to GCP; less neutral |
| **AWS Cognito** | Google/Apple/Facebook + many | 50,000 MAU free | Heavy DX; not recommended for solo build |
| ~~Netlify Identity~~ | — | — | Deprecated in 2024; do not use |

**Recommendation:** **Supabase** as primary, **Clerk** as runner-up.

- Supabase wins because it bundles the Postgres database we'll need anyway in P3+ for
  saved trees, resources, team, etc. One vendor instead of two. SDK works fine on
  Cloudflare Pages and on Netlify.
- Clerk wins on out-of-the-box UI components — if we want a polished sign-in flow in
  hours rather than days. We'd still need a separate DB.
- Apple Sign-In requires an Apple Developer account ($99/yr). Cameron likely already
  has one for any future iOS work; if not, it can be deferred until P3 ships.
- All three providers handle Google/Facebook/Apple via their consoles; we just paste
  client IDs.

**Account model:**

- Each TreeQ account = one tree-service company (one operator)
- Multi-user-per-company (foreman, owner, etc.) is **out of scope for P2** but the
  schema should leave room: `account_id` foreign key on every table, even if the
  first cut is one user = one account.
- Profile fields at P2: name, email, company name, market (city), default location
  (defaults the index-page location selector to their market)

**Out of scope for P2:**

- Password-based auth (we go OAuth-only at first; reduces support burden + zero
  password storage)
- Multi-tenant teams within a TreeQ account
- Email verification flows beyond what the OAuth provider handles natively

---

### F4. Resources management

This is the largest feature in the roadmap. It's also the one that makes pricing
possible. Below is the curated resource list (filtered from the Clarity Market sheet
per Cameron's edits) and the UX shape.

#### F4.1. Curated resource taxonomy

The source list (Clarity Market "Resources" tab) had 38 line items. Cameron's edits:
bundle equipment + operator into single SKUs, fold sub-attachments into their parent
machines, drop hand tools entirely, expose tonnage/reach as **toggle → checkbox
matrix** instead of separate line items, and move labor (climber/groundworker/
operator) into Team Management (F5) where it belongs.

**Powered equipment + operator bundles**

These are toggled on/off as a single unit; if toggled on, the user owns at least one.

- Mini Skid Steer + Operator (attachments assumed; not separately listed)
- Skid Steer + Operator (attachments assumed; not separately listed)
- Articulating Loader + Operator (Merlo Roto / Sennebogen / similar)
- Equipment Trailer (no operator — just an asset)
- Chipper (no operator field; the truck operator runs it)

**Tonnage / size / reach matrices**

For each of these, a top-level **toggle** ("Do you have a grapple-saw truck?"), then
a **checkbox grid** revealing what sizes the operator owns. Pricing later uses the
smallest sufficient unit.

- **Grapple-saw truck (Tree-Mek class):** Up to 29 ton · 30–59 ton · 60–110 ton · 111+ ton
- **Crane (stick crane class):** Up to 19 ton · 20–35 ton · 36–75 ton · 76+ ton
- **Bucket truck (by working height in ft):** 40–50 · 51–60 · 61–70 · 71–80 · 81–90 · 91–100
- **Spider lift (by working height in ft):** 40–50 · 51–60 · 61–70 · 71–80 · 81–90 · 91–100
  *(matrices on bucket and spider lift mirror each other — same UI component, different label)*
- **Support truck (by class):** ½ ton · ¾ ton · 1 ton

**Specialty rigging**

- Advanced Rigging (Tree Jack / GRCS) — toggle only

**Trucks (no size matrix)**

- Chipper Truck — toggle
- Log Truck — toggle

**Site protection / setup materials**

- Turf Mats — toggle (priced later by sq ft owned, or just on/off for now)
- Traffic Control — toggle (cones + flagger setup as a service line)

**Items deliberately NOT in the resource list**

These were on the Clarity sheet but Cameron pulled them:

- Chainsaw (assumed, every climber has one)
- Hand tools (assumed)
- Leaf blower (low pricing impact)
- Emergency lights / generator (low frequency, not a pricing driver)
- Crane cribbing (always carried, not a separate SKU)
- Mek Grapple-Saw-Head (lives on the grapple-saw truck, not a free-standing line)
- Skid Steer attachments — bucket grapple, root grapple, dangle grapple, mini variants — assumed bundled with their parent machine
- Tarps (per sq ft) — pulled; not a per-job pricing driver
- Traffic cones & signage (rolled into "Traffic Control" as a service line)
- Climber / Ground Worker / Equipment Operator (moved to Team Management — F5)

#### F4.2. Three resource pages

Per the brief, resources gets **three** distinct screens:

1. **Resources** — read-only summary: "Here's what your company owns." The big picture.
2. **Resource Settings** — toggle on/off + matrix selectors. Where the data is edited.
3. **Resource Advanced Settings** — proficiency matrix (which employee can run which
   piece of equipment, at what level). Joins resources × team. Lives here rather than
   on the team page because the matrix is wider on the equipment axis.

Recommended UX: a single "Resources" tab in settings with three sub-sections accessed
via tabs at the top — keeps the IA flat, since power users will bounce between them.

#### F4.3. Data shape

```
account_resources {
  account_id, resource_key, owned_bool,
  size_matrix: jsonb            // e.g., {"40_50": true, "51_60": false, ...}
}

employee_proficiency {
  account_id, employee_id, resource_key, size_key?,
  level: int                    // 1..10, parallels operator-skill slider
}
```

Treating proficiency as a number (1–10) parallels the existing operator-skill slider
on the roadmap (CONTEXT.md §"Roadmap parked for v3"). Same scale = same downstream
pricing math.

---

### F5. Team management

Lives in profile/settings. Two clearly separated lists: **Employees** and
**Subcontractors**. Same person can never be in both.

#### F5.1. Employees

Roles, with three seniority tiers each:

- **Ground crew** — junior · regular · senior
- **Foreman** — junior · regular · senior
- **Bucket operator** — junior · regular · senior
- **Aerial arborist** — junior · regular · senior  *(can both run a bucket and climb)*

Per-employee fields: name, role, seniority, hire date (optional), proficiency matrix
across resources (see F4.3), Jobber employee ID (when integration lands — F6).

#### F5.2. Subcontractors

These are companies, not people. Plus, climbers as a special case.

- **Contract climber** (an individual) — flagged with one of the four aerial-arborist
  seniority tiers
- **Crane subcontractor** — company name, contact, optional default rate
- **Log truck subcontractor** — company name, contact, optional default rate
- **Stump grinding subcontractor** — grinds only
- **Full-service stump subcontractor** — grinding + stump removal + topsoil + seed

Per the brief, subcontractor records carry a **service** (crane / log truck / stump /
full-service stump / contract climbing) rather than a single field-management role.

---

### F6. Jobber integration (first FSM integration)

**Why first:** Cameron uses Jobber, so this is the dogfood path.

**Scope:**

- OAuth into Jobber (their API uses standard OAuth 2.0)
- On connect, pull `team` (= active employees) from Jobber's "Manage Team" endpoint
- Pre-populate F5.1 with active employees (de-dupe against any manually-added rows)
- Listen for deactivation events (webhook if available, otherwise daily poll) and
  archive the employee in TreeQ — *not* hard-delete, since they may have worked on
  saved trees / quotes we don't want to orphan
- Optional: pull customer / property data later when the pricing engine consumes it

**Caveats:**

- Jobber's API rate limits are modest; cache aggressively
- Webhook subscription requires a public callback URL — easy on Cloudflare Workers
- Jobber treats subcontractors differently from employees; we should NOT pull their
  subs into F5.1 — those go into F5.2 manually (or via a separate sync flag)

**Out of scope for P6:**

- Two-way sync (we read from Jobber; we don't write back)
- Customer / property sync — saving for the pricing engine phase

---

### F7. Other future integrations

**ServiceTitan, Aspire, ArboStar, SingleOps** — same shape as Jobber: OAuth, pull
active team, mirror deactivations. Build the F6 sync as a generic "FSM adapter
interface" so subsequent integrations are configuration, not new code.

**PHCRx** — your friend's plant-health pricing app. Once both apps support shared
profile identity (or a federated handshake), TreeQ prices removal and PHCRx prices
plant care; together they cover everything except trimming.

**Trimming pricing** — the major modeling gap after removal pricing lands. Trim work
is fundamentally different math: it's about target weight removed and aesthetic
shape, not full dismantling. Deferred until removal pricing is solid.

---

## System architecture

### Where we are now

- `index.html` — single-file v1.8 served by Netlify at treeqapp.com
- `deploy/` — parked v2.3 split deployment (Cloudflare Pages frontend + Cloudflare
  Worker backend); calibration coefficients stay server-side
- No database, no auth, no per-user state

### Where we need to go

To support F1 (with sync) → F10, we need:

1. A **database** (per-user state: profile, favorites, saved trees, resources, team)
2. An **auth layer** (OAuth-backed sign-in)
3. An **API layer** (CRUD endpoints + the existing `/api/estimate`)
4. A **web client** (the existing `index.html` evolves into multi-page or a SPA)

### Recommended stack

Two viable paths. Numbered for choice:

**1. Cloudflare Pages + Workers + D1 + Supabase Auth (or Clerk).**
   - Frontend: Cloudflare Pages (already scaffolded in `deploy/`)
   - API: Cloudflare Workers (already scaffolded in `deploy/functions/api/`)
   - DB: Cloudflare D1 (SQLite) — free tier is generous
   - Auth: Supabase Auth (free tier 50k MAU) used purely for OAuth + JWT verification
   - Pros: extends parked work, single platform, low cost, calibration stays protected
   - Cons: D1 is younger than Postgres; Supabase-Auth-without-Supabase-DB is a slightly
     unusual combo

**2. Netlify + Supabase (Auth + Postgres).**
   - Frontend: stay on Netlify
   - API: Netlify Functions OR Supabase Edge Functions
   - DB: Supabase Postgres
   - Auth: Supabase Auth
   - Pros: minimum churn from current deploy, one vendor for auth + DB, mature stack
   - Cons: leaves the parked Cloudflare work on the shelf forever; calibration
     protection story is weaker (Netlify Functions don't have the same edge model)

**Recommendation:** Path 1. Reasons: (a) the parked `deploy/` Cloudflare work was
built precisely to keep calibration server-side, and that protection compounds as
the species DB grows in value; (b) D1 + Workers + Pages is one platform with one
deploy story; (c) Supabase Auth is portable — if D1 ever doesn't scale, the auth
layer doesn't need to change.

### What stays unchanged

- The math model (Chojnacky biomass + per-class cut times + absorption profiles)
- The species DB shape — it just moves from inline JS to a server-side resource
- The mobile-first UI language (forest green / cream / gold / Inter)
- The verification baselines in CONTEXT.md (Silver Maple 24″ → 64 cuts / 38.8m, etc.)

### Suggested data model (Postgres / D1, abridged)

```
accounts (id, name, market_city, created_at)
users (id, account_id, email, oauth_provider, created_at)
favorites (account_id, species_key)               -- composite PK
saved_trees (id, account_id, user_id, species_key, dbh, height_ft, crown_ft,
             trim_bucket, cuts, seconds_total, lat?, lng?, accuracy_m?, notes,
             created_at)
resources (account_id, resource_key, owned, size_matrix jsonb)  -- composite PK
employees (id, account_id, name, role, seniority, jobber_id?, active, created_at)
subcontractors (id, account_id, name, service, contact, default_rate?, created_at)
proficiency (account_id, employee_id, resource_key, size_key?, level)
fsm_connections (account_id, provider, oauth_tokens, last_sync_at)
```

The `account_id` foreign key on every per-tenant row keeps the door open for
multi-user-per-account in a future phase without a migration.

---

## Open questions / ambiguities

These came out of the brainstorm and should be settled before starting P3+:

1. **Per-account vs. per-user.** First cut is one user = one account; foreman/owner
   logging in separately is deferred. Confirm this is fine for P2.
2. **Apple Developer account.** Apple Sign-In requires it ($99/yr). Available now or
   deferred?
3. **Saved-tree GPS coordinates** — store precise lat/lng or coarse-grained
   (zip/neighborhood) to avoid keeping property-level location data on the server?
4. **Multi-market support.** The location selector in v1.8 today has NY → Rochester
   only. When a user sets their market in their profile (Boston, Charlotte, etc.),
   does that imply we need market-specific calibration coefficients, or do we ride
   on Rochester values until field data justifies a fork?
5. **Subcontractor pricing inputs.** Do we record their rates in their profile (so
   the pricing engine can pull from there) or quote per job?
6. **Crane sub-tonnage.** The Tree-Mek/stick-crane size matrix is for the operator's
   *own* crane fleet. Does the same matrix apply to subcontracted cranes (so we know
   "we can call in a 60-ton sub if we need one"), or is that just contact info?

---

## What's NOT in this roadmap (intentionally)

Per the brief, these are out of scope right now:

- Pricing the dismantling (P7 — built on top of resources/team graph, not before)
- Trimming model (P10)
- Multi-user-per-account / role-based access in the TreeQ app itself
- Public-facing customer-facing quote screens
- Mobile native apps (the PWA path covers iOS/Android well enough until we have
  paying customers asking for a native experience)

---

## Appendix A — full Clarity Market source list (for reference)

Captured here so the curated F4.1 list above can be audited against what we removed.
Prices intentionally omitted.

**Crane tier — Tree-Mek (knuckle-boom):** Up to 29 ton · 30–59 ton · 60–110 ton · 111+ ton
**Crane tier — Stick crane:** Up to 19 ton · 20–35 ton · 36–75 ton · 76+ ton
**Crane accessories:** Adv Rigging (Tree Jack / GRCS) · Crane Cribbing · Mek Grapple-Saw-Head
**Trucks:** Bucket Truck · Chipper Truck · Log Truck · Support Truck (Semi) · Support Truck (Straight)
**Heavy equipment / lifts:** Merlo Roto · Sennebogen · Spider/Man Lift · Skid Steer · Mini Skid Steer · Skid Steer Bucket/Root Grapple · Skid Steer Dangle Grapple · Mini Bucket/Root Grapple · Mini Dangle Grapple · Equipment Trailer
**Tools / small equipment:** Chainsaw · Chipper · Hand Tools · Leaf Blower · Emergency Lights/Generator
**Site materials:** Tarp (per sq ft) · Turf Mats · Traffic Cones & Signage · Traffic Control
**Labor:** Climber · Ground Worker · Equipment Operator

Source: `Clarity Market.pdf` (Resources tab), uploaded 2026-05-09.
                                                                                                                                                                                                                                                                                                           