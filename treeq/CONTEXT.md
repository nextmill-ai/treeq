# TreeQ — Project Context (formerly Spartan Aerial Cut Estimator)

> Two parallel artifacts live in this folder:
>   1. **`index.html`** — single-file v1.8 (formerly `cut_estimator.html`; renamed so Netlify serves it at the root). Mobile-first, light theme, embedded calibration. Useful as offline reference and for fast iteration.
>   2. **`deploy/`** — v2.3 split deployment. Frontend on Cloudflare Pages, math + species DB on a Cloudflare Worker. Calibration values never reach the browser. Gated by Cloudflare Access.

Both versions are kept byte-identical in their numerical output. They diverge only in *where* the math runs.

## Production hosting (current)

Live at **treeqapp.com**. Hosted on Netlify (project name `treeqapp`,
team "Next Million"). DNS is Netlify's (Namecheap nameservers point to
dns1-4.p01.nsone.net). www → apex redirect is configured.

The currently-deployed bundle is the single-file `index.html`
(v1.8 as of this ticket; renamed from `cut_estimator.html` so the root
URL resolves without a `_redirects` file). Future deploys: drag the
updated `index.html` onto the Netlify project's Deploys page.

The `deploy/` Cloudflare-Pages-with-Access plan in `deploy/DEPLOY.md`
is **parked** — preserved for a future migration if/when IP protection
of the calibration becomes a priority. Right now the full species DB
and math ship inside the single-file bundle.

## v1.8 single-file (index.html)

- ~1850 lines, ~68 KB
- Light theme: forest `#2d5a3d` on cream `#f4f8f1`, gold `#e9c466` accents, Inter typeface
- Mobile-first layout (max 480px frame): sticky top bar, hero stat grid, sectioned input cards, tree profile, cut breakdown table, cut rules
- Inputs: location selector (NY → Rochester scaffold), species dropdown with optgroups, DBH slider (1″ steps, 6–48″ default with **Over-48″ checkbox** that extends to 49–90″), height stepper + Auto reset, crown stepper + Auto reset (with helper text *"Trunk to farthest branch tip, measured from ground"*), trim segmented control (5 buckets, default 0–10%)
- Quiz modal slides up bottom-sheet style with 19-node decision tree
- All calibration data and math live inline

**Purpose:** offline-capable reference and rapid iteration sandbox.

## v2.3 split deployment (deploy/) — parked

```
deploy/
├── public/
│   └── index.html            # Frontend — UI only, no math, no species DB
├── functions/
│   ├── api/
│   │   ├── species.js        # GET /api/species   → public list
│   │   └── estimate.js       # GET /api/estimate  → server-computed result
│   └── lib/
│       ├── species-db.js     # SERVER ONLY — coefficients, calibration, absorption profiles
│       └── math.js           # SERVER ONLY — compute(), biomass, cuts
├── wrangler.toml
├── package.json
├── .gitignore
└── DEPLOY.md                 # Step-by-step deploy guide
```

**What's protected** (server-only):

- 56-species DB: biomass coefficients, specific gravity, moisture factor, brushFrac, foliageFrac, height curves, crown curves, brush handling profile, diameter group, absorption profile
- BRUSH_SEC_PER_CUT (per diameter class, not per handling profile)
- LOG_SEC_PER_CUT (2/3/4 minute scale)
- BRUSH_DIAM_DIST table
- ABSORB_PROFILES table (three tiers: hardwood / soft_branch / lead_only)
- Math engine: greenWeightLbs, autoHeightFt, autoCrownRadiusFt, cutsFromMass, logCuts, splitLogMassByClass, compute

**What's in the public bundle** (visible to anyone past the Access gate):

- UI HTML and CSS
- Species names and group categories (public knowledge)
- ID quiz decision tree (only references species keys, no calibration)
- Render logic and the API request/response shapes

## Math model

- **Biomass:** Chojnacky 2014 (USDA-FS), `ln(kg) = b0 + b1·ln(DBH_cm)`, times species-specific moisture factor
- **Heights:** open-grown urban Chapman-Richards form, calibrated to Rochester (24″ silver maple = 66 ft, 24″ red oak = 73 ft)
- **Crown radius:** linear `(intercept + slope · DBH) / 2`, calibrated to Rochester (24″ silver maple = 30 ft)
- **Brush vs log split:** 12″ diameter cutoff
- **Brush cuts:** woody brush mass (foliage stripped) → mass distribution by class (frac_lt4 / frac_4to8 / frac_8to12) → **absorption applied** (smaller-class mass reduced by profile-specific fraction since smaller wood comes down with larger limb cuts) → 15-ft sections × fork multiplier
- **Log cuts:** 8-ft sections, split into 12–18″ / 18–24″ / 24″+ classes (DBH-based heuristic: ≤18 all 12-18″, 18-24 split 40/60, >24 split 30/35/35)

## Cut time rules (v1.6+ — per-class, not per-handling-profile)

Per-class brush times (15-ft sections):
- Brush <4″ — **20 sec/cut**
- Brush 4–8″ — **30 sec/cut**
- Brush 8–12″ — **60 sec/cut**

Per-class log times (8-ft sections):
- Log 12–18″ — **2 min/cut** (120 sec)
- Log 18–24″ — **3 min/cut** (180 sec)
- Log 24″+ — **4 min/cut** (240 sec)

Handling profile (`spreading` / `wide` / `upright` / `conifer`) is still on each species as a descriptive label and is shown in the Tree Profile section, but **no longer drives cut time**. Field is kept in case it's needed for a future model.

## Absorption profiles (v1.7+)

Three patterns describing how smaller-diameter brush comes down with larger cuts. Mass is still tracked (for chip volume etc.) — only the cut COUNT is reduced.

- **`hardwood`** (default — all 48 hardwoods): `lt4: 0.65, 4to8: 0.50`. Hierarchical branching: a 10″ limb carries many subbranches that come down with one cut.
- **`soft_branch`** (pine, spruce, hemlock — 7 species): `lt4: 0.90, 4to8: 0.75`. Every branch can be cut whole at the trunk; almost all smaller wood comes down with that branch cut.
- **`lead_only`** (arborvitae — 1 species; future cedars/redwoods get this profile): `lt4: 0.97, 4to8: 0.92`. Only primary or secondary leads need cuts; the rest comes off with the leads.

**To add new conifer species** (e.g., redwood when needed): set `absorbProfile: 'soft_branch'` (most conifers) or `'lead_only'` (cedars/arborvitae/redwoods). Without this field, a new conifer would default to hardwood absorption and over-count cuts.

## Pre-existing trim

5 buckets (0-10/10-20/20-30/30-40/40-50%, midpoint applied: 5/15/25/35/45). Reduces BOTH brush AND log mass proportionally (since trim can include lead removal).

## Verification baseline (24″ trees, 5% trim — v1.8 / v2.3, math unchanged from v1.7)

| Species         | Cuts | Time   | Profile   |
|-----------------|------|--------|-----------|
| Silver Maple    | 64   | 38.8m  | spreading |
| Red Oak         | 41   | 34.7m  | wide      |
| Butternut       | 88   | 56.5m  | wide      |
| White Pine      | 43   | 25.8m  | conifer   |
| Norway Spruce   | 35   | 21.3m  | conifer   |
| Blue Spruce     | 34   | 21.0m  | conifer   |
| Hemlock         | 33   | 22.3m  | conifer   |
| Arborvitae      | 14   | 14.2m  | conifer   |

(Both v1.8 single-file and v2.3 deploy frontend produce identical numbers.)

## Personas / context

- **Cameron Miller** — owner of Spartan Tree & Landscape (Fairport NY) and Next Million (productized consulting for tree service operators, nextmillion.co)
- This tool will eventually plug into a pricing engine on Next Million
- Recommended deploy: Cloudflare Pages with Cloudflare Access gate (free tier on both)
- Brand identity: forest green `#2d5a3d`, gold `#e9c466`, cream `#f4f8f1`

## Calibration history

- v1.0 → v1.5: heights bumped up significantly (24″ silver maple was 51 → now 66, 24″ red oak was 53 → now 73). Crown radii bumped (24″ silver maple was ~22 ft → now 30 ft). Foliage exclusion added. Per-species cut times added by handling profile. Boxelder confirmed wide-spreading. Trim reduces both brush AND log mass.
- v1.6 / v2.1: **Per-class cut times** (20/30/60s for brush, 2/3/4 min for logs) replace per-handling-profile times. **Branch absorption** introduced to avoid double-counting smaller wood that comes down with larger cuts.
- v1.7 / v2.2: **Three absorption profiles** (hardwood / soft_branch / lead_only) replace single hardwood-vs-conifer split. Conifers properly modeled: pines/spruces/hemlock get one cut per branch at the trunk, arborvitae gets cuts only at primary/secondary leads. Conifer cut counts dropped from ~237 to ~43 for 24″ white pine; arborvitae from many to 14 cuts at 24″.
- v1.8 / v2.3: **TreeQ rebrand**. Hero hidden until Calculate button pressed (below trim card). Once revealed, hero is sticky-to-top until the Tree Profile section. Species categories reordered by Cameron's removal frequency for residential Rochester work; alphabetical within each. Math unchanged.

## Known model weak points

1. **Butternut** numbers run high (88 cuts at 24″) — uses walnut biomass but butternut SG is lower; needs species-specific tuning
2. **Boxelder** 24″ should be field-verified
3. Some species use generic "general hardwood" biomass equation (β₀=−2.2118, β₁=2.4133): elm, sycamore, tulip poplar, basswood, willow, mulberry, magnolia, catalpa, hackberry, ginkgo, cherries, pears, apples
4. **Operator skill scale** is locked at 10/10 — not yet exposed in UI. Roadmap item.
5. **"Over structures"** exception isn't modeled — Cameron noted this is when conifer branch-at-trunk cuts don't apply. Will be solved with v3 obstacle/structure-overlap multipliers.
6. **Pines = spruces** in current absorption model. If field tests show pines should land at different cut counts, split into `soft_branch_dense` (spruce/hemlock) and `soft_branch_sparse` (pine).

## Roadmap parked for v3

- Obstacle/structure-overlap multipliers (3× small brush over structure, 4× medium, 6× large/log) — also handles the conifer "over structures" exception
- Lead-structure drawing tool (user draws where 3 codominant leads point so multipliers apply only to overlapping portions)
- Operator skill 1–10 slider exposed in UI (with a scaling table like 3.5× at skill 1 down to 1.0× at skill 10)
- Chipper size selector (12″ vs 18″) affecting brush/log split threshold
- Yards of chips + log loads output (cylinder-stacking math with air-gap correction)
- Logistics: drag-out time, chipping time, dump trailer/log truck capacity
- Pricing engine on top of all of the above

## Workflow

This project uses a **Cowork → Claude Code** handoff pattern. Cowork is for planning, discussing tradeoffs, mobile previews, and figuring out what to do. Claude Code is for executing code changes.

- See `HANDOFF.md` for the dispatch ticket template + worked example.
- When a task crystallizes in Cowork, fill out the **CURRENT TICKET** section in HANDOFF.md.
- In Claude Code: `read HANDOFF.md and execute the current ticket`.
- After it lands, the ticket gets moved to **HISTORY** and CONTEXT.md gets refreshed (else this file drifts out of sync — the lesson from May 2026).
