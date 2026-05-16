# R2 — Server Architecture for SMS-1

> Where does the SMS webhook handler + pricing engine actually run?
> Decision input for `SMS_FALLBACK_SPEC.md` §2 and the SMS-1 ticket.
> Prepared 2026-05-10 overnight session #2.

---

## TL;DR

**Recommendation: Option A — activate the parked `deploy/` Cloudflare Pages + Worker stack.**

The SMS-fallback flow is the trigger that turns the parked v2.3 deploy into the real one, exactly as the SMS spec already anticipates. Picking A keeps the pricing engine on the same edge as the SMS handler (no extra network hop), reuses the math extraction that's already done in `deploy/functions/lib/math.js`, and preserves the IP-protection story (`functions/lib/` files are never routed by Pages, so calibration coefficients never reach the wire).

If Cameron decides differently:
- **Option B (standalone tiny worker):** ship faster, defer the v2.3 cutover, but pay forever in duplicate-pricing-engine maintenance or a self-fetch hop.
- **Option C (Supabase Edge Functions):** harmonizes the SMS server with Supabase Auth (R5) and Supabase DB if Cameron commits to Supabase for everything, but commits architecture before R5 lands and forces a Deno port of `math.js`.

---

## What's already built (Option A baseline)

`deploy/` (parked) contents that are SMS-ready:

| File | Status | What it provides for SMS |
|---|---|---|
| `wrangler.toml` | Exists, `compatibility_date = "2026-05-01"` | Pages project config, name `spartan-cut-estimator` (the SMS-1 ticket can rename or just inherit) |
| `functions/api/estimate.js` | Exists | Reference for Worker handler shape (`onRequestGet({request})` returning `Response`). SMS handler will be `functions/api/sms/inbound.js` with `onRequestPost`. |
| `functions/api/species.js` | Exists | Same pattern — public list endpoint. |
| `functions/lib/math.js` | Exists | **The pricing engine. Server-only.** Already wraps `compute()`, `greenWeightLbs`, `cutsFromMass`, etc. Re-imported by SMS handler. |
| `functions/lib/species-db.js` | Exists | All 56-species coefficients. Server-only. |
| `package.json` | Exists | `npm run dev` (wrangler pages dev) + `npm run deploy` (wrangler pages deploy). |
| `DEPLOY.md` | Exists | Step-by-step deploy + Cloudflare Access lockdown. |

What's NOT built yet for SMS-1 (regardless of which option):
- `functions/api/sms/inbound.js` — Quo webhook handler (HMAC verify, parse, dispatch)
- `functions/api/sms/confirm.js` — `YES`/`SAVE` handler
- `functions/lib/packet.js` — TQ packet encode/decode (also needed client-side as a mirror)
- `functions/lib/species-codes.js` — 3-char ↔ full species map
- `functions/lib/quo-client.js` — Quo API wrapper (auth + send-sms)
- A persistence layer for `sms_quotes` (Workers KV, D1, or external)

---

## Three options, full comparison

### A. Activate parked `deploy/` v2.3 (Cloudflare Pages + Worker)

| Dimension | Detail |
|---|---|
| Cold start | V8 isolates — effectively 0ms. Critical for Quo's 3-second webhook timeout. |
| Cost (free tier) | **100,000 requests/day** = ~3M/month. ([Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)) |
| Cost (paid) | **$5/month** = 10M requests/month + 30M CPU-ms. ([same](https://developers.cloudflare.com/workers/platform/pricing/)) |
| Cost @ 100/mo | $0 |
| Cost @ 1k/mo | $0 |
| Cost @ 10k/mo | $0 |
| IP protection | **Strong.** `functions/lib/*.js` are never routed; only `functions/api/*.js` files become URLs. Calibration coefficients live behind the import boundary. Already designed for this in `deploy/DEPLOY.md` §"What's protected vs not". |
| DX | Wrangler CLI, native Node-shaped JS modules, current `deploy/` already shaped this way. SMS-1 ticket is mostly *new files* not migration. |
| Vendor lock-in | Cloudflare Pages + Workers. Migration cost is moderate — a Worker handler is plain JS w/ a Web `Request`/`Response` API, portable to Deno/AWS Lambda with a thin shim. |
| Vendor strength | Cloudflare is well-funded, Workers has been GA for years, no signals of platform retraction. |
| What's blocked | Cameron needs Cloudflare account (free tier OK), `wrangler login`, then `npm install && npm run deploy`. DEPLOY.md covers this. |

### B. Standalone tiny worker just for SMS

| Dimension | Detail |
|---|---|
| Cold start | Same as A (V8 isolates) — 0ms. |
| Cost | Same as A. |
| IP protection | **Weakest of the three.** SMS worker either: (a) ships the pricing engine inline → calibration leaves the parked-deploy boundary and ends up in a *second* place that has to be locked down; or (b) makes a fetch back to the parked deploy or a separate Worker that hosts the pricing engine — a network hop on the critical path. |
| DX | Smallest change to current state — single-purpose tiny repo. But two deploys, two CI configs, two domain considerations. |
| Pricing engine | Either duplicate `math.js`/`species-db.js` (now there are two copies to keep in sync) or hop. **Duplication is a known IP-leak vector** — anyone who gets read access to the SMS worker source has the calibration. |
| Vendor lock-in | Same as A but doubled — both projects on Cloudflare. |
| What it buys | Speed-of-shipping. SMS-1 cuts to "stand up a Worker, add packet parsing + Quo glue, point Quo webhook at it." Doesn't force the v2.3 migration if Cameron isn't ready. |

### C. Supabase Edge Functions

| Dimension | Detail |
|---|---|
| Cold start | Deno-on-V8 with ESZip — claimed 0–5ms ([Supabase docs](https://supabase.com/docs/guides/functions/architecture)), with real-world reports showing higher variance (sometimes 100ms+) ([GitHub discussion #29301](https://github.com/orgs/supabase/discussions/29301)). |
| Cost (free tier) | **500,000 invocations/month** ([Supabase pricing](https://supabase.com/pricing)). Below CF's 3M/mo at the free tier. |
| Cost (Pro) | **$25/month** — but bundles Supabase Auth + Postgres + Storage. If R5 picks Supabase, this is amortized. |
| Cost @ 100/mo | $0 |
| Cost @ 1k/mo | $0 |
| Cost @ 10k/mo | $0 (well within free tier) |
| IP protection | Strong — Edge Functions run server-side only. Same boundary story as Workers. |
| DX | Deno-native (TypeScript first). `math.js` is plain ES modules and works in Deno mostly OOTB; `species-db.js` likewise. NPM packages need `npm:` specifiers ([Supabase deps docs](https://supabase.com/docs/guides/functions/dependencies)). Deno tooling is good but different from wrangler. |
| Vendor lock-in | **High** if combined with Supabase Auth + DB (per ROADMAP.md §F3 recommendation). Lock-in is a feature here — one vendor for everything. |
| What it buys | Single-vendor cohesion. If Supabase becomes the auth + DB + storage layer (per R5 / R8), having SMS handler also on Supabase keeps the operational surface small. |
| Risks | Commits architecture *before* the R5 auth decision lands. If Cameron picks Clerk-for-auth instead, the Supabase Edge Functions choice loses its main coupling argument. |

---

## Cost at scale (sanity check — SMS volume only)

Per `SMS_FALLBACK_SPEC.md` §7, the spec sets a **global ceiling of 1,000 quotes/hour**. Real volume in MVP is far below — Cameron's own dogfooding plus a handful of crew leads. Annualized worst case under spec ceiling: 24,000/day × 365 = ~8.7M/year. All three options stay well within free tiers at expected volume; even at the worst-case spec ceiling, only **A on free tier overflows daily** (24k > 100k/day is fine, but if the SMS workers also serve `/api/estimate`, total may push over). Practical takeaway: **paid CF Workers ($5/mo) is the right ceiling cost target** regardless of option chosen, and Supabase Pro ($25/mo) is justified only if it doubles as the auth/DB tier.

---

## Recommendation: Option A

Reasons in priority order:

1. **The infrastructure is already built and tested locally.** `wrangler.toml` exists, `npm run dev` works, the pricing engine is already extracted. SMS-1 becomes "add 3 new files in `functions/api/sms/` + secrets" rather than "spin up a new platform."
2. **Cold-start latency matters for the Quo 3-second webhook deadline.** V8 isolates are the lowest-latency option of the three, with the highest predictability.
3. **No Deno port of `math.js`.** Worth a few hours saved + fewer chances to introduce a math regression during port.
4. **IP protection is most-mature here.** The `functions/lib/` non-routing pattern is already a documented design choice; Cloudflare Access (per DEPLOY.md) gives a second layer if Cameron ever wants to re-gate the URL.
5. **The SMS spec itself recommends A.** R2 should ratify the spec's recommendation unless evidence overturns it. Evidence here re-confirms it.

---

## What changes if Cameron picks B (standalone tiny worker)

- Pricing engine **must be duplicated** into `sms-worker/lib/math.js` + `sms-worker/lib/species-db.js`, OR the SMS worker `fetch`s the parked deploy. Duplication is the cleaner shape but creates a sync risk every time the math engine is updated. The hop adds 50–200ms of edge-to-edge latency, which is fine under the 3s budget but eats it for nothing.
- Cloudflare Access can still gate both, but the SMS endpoint specifically *cannot* be gated by Access — the Quo webhook must reach it without an interactive login. So the SMS endpoint becomes a public-on-internet URL whose only protection is the HMAC signature verification. (Same is true for option A's SMS endpoint, FYI — Access can't be on the SMS path either way.)
- v2.3 migration timeline is decoupled from SMS shipping. If you want SMS in production this week and v2.3 cutover next quarter, B is the lane.
- **Implementation diff vs A:** different repo or subfolder, separate `wrangler.toml`, separate Cloudflare Pages project, and one extra "deploy this folder too" step in the runbook.

## What changes if Cameron picks C (Supabase Edge Functions)

- `math.js` and `species-db.js` get ported to Deno-flavored TypeScript. Plain ES modules in JavaScript should work as-is; no `require()` calls or Node-built-in imports show up in `math.js` (it's pure math + ESM). The port is mostly cosmetic. **Rough port estimate: a couple hours.**
- Quo webhook URL becomes `https://<project-ref>.supabase.co/functions/v1/sms-inbound`.
- HMAC verify done inside the function using `SubtleCrypto` (same shape as on Workers).
- **Pre-condition: R5 should pick Supabase for auth/DB.** If R5 says "Clerk + D1," picking C here is incoherent. If R5 says "Supabase for auth + DB + storage," then C aligns and the $25 Pro plan covers everything.
- **Practical implication:** if Cameron is leaning Supabase-everything, do R5 first, then revisit this decision. A is still a defensible answer even with Supabase auth — Workers can verify Supabase JWTs natively.
- The 500k invocations/month free tier is plenty for SMS volume but tighter than CF if you also put the live picker `/api/estimate` calls through Supabase.

---

## Migration path back (if A doesn't work)

If Option A is shipped and Cameron later wants to move to C:
- The `compute()` math is portable across runtimes — same JS file, different module loader.
- The SMS handler shape (parse webhook → compute → format reply → send via Quo) is small (~200 LOC including error states per spec) — rewrite cost is low.
- Quo webhook URL is configurable on Quo's side; one settings change.
- The lock-in cost of A is low; the lock-in cost of C-with-Supabase-DB is high (because the DB schema is married to Supabase Auth).

This is one more argument for A: it's the option with the lowest reversal cost.

---

## Sources

- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/)
- [Cloudflare Workers security model](https://developers.cloudflare.com/workers/reference/security-model/)
- [Supabase Edge Functions pricing](https://supabase.com/pricing)
- [Supabase Edge Functions architecture](https://supabase.com/docs/guides/functions/architecture)
- [Supabase Edge Functions dependencies](https://supabase.com/docs/guides/functions/dependencies)
- [Supabase performance discussion #29301](https://github.com/orgs/supabase/discussions/29301)
- [Supabase Edge Functions invocations limit discussion #37060](https://github.com/orgs/supabase/discussions/37060)
- Project files referenced: `deploy/DEPLOY.md`, `deploy/wrangler.toml`, `deploy/functions/api/estimate.js`, `deploy/functions/lib/math.js`, `SMS_FALLBACK_SPEC.md`
