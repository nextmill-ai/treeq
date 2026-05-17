# TreeQ — Laptop Setup

Everything you need to continue TreeQ work from your laptop. ~10 min to bootstrap.

## 1. Get the project files

The canonical path on your desktop is:
```
C:\Users\camer\Projects\Claude Cowork\TreeQ\
```

There are three ways the laptop can have the same files:

**(a) Google Drive sync (easiest, recommended)** — the project also lives at:
```
G:\My Drive (cameron@spartantreeny.com)\Olympus Holdings\Claude Cowork\TreeQ\
```
If Google Drive Desktop is installed and signed in on the laptop, everything auto-syncs. Edits you make here will sync to the desktop and vice versa. **Note:** Drive sync has had truncation issues with large files in the past — per `CLAUDE.md`, the safer pattern is to do edits via shell heredoc/Python rather than direct file writes for files >20 lines.

**(b) Manual copy** — drag the whole `TreeQ` folder to a USB drive or network share, then place at `C:\Users\camer\Projects\Claude Cowork\TreeQ\` on the laptop.

**(c) Set up git** — not currently in place, but if you want full version control:
```bash
cd "C:\Users\camer\Projects\Claude Cowork\TreeQ"
git init
git add .
git commit -m "checkpoint 2026-05-17"
gh repo create treeq --private --source=. --push
```
Then `git clone` on the laptop.

---

## 2. Install tools

All free, all CLI. From PowerShell on the laptop:

```powershell
# Node.js 20 LTS  (required for Netlify Functions + npm)
winget install OpenJS.NodeJS.LTS

# Python 3 (used by patch scripts under treeq/scripts/)
winget install Python.Python.3.12

# Git (only needed if you set up option (c) above)
winget install Git.Git

# Supabase CLI
scoop install supabase
# OR
npm install -g supabase

# Netlify CLI (used for local dev + deploy previews)
npm install -g netlify-cli

# GitHub CLI (optional — for option (c))
winget install GitHub.cli
```

Verify:
```powershell
node --version    # >= 20
python --version  # >= 3.11
supabase --version
netlify --version
```

---

## 3. Authenticate the CLIs

```powershell
# Supabase: opens a browser, log in with the same Google account
supabase login

# Netlify: same
netlify login
```

Confirm the project is linked:
```powershell
cd "C:\Users\camer\Projects\Claude Cowork\TreeQ\treeq"
supabase link --project-ref bhbubaopejjxijiqmujy
netlify link    # pick the existing site, do NOT create a new one
```

When `netlify status` shows `Current site: treeqapp` and `Site Id: fb34fb16-9604-4482-809c-9d874eff404c`, you're good.

---

## 4. Project deps

```powershell
cd "C:\Users\camer\Projects\Claude Cowork\TreeQ\treeq"
npm install
```

This installs `@supabase/supabase-js` and other deps used by the Netlify Functions.

---

## 5. Local dev — run the app

From `treeq/`:
```powershell
netlify dev
```

This serves the whole `treeq/` folder at **http://localhost:8888** and runs the Netlify Functions locally (against the live Supabase). All API routes (`/.netlify/functions/customers`, etc.) work.

Open browser → `http://localhost:8888/login.html` to start.

**If `netlify dev` fails to start** because port 8888 is taken:
```powershell
netlify dev --port 8889
```

**Stop the server:** `Ctrl+C` in the terminal.

---

## 6. Deploy

Three deploy targets:

```powershell
# Local-only draft URL (preview, doesn't update the public beta site)
netlify deploy --site=treeqbeta --message "what changed"

# Promote to public beta (https://treeqbeta.netlify.app)
netlify deploy --site=treeqbeta --prod --message "what changed"

# Production (https://treeqapp.com) — NEVER without explicit confirmation
# Don't run this. Cameron will do it manually when ready.
```

The first form prints a `Website draft URL` you can open and test. Only flip to `--prod` after you've verified the draft.

---

## 7. Apply Supabase migrations

If you add new migrations under `treeq/supabase/migrations/`:

```powershell
cd "C:\Users\camer\Projects\Claude Cowork\TreeQ\treeq"

# See what's local vs what's applied on the remote
supabase migration list

# Push everything pending
supabase db push

# Or apply a single SQL file directly (bypasses migration tracking)
supabase db query --linked --file supabase/migrations/0009_xxx.sql

# Mark a manually-applied migration as applied in the tracking table
supabase migration repair --status applied 0009
```

Already-applied (as of 2026-05-17): `0001 0002 0003 0004 0006 0007 0008 20260514120000`.
Deferred / not applied: `0005_resources_team.sql` (collides with legacy `subcontractors` table — see `HANDOFF.md`).

---

## 8. Useful project paths

| Path | What |
|---|---|
| `treeq/quote-builder.html` | the Quote Builder (was `spartan_pricing_tool.html`) |
| `treeq/advanced-removal.html` | the dismantling-time calculator (was `index.html` content) |
| `treeq/index.html` | smart auth router — `/` → `/login.html` or `/dashboard.html` |
| `treeq/login.html` | Google OAuth + magic link + invitation flow |
| `treeq/dashboard.html` | home page with rollup cards + AI chat |
| `treeq/customers.html`, `customer-detail.html` | CRM |
| `treeq/quotes.html`, `quote-detail.html` | quote list + detail |
| `treeq/settings.html` | profile + team mgmt + favorites + role mgmt |
| `treeq/assets/auth-client.js` | shared `window.TQAuth` helper |
| `treeq/assets/bottom-nav.js` | bottom tab bar injector |
| `treeq/netlify/functions/*.js` | API endpoints |
| `treeq/netlify/functions/_lib/auth-guard.js` | JWT/session validation, role helpers |
| `treeq/supabase/migrations/*.sql` | DB schema |
| `treeq/scripts/*.py` | idempotent file patchers (settings, dashboard, pricing tool) |
| `treeq/OVERNIGHT_BACKEND_BRIEF.md` | the original brief for this build |
| `treeq/HANDOFF.md` | running log of decisions + state |
| `treeq/tests/OVERNIGHT_SMOKE.md` | manual end-to-end test plan |
| `CLAUDE.md` (project root) | mandatory rules — read first on every session |

---

## 9. Continuing a Claude Code session on the laptop

Open Claude Code, navigate to the project, and paste this primer:

```
Read CLAUDE.md and treeq/HANDOFF.md first. The current state is:
- All overnight CRM tasks 1–17 complete; migrations applied to Supabase.
- Beta deploys live at https://treeqbeta.netlify.app.
- Recent UI work: bottom nav, ADV button, URL rename to /quote-builder.html,
  auth gate at /, header unification across pages.

I'm continuing work from where I left off this morning. Don't push to prod.
Only deploy to treeqbeta (no --prod flag for draft URLs).
```

Claude Code will pick up where it left off.

---

## 10. Common gotchas

- **Truncation on large file writes:** Always use `python3 -c "..."` or heredoc (`cat > FILE <<'XEOF' ... XEOF`) for big files. Per `CLAUDE.md`, never use the `Edit` tool for >20-line changes.
- **Netlify Functions ESM:** `treeq/netlify/functions/*.js` use ESM imports. The deploy build emits a warning about `import.meta` in `treeq-ai.js` — that's a known issue and currently harmless.
- **Supabase JWT secret:** Not set in beta env. `requireAuth()` in `_lib/auth-guard.js` falls back to `supabase.auth.getUser(token)` automatically.
- **Quote Builder cloud-bar:** Only appears when signed in. Anonymous users still get `localStorage` fallback.
- **CRM tables are prefixed `crm_*`** to avoid collision with legacy `customers/properties/quotes/subcontractors` (used by the AI estimator path). Don't merge namespaces without writing a migration plan.

---

Questions or stuck? The `HANDOFF.md` morning report at the top of the file has the full decision log + known issues.
