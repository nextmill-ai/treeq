# Overnight Smoke Test — 2026-05-17

Manual end-to-end check for the backend CRM build (Tasks 1–17 of OVERNIGHT_BACKEND_BRIEF.md). Runs against a Supabase project with migrations 0001–0008 applied, and `treeq/` served by Netlify Dev or beta.

## Prerequisites

- Supabase migrations applied: 0001, 0002, 0003, 0004, 0005, 20260514120000_auth_profiles, 0006_roles_and_invitations, 0007_customers_properties, 0008_quotes.
- Netlify Functions deployed to beta (`treeqbeta.netlify.app`) or running locally via `npx netlify dev` from `treeq/`.
- Environment variables in Netlify: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `PUBLIC_BASE_URL` (optional, defaults to `https://treeqapp.com` — set to `https://treeqbeta.netlify.app` for beta).
- Two Google accounts available (use a Chrome profile + an Incognito Chrome window with a different Google login).

## Test plan

### A. Owner signup

1. Open `https://treeqbeta.netlify.app/login.html` in Profile A.
2. Sign in with Google account A.
3. Open `/settings.html`. Confirm: profile name + email populate, Team tab shows just you with role `owner`.
4. Open `/customers.html`. Empty state visible. Tap **+**, create "Test Customer 1" with a phone and an email.
5. On `/customer-detail.html`, add a property at `123 Main St, Rochester, NY 14620`.
6. Tap **New quote**. The Quote Builder opens with the cloud bar showing `Test Customer 1 · 123 Main St`.
7. Add a tree removal, set dbh=24, height=50. After ~2s the URL gains `?quote_id=...`.
8. Open `/quotes.html` in a new tab. The new quote appears with the customer name + total. Status: `draft`.
9. Click the quote → quote-detail shows the line item, total, status `draft`, history shows "Created (draft)".
10. Click **Mark as Sent**. Status flips to `sent`, history adds an entry. The `sent_at` is set.

### B. Invite + second-account join

1. On `/settings.html` Team tab: enter `<second-google-account>@gmail.com`, role `estimator`. Click **Generate invite link**.
2. Copy the link.
3. In an Incognito window logged into Profile B, open the invite link.
   - **Note:** The signup-with-invitation handoff requires the frontend to pass `invitation_token` as `raw_user_meta_data` on Google OAuth. If `login.html` does not yet do this, the invitee will create a fresh personal account. Workaround until login.html is wired: manually attach the invitation by running an admin SQL update, or add the token param to the Supabase OAuth call.
4. After Profile B finishes Google OAuth, expected: their `profiles.account_id` = Profile A's account, role = `estimator`. Verify in `/settings.html` Team tab (visible from Profile A as a second member).

### C. RLS isolation

1. From Profile A, copy a quote's UUID.
2. In a separate window logged into a *third* test account (Profile C, not invited), call:
   ```bash
   curl -H "Authorization: Bearer <profile_c_jwt>" \
     https://treeqbeta.netlify.app/.netlify/functions/crm-quotes?id=<profile_a_quote_uuid>
   ```
3. Expect: `404 Quote not found`. RLS should block any cross-account read.
4. Also: `/.netlify/functions/customers` from Profile C returns an empty list (Profile A's customers invisible).

### D. Role enforcement

1. From Profile A (owner), demote the invited Profile B to `viewer`.
2. From Profile B, try POST a new customer:
   ```bash
   curl -X POST -H "Authorization: Bearer <profile_b_jwt>" \
     -H "Content-Type: application/json" \
     -d '{"name":"Should fail"}' \
     https://treeqbeta.netlify.app/.netlify/functions/customers
   ```
   Expect: `403 Forbidden`.
3. From Profile A, attempt to demote yourself (last owner). Either UI blocks it (no demote button on self) or PATCH returns `409 Cannot demote the last owner`.

### E. Per-account quote numbering

1. Create three quotes in Profile A's account. Confirm numbers 1, 2, 3.
2. From Profile C (separate account), create a quote. Confirm its number is 1 (independent counter).

### F. Soft-delete

1. From `/customer-detail.html`, archive a customer.
2. `/customers.html` no longer lists the customer (default filter excludes archived).
3. Direct DB query confirms `archived_at IS NOT NULL` — row still present.

### G. Anonymous fallback

1. Sign out. Open `/spartan_pricing_tool.html`.
2. Cloud bar hidden. Existing localStorage save/load still works.
3. Build a quote, navigate away to `/index.html`, come back — state restored from localStorage.

## Known issues to verify in the morning

- Invitation-token-on-signup pathway needs login.html to thread the `invitation_token` through Supabase's `signInWithOAuth({ provider: 'google', options: { queryParams: { invitation_token: '...' }}})`. The DB trigger already honors it; the UI wire is unfinished.
- Pricing tool autosave fires only on field changes that flow through `recalc()`. Customer/property change uses an explicit `scheduleSave` call (verified). Quote-builder edits made via direct `state.trees.push` outside `recalc()` may not autosave until `recalc()` next runs — every interactive control already does.
- `/crm-quotes/transition` subpath relies on Netlify's path-suffix passthrough. The frontend falls back to `?action=transition` if the subpath returns 404.
- `quotes.html` "customer dropdown" filter described in the brief is not implemented — only status pills + search are. Customer filtering works via `?customer_id=` on the customer-detail page.

---

## Smoke test execution log — 2026-05-17

Executed by Claude Code after applying migrations + deploying to beta. Cameron asleep; no Google sign-in performed. Tests below are DB + API level only.

### Migrations applied
```
supabase migration repair --status applied  0003 0004 0006 0007 0008 20260514120000
supabase migration repair --status reverted 0005  (deferred — see notes)
```
Tables on remote confirmed: `accounts`, `profiles`, `favorites`, `saved_trees`, `invitations`, `crm_customers`, `crm_properties`, `crm_quotes`, `crm_quote_lines`, `crm_quote_state_changes`. RLS on all 8. Legacy `customers/properties/quotes/jobs/subcontractors` (org_id-scoped) still in place — untouched.

### Migration 0005 NOT applied
0005 (`resources_team`) fails because it tries to create `public.subcontractors`, which already exists from 0001 with a different schema (org_id-scoped vendor model). This is the same naming-collision pattern that drove the `crm_*` prefix for my new tables. To apply 0005, rewrite the table names to `account_subcontractors` (or similar) and re-push. **Deferred — does not block the CRM build.**

### Endpoints (against https://treeqbeta.netlify.app)
| Endpoint | Method | Auth | Expected | Actual |
|---|---|---|---|---|
| `/invitations/lookup?token=bogus` | GET | none | 404 invalid token | ✅ 404 `{"error":"Invitation not found"}` |
| `/customers` | GET | none | 401 | ✅ 401 `{"error":"Missing Authorization bearer token"}` |
| `/crm-quotes` | GET | `Bearer garbage` | 401 | ✅ 401 `{"error":"Invalid or expired token"}` |
| `/login.html` etc. | GET | n/a | 200 | ✅ all 200 |
| `/assets/auth-client.js` | GET | n/a | 200 | ✅ 200 |

### Per-account quote numbering trigger
Inserted three `crm_quotes` rows against a synthetic account inside a single CTE chain. Returned `{quote1: 1, quote2: 2, quote3: 3}`. **Trigger verified.** Cleanup cascade dropped the test account + its quotes correctly.

### Auth-guard refactor
Original `requireAuth` required `SUPABASE_JWT_SECRET` (HS256 verify). Beta env has `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set but NOT `SUPABASE_JWT_SECRET`. Rather than expose Cameron's JWT secret in env vars (a paste-from-dashboard step), I refactored `requireAuth` to:
1. Use HS256 fast path if `SUPABASE_JWT_SECRET` is set
2. Otherwise call `supabase.auth.getUser(token)` via service-role client (adds one network hop per request — acceptable)

`requireAuth` is now `async`; added `await` at all 9 call sites. Backward-compatible — existing code paths still work if you do set the JWT secret later.

### Not yet smoke-tested (require browser + Google OAuth)
- New-user signup → trigger creates account + profile with role=owner.
- Invitation-token → trigger routes signup to the inviter's account.
- RLS isolation between two distinct accounts on a live request.
- End-to-end Quote Builder cloud autosave round-trip.

These are documented above in §A–§G and need a real Google account.
