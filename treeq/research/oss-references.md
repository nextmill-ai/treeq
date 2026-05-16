# TreeQ — Open-source references

Curated GitHub repos and docs worth borrowing from. **Not** a fork list — TreeQ’s Spartan pricing, server-side methodology, and vanilla JS + Netlify stack stay proprietary.

*Compiled 2026-05-15. Re-search with `gh` when auth is configured (`winget install GitHub.cli`).*

---

## Summary

There is almost no OSS “tree service FSM + AI estimator.” Incumbents (Jobber, SingleOps, ArboStar) are closed. Useful OSS falls into: **multi-tenant Supabase**, **Capacitor auth/offline**, **Jobber integration**, **RAG + citations**, **field-service UX patterns**, and **urban tree inventory** (GPS/species/DBH — not commercial pricing).

---

## Tier 1 — Adopt patterns (high alignment)

### Multi-tenant Supabase

| Resource | Use for TreeQ |
|----------|----------------|
| [0Itsuki0/SupabaseMultiTenancyTemplate](https://github.com/0Itsuki0/SupabaseMultiTenancyTemplate) | Org/member model, RLS, Stripe webhooks |
| [Tenlyr/multi-tenant-starter](https://github.com/Tenlyr/multi-tenant-starter) | Tenant context at the DB boundary |
| [dikshantrajput/supabase-multi-tenancy](https://github.com/dikshantrajput/supabase-multi-tenancy) | Workspace isolation + auth hooks |
| [Supabase: RAG with permissions](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/ai/rag-with-permissions.mdx) | pgvector + RLS so retrieval cannot cross tenants |

### Capacitor — auth & offline

| Resource | Use for TreeQ |
|----------|----------------|
| [Cap-go/capacitor-supabase](https://github.com/Cap-go/capacitor-supabase) | Native OAuth (PKCE/cookie issues in WKWebView) — see `research/R5-auth-architecture.md` |
| [powersync-ja/powersync-js](https://github.com/powersync-ja/powersync-js) | Offline SQLite sync (v0.2) — see `CLAUDE_CODE_OVERNIGHT.md` |
| [marceljuenemann/rxdb-supabase](https://github.com/marceljuenemann/rxdb-supabase) | Lighter offline-first alternative |

### Jobber side-car (ROADMAP P6)

| Resource | Use for TreeQ |
|----------|----------------|
| [GetJobber/Jobber-AppTemplate-RailsAPI](https://github.com/GetJobber/Jobber-AppTemplate-RailsAPI) | Official OAuth + GraphQL (MIT) |
| [GetJobber/Jobber-AppTemplate-React](https://github.com/GetJobber/Jobber-AppTemplate-React) | Companion UI / OAuth flow |
| [tainora/jobber-python-client](https://github.com/tainora/jobber-python-client) | PKCE, token refresh (scripting/imports) |

### AI + grounded citations

| Resource | Use for TreeQ |
|----------|----------------|
| [anthropics/claude-cookbooks](https://github.com/anthropics/claude-cookbooks) (`misc/using_citations.ipynb`) | Native citations API |
| [ShenSeanChen/launch-rag](https://github.com/ShenSeanChen/launch-rag) | Supabase pgvector + Anthropic + sources |
| [michael-eng-ai/rag-knowledge-base-pipeline](https://github.com/michael-eng-ai/rag-knowledge-base-pipeline) | Ingestion, hybrid search, citation validation |

---

## Tier 2 — Reference only (different framework)

Vanilla JS + Netlify — **do not fork** these wholesale; steal data models and UX ideas.

| Repo | Notes |
|------|--------|
| [ph0en1x29/FT](https://github.com/ph0en1x29/FT) (FieldPro) | React + Supabase + PWA: jobs, photos, signatures, PDFs |
| [ddm2024/streamline](https://github.com/ddm2024/streamline) | Next 15 + Supabase — scheduling/CRM shape |
| [byronwade/Thorbis](https://github.com/byronwade/Thorbis) | Large home-services FSM; ERD inspiration only |

---

## Tier 3 — Tree domain (inventory & science)

| Repo | Notes |
|------|--------|
| [OpenTreeMap/otm-core](https://github.com/OpenTreeMap/otm-core) | GPS tree inventory, species, DBH, photos — **P3 saved trees** |
| [OpenTreeMap/otm-ecoservice](https://github.com/OpenTreeMap/otm-ecoservice) | Ecosystem benefits from species + diameter (municipal, not removal pricing) |
| [ropensci/allodb](https://github.com/ropensci/allodb) | Biomass from DBH (R) — sanity-check models, not Spartan rules |
| [tree-removal-cost-estimator/treeremovalcostestimator](https://github.com/tree-removal-cost-estimator/treeremovalcostestimator) | Consumer calculator — competitive lens only |

---

## Tier 4 — Paywall scaffolding (future)

When `PAYWALL_ENABLED` is true — adapt Stripe patterns, not the front-end stack:

| Repo | Notes |
|------|--------|
| [scosman/CMSaasStarter](https://github.com/scosman/CMSaasStarter) | SvelteKit + Supabase + Stripe |
| [KolbySisk/next-supabase-stripe-starter](https://github.com/KolbySisk/next-supabase-stripe-starter) | Next + shadcn + subscriptions |

---

## Official SDKs (bookmark)

- [anthropics/anthropic-sdk-typescript](https://github.com/anthropics/anthropic-sdk-typescript) — Netlify Functions
- [supabase/supabase](https://github.com/supabase/supabase) — `examples/` for auth, edge functions, AI
- [ionic-team/capacitor](https://github.com/ionic-team/capacitor) + [@capacitor-community/speech-recognition](https://github.com/capacitor-community/speech-recognition)
- [stripe-samples](https://github.com/stripe-samples) — billing when ready
- [microsoft/playwright](https://github.com/microsoft/playwright) — `tests/`

---

## Skip / low value

| Search / topic | Why |
|----------------|-----|
| `tree service estimate` on GitHub | Mostly noise; no serious arborist OSS |
| `netlify functions anthropic` | Few tiny demos; TreeQ pattern (`treeq-ai.js`, `_prompts/system.md`) is sufficient |
| Full FSM clones | Conflicts with “side-car to Jobber” + static client |
| Consumer removal calculators | Wrong economics vs Spartan labor/hazard rules |

**TreeBidPro** (AI tree estimating, Supabase) appears in case studies but not as a substantial public repo — product research only.

---

## Suggested priorities

| When | Action |
|------|--------|
| **Now** | RLS templates + Supabase RAG-with-permissions before hardening migrations |
| **P3** | `otm-core` tree-record schema (GPS, species, photos, history) |
| **P6** | Jobber app templates — OAuth spike only |
| **v0.2** | PowerSync examples + tenant sync rules |
| **AI chat** | Claude citations cookbook + small ingest function |

---

## Related internal docs

- `ROADMAP.md` — phases (Jobber, saved trees, pricing engine)
- `research/fms_competitors.md` — incumbent FMS landscape
- `research/R5-auth-architecture.md` — Capacitor + Supabase auth
- `CLAUDE_CODE_OVERNIGHT.md` — PowerSync, voice, citations requirements
- `.cursor/rules/treeq.mdc` — methodology stays server-side
