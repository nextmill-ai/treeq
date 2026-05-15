# Interim Sonnet 4.6 Estimator — Setup

This is the Stage 1 salesperson pricing tool that ships **alongside** the existing cut-count estimator (`index.html`). It lives at `/quick-estimate.html` and calls a Netlify Function (`/.netlify/functions/quick-estimate`).

## UX model

**Conversational, button-driven.** The page opens as a chat. Sonnet 4.6 asks short questions one at a time and renders the appropriate input each turn:

- **Buttons** — single-select bucket (work type, size bucket, location on property)
- **Checkboxes** — multi-select (access constraints, services to include)
- **Photo request** — opens phone camera directly (`capture="environment"`)
- **Text** — last-resort free text (phone keyboards have native mic / voice-to-text)
- **Number** — numeric input with unit hint

Salespeople should be able to estimate an entire job by tapping. Free-text only when nothing else fits.

The model is forced via Anthropic **tool use** to call either `ask_question` (continue conversation) or `finalize_estimate` (final price). No free-text replies — every response is a typed tool call, which makes the frontend rendering reliable.

## Files added in this pass

```
TreeQ/
├── netlify.toml                                  # Netlify config (functions + headers)
├── package.json                                  # Anthropic + Notion + Supabase SDKs
├── .env.example                                  # Env-var template
├── quick-estimate.html                           # Salesperson-facing page
├── supabase/
│   └── migrations/
│       └── 0001_stage1.sql                       # Tenant + operational mirrors + quotes
└── netlify/
    └── functions/
        ├── quick-estimate.js                     # The estimator function
        └── _prompts/
            └── system.md                         # Trade-secret system prompt
```

The existing `index.html` (cut estimator) is unchanged.

## One-time setup

### 1. Create the Supabase project

1. New Supabase project at https://supabase.com
2. SQL Editor → paste `supabase/migrations/0001_stage1.sql` → Run
3. Note the project URL (`https://xxxxx.supabase.co`) and the **service-role key** (Settings → API → `service_role` secret)
4. Get Spartan's org UUID: `select id from organizations where slug = 'spartan';`

### 2. Create a Notion integration

1. https://www.notion.so/profile/integrations → new internal integration
2. Workspace: SpartanTreeNY's Workspace HQ
3. Copy the secret token (`secret_...`)
4. Share access with the integration on all five DBs (Dump Spots, Vendors, Subcontractors, Plant Price Comparison, Materials → which gives Pickup Spots + Material Pricing). In Notion, open each DB → `•••` → Connections → invite the integration.

### 3. Get an Anthropic API key

https://console.anthropic.com → API keys → create. Note: this is a different key from the one Claude Code / Cowork uses.

### 4. Install dependencies locally

```bash
cd "C:\Users\camer\OneDrive\Documents\Claude\Projects\TreeQ"
npm install
```

### 5. Set env vars

Copy `.env.example` → `.env.local`, fill in real values. **Never commit `.env.local`.**

### 6. Test locally

```bash
npx netlify dev
```

Open http://localhost:8888/quick-estimate.html. Submit a test estimate. Check `quotes` table in Supabase for the logged row.

### 7. Deploy

**Current deploy method** (drag-and-drop `index.html`) only ships the static file. To deploy the function:

Option A — **One-shot CLI deploy** (simplest):
```bash
npx netlify deploy --prod
```

Option B — **Wire up git-based CI** (recommended long-term):
1. Push this project to a GitHub repo
2. In Netlify dashboard → Site settings → Build & deploy → link the repo
3. Set the env vars in Netlify dashboard
4. Pushes to `main` auto-deploy

In Netlify dashboard → Site settings → Environment variables, paste each variable from `.env.local` (production values).

## Verifying it works

1. Open `https://treeqapp.com/quick-estimate.html`
2. Upload a tree photo + describe the job
3. Tap **Get estimate**
4. Confirm a price renders
5. In Supabase SQL Editor: `select id, description, estimated_price, escalated, escalate_reason from quotes order by created_at desc limit 1;`

## How calibration works

Every estimate logs to `quotes` with:
- The full input (description + photo metadata + structured inputs)
- The LLM output (price + range + line items + reasoning + escalate flag)
- Token counts and cost

Later, when a salesperson sells (or doesn't sell) a job, update the row:
```sql
update quotes
set status = 'won',
    quoted_price = 1850.00,
    sold_price = 1850.00,
    job_completed_at = now(),
    actual_hours_worked = 5.5
where id = '<quote_id>';
```

When the deterministic math engine ships, it gets validated against this calibration corpus — months of real LLM estimates × actual outcomes.

## Iterating on the system prompt

`netlify/functions/_prompts/system.md` is the trade-secret pricing methodology. Edit it freely — every deploy ships the new prompt.

Watchpoints for v1 → v2:
- Replace seed labor rates ($85/$55/$65 etc.) with Cameron's real loaded crew rates
- Tune the escalation thres