# Deploying TreeQ (Cloudflare Pages — **beta / staging**, Netlify — **production**)

**Release flow:** **`https://treeqapp.pages.dev`** (this `deploy/` bundle on Cloudflare Pages) is **where we beta-test** before production. **`https://treeqapp.com`** (Netlify, repo root **`netlify.toml`**, **`publish = "."`**) gets the same **`master`** timeline after beta looks good — use Netlify previews or promote when ready.

**What lives where:**
- **Cloudflare beta:** Thin **`public/index.html`** (mirror of repo root **`/index.html`**) plus Pages Functions (**`/api/species`**, **`/api/estimate`**, gated **`/api/*`**).
- **Netlify prod:** Full static app (**`dashboard.html`**, **`admin.html`**, …), same **`/api/species`** + **`/api/estimate`** via Netlify Functions, plus treeq-ai, sync, etc.

**Calibration source of truth:** **`deploy/functions/lib/species-db.js`** and **`deploy/functions/lib/math.js`**. Copies for Netlify live under **`netlify/functions/_lib/estimator/`** — refresh with **`npm run sync:estimator-libs`** when you edit the deploy-side originals.

Beta URL notes: **`/api/species`** and **`/api/estimate`** are public anonymously; other **`/api/*`** routes require Supabase Bearer auth per **`functions/_middleware.js`**. Cloudflare Access is optional for a private smoke-test audience.

---

## What's in this folder
```
deploy/
├── public/
│   └── index.html            # Frontend — UI only, no math, no species DB
├── functions/
│   ├── api/
│   │   ├── species.js        # GET /api/species   → {key, name, group} list
│   │   └── estimate.js       # GET /api/estimate  → cut counts, time, etc.
│   └── lib/
│       ├── species-db.js     # SERVER ONLY — coefficients, calibration
│       └── math.js           # SERVER ONLY — compute(), biomass, cuts
├── wrangler.toml             # Cloudflare Pages config (project name: treeqapp)
├── package.json              # `npm run dev` and `npm run deploy`
├── .gitignore
└── DEPLOY.md                 # This file
```

`functions/lib/` is **never** routed by Cloudflare Pages — only files
exporting `onRequest*` handlers become URLs. The IP-bearing files
(species-db.js, math.js) are private code that only the API endpoints
can import.

---

## Required environment variables (production)

Set these in the Cloudflare dashboard for your Pages project (**Settings →
Environment variables**) or via Wrangler secrets / vars as appropriate:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL (e.g. `https://xxxx.supabase.co`). |
| `SUPABASE_ANON_KEY` | Supabase **anon** public key. Required for the browser client **and** for server-side token checks: `functions/lib/auth.js` calls `GET /auth/v1/user` with `Authorization: Bearer <user_jwt>` and `apikey: <anon>`, so verification works with **any** Supabase signing algorithm (no local JWT secret). |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only). Use for privileged Supabase operations in Pages Functions (e.g. future saved-trees); never expose to the client. |

Do **not** set `SUPABASE_JWT_SECRET` for Cloudflare auth — HS256 local verify is obsolete once the project uses asymmetric JWT signing.

The thin client can set `window.__TREEQ_API_BASE__` before scripts run if the API
is hosted on a different origin than the static HTML.

---

## One-time setup

### 1. Sign up for Cloudflare (free tier)

Go to <https://dash.cloudflare.com/sign-up> and create an account. The free
tier is enough for this project — Cloudflare Pages and Workers both have
generous free quotas (Pages: unlimited requests; Workers: 100k requests/day).

### 2. Install Node.js (if you don't have it)

You need Node 18 or later. Check by opening PowerShell and running
`node --version`. If missing, install from <https://nodejs.org/> (pick the LTS
version).

### 3. Install dependencies

In PowerShell, navigate to this folder:

```powershell
cd "C:\Users\camer\Projects\Claude Cowork\TreeQ\deploy"
npm install
```

This installs Wrangler (Cloudflare's CLI) locally to this project.

### 4. Log into Cloudflare from the CLI

```powershell
npx wrangler login
```

A browser window opens; approve the access. This stores a token on your
machine so future `wrangler` commands work.

---

## Local development (test before deploy)

```powershell
npm run dev
```

This starts a local server at <http://localhost:8788> that runs both the
static site AND the API endpoints exactly the way Cloudflare will run them in
production. Open that URL on your phone (use your computer's local IP if
your phone is on the same Wi-Fi) and verify the estimator works end-to-end.

If you change a file in `public/` or `functions/`, the local server auto-reloads.

---

## First deploy

```powershell
npm run deploy
```

Wrangler will:
1. Create the Pages project on first run (you may be prompted to confirm the
   project name `treeqapp`).
2. Upload `public/` and `functions/`.
3. Print a URL like `https://treeqapp.pages.dev` — that's your
   live site.

At this point the URL is **publicly accessible.** Lock it down before
sharing.

---

## Locking it down with Cloudflare Access

This is the IP-protection layer: only people whose emails you list can even
reach the page (everyone else gets a sign-in screen).

1. Go to <https://one.dash.cloudflare.com/> (Zero Trust dashboard).
   - First time you visit you'll be asked to create a Zero Trust team. Pick
     a team name like `spartan-tree`. The free plan covers up to 50 users.
2. In the left sidebar: **Access → Applications → Add an application**.
3. Choose **Self-hosted**.
4. **Application name:** `TreeQ`
5. **Application domain:** enter `treeqapp.pages.dev`
   (or your custom domain if you've added one).
6. Leave **Path** blank to gate the entire site.
7. Click **Next**, then **Add a policy**.
8. **Policy name:** `Owners`. **Action:** `Allow`.
9. Under **Configure rules**:
   - **Selector:** `Emails`
   - **Value:** `cameron@spartantreeny.com` (and add `cameronemiller3@gmail.com`
     as a second selector if you want the personal Google account to work too)
10. Click **Next**, then **Next** through the remaining defaults, then **Add
    application**.

Now load the URL in a private/incognito browser window — you should get a
Cloudflare sign-in screen asking to verify your email. Approve and the
estimator loads.

Anyone not on the allow-list can't even see the HTML.

---

## Adding a custom domain (optional)

If you want a `cuts.spartantreeny.com` style URL instead of
`*.pages.dev`:

1. In the Cloudflare dashboard, go to **Pages → treeqapp → Custom
   domains → Set up a custom domain**.
2. Enter the domain. Cloudflare walks you through adding a CNAME record at
   your domain registrar.
3. Once propagated, update the Cloudflare Access application above to use
   the new domain.

---

## Updating after first deploy

Just run `npm run deploy` again. Each push gets its own preview URL plus
updates the production URL. Old deploys stay accessible for rollback.

---

## What's protected vs not

**Protected** (lives in `functions/lib/`, never sent to browser):

- The 56-species database with biomass coefficients, moisture factors,
  height curves, crown curves, brushFrac, foliageFrac
- The brush-handling profile assignments per species
- The math engine: greenWeightLbs, autoHeightFt, compute, etc.
- Cut-time rules table

**Visible to anyone who reaches the page** (and gets past Access gate):

- The UI shell (HTML, CSS)
- The species names + group categories (these are public knowledge; e.g.
  "Silver Maple" is a real tree everyone can name)
- The ID quiz decision tree (it references species keys but no calibration)
- The shape of API requests and responses (someone could reproduce *the
  interface* but not *the math*)

The calibration is what took the time and field experience. That's what's
locked away server-side.

---

## Troubleshooting

**"Cannot find module" errors during deploy.** Make sure you ran `npm install`
in this folder.

**API returns 404 in local dev but works on prod.** Make sure you started the
dev server with `npm run dev` (which uses `wrangler pages dev public`), not a
plain static server like `python -m http.server`.

**Cloudflare Access page shows but you can't sign in.** Make sure your email
matches the policy *exactly* (lowercase, full domain). You can edit the
policy at any time from the Zero Trust dashboard.

**Need to rotate access.** Edit the policy in Zero Trust and remove/add
emails. Changes take effect immediately for new sign-ins.
