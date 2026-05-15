# R5 — Authentication Architecture

> Per `treeq_pricing_strategy` memory: build auth + Stripe scaffolding flag-gated off, flip on later when monetizing. Per `treeq_methodology_protection` memory: server-side methodology means **auth is the gate** that protects the calibration moat.
> Decision input for ROADMAP F3 (P2 phase).
> Prepared 2026-05-10 overnight session #2.

---

## TL;DR

- **Provider: Supabase Auth.** Single vendor for OAuth + JWT verification + Postgres + RLS. Free tier 50k MAU is plenty through P3–P5; Pro at $25/mo unlocks more if needed.
- **OAuth providers at launch: Google, Apple, Facebook, plus email magic link.** Email/password password-based auth is deferred to reduce support load.
- **Multi-tenant model: `account_id` foreign key on every per-tenant row + RLS via `auth.uid()` joined through a `users` table.** Schema leaves the door open for multi-user-per-account in P5+ without migration.
- **Anon mode is supported.** Anonymous users get a temporary anon JWT; their work lives client-side until upgrade-to-account. On account creation, anon-mode local state is reconciled into the new `account_id`.
- **Phone-to-account linking (SMS-fallback) is a separate flow from phone *authentication*.** The SMS spec's reverse-confirm `TQLINK` flow is not a Supabase Auth feature — it's a custom join table populated by the SMS handler. Stand alone from Supabase.
- **Capacitor wrap requires care around PKCE OAuth + WebView cookies.** Documented pitfalls; solutions exist (separate native OAuth client + HTTPS→custom-scheme redirect or Cap-go's `capacitor-supabase` plugin).

---

## 1. Why Supabase Auth (not Clerk, not Firebase, not Auth0)

Per ROADMAP §F3, three providers were short-listed. Decision factors with R5 input:

| Factor | Supabase | Clerk | Auth0 | Firebase |
|---|---|---|---|---|
| Free MAU | 50,000 | 10,000 | 25,000 | generous |
| OAuth providers (Google/Apple/Facebook) | ✓ + 20 more | ✓ + 20 more | ✓ + many | ✓ + many |
| Bundles a database | ✓ Postgres | ✗ (BYO DB) | ✗ | ✓ Firestore |
| Postgres + RLS for IP-protection of pricing data | **strongest** | n/a | n/a | n/a (Firestore is NoSQL) |
| Phone OTP auth | ✓ | ✓ (via Twilio) | ✓ | ✓ |
| Capacitor support | community plugin (Cap-go) | official | official | official |
| Vendor neutrality | Postgres is portable | proprietary | proprietary | locks to GCP |

**Decision: Supabase.** Two main reasons:

1. **The DB is the same vendor.** Every per-account row gets RLS-protected via the same `auth.uid()` claim that the auth layer already issues. No JWT-introspection bridge needed.
2. **Postgres + RLS is the right shape for the FMS roadmap.** Trees, quotes, customers, crews — all of these are relational. Firestore-style document DBs become awkward as the schema grows.

Accept the trade-off: community-maintained Capacitor plugin (vs Clerk's first-party). It works, but the integration has known sharp edges (covered in §5 below).

**If Cameron picks Clerk-with-D1 instead** (per ROADMAP §F3 Path 1): the JWT verification still works on Cloudflare Workers (Clerk publishes JWKS). The DB layer is whatever D1 + custom schema vs Supabase Postgres trade-off Cameron prefers. The R8 entity model still holds either way; only the RLS implementation changes.

---

## 2. Account model

Per ROADMAP §F3 and the FMS-vision memory:

```
auth.users (Supabase-managed)         — opaque identity row, one per OAuth identity
  ↓ 1:1
public.users                          — our profile row
  ↓ many-to-one
public.accounts                       — one tree-service company / shop
```

Cardinality at P2 launch: one user → one account. This shape leaves the door open for multi-user-per-account in P5 (a foreman + an owner sharing the same `account_id`) without a schema migration. Every per-tenant row gets `account_id`; the `users` table is the join.

```sql
-- accounts: one tree-service operator's company
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  market_city text,
  default_zip text,
  created_at timestamptz default now()
);

-- users: profile row paired 1:1 with auth.users at signup
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id),
  email text not null,
  display_name text,
  role text not null default 'owner', -- 'owner' | 'foreman' | 'crew'
  created_at timestamptz default now()
);

create index users_account_id_idx on public.users(account_id);
```

At signup, a trigger on `auth.users` creates the matching `public.users` row and (if no invitation token is present) creates a fresh `public.accounts` row with `name = '<email>\'s shop'`.

**Account-creation trigger:**

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_account_id uuid;
begin
  insert into public.accounts (name)
  values (coalesce(new.raw_user_meta_data->>'company_name', new.email || '''s shop'))
  returning id into new_account_id;

  insert into public.users (id, account_id, email, display_name)
  values (new.id, new_account_id, new.email,
          coalesce(new.raw_user_meta_data->>'name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

---

## 3. Sample RLS policies

Per the spec's request: sample SQL for `trees` (saved-tree records) and `quotes` (per-job pricing).

### 3.1 Helper: SECURITY DEFINER lookup (perf optimization)

A naïve RLS policy would do `account_id IN (SELECT account_id FROM public.users WHERE id = auth.uid())` on every row. That subquery runs for every row evaluation. The recommended optimization is a `STABLE` `SECURITY DEFINER` function so PG can cache it within a query:

```sql
create or replace function public.current_account_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select account_id from public.users where id = auth.uid()
$$;

revoke all on function public.current_account_id() from public;
grant execute on function public.current_account_id() to authenticated;
```

Now every RLS policy can call `public.current_account_id()` and PG caches the result for the duration of a query.

### 3.2 trees table

```sql
create table public.trees (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id),
  user_id uuid not null references public.users(id),
  species_key text not null,
  dbh_in numeric not null check (dbh_in between 1 and 100),
  height_ft int,
  crown_ft int,
  trim_bucket smallint not null default 0 check (trim_bucket between 0 and 4),
  computed_cuts int,
  computed_seconds int,
  notes text,
  lat numeric,
  lng numeric,
  geo_accuracy_m int,
  captured_at timestamptz,
  created_at timestamptz default now()
);

create index trees_account_id_idx on public.trees(account_id);
create index trees_user_id_idx on public.trees(user_id);

alter table public.trees enable row level security;

-- Read: anyone in the same account can see all trees
create policy trees_select_own_account
  on public.trees for select to authenticated
  using (account_id = public.current_account_id());

-- Insert: the row's account_id must match the user's account
create policy trees_insert_own_account
  on public.trees for insert to authenticated
  with check (account_id = public.current_account_id() and user_id = auth.uid());

-- Update: only the user who created the tree (or owner role) can update
create policy trees_update_own
  on public.trees for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Delete: only the user who created it
create policy trees_delete_own
  on public.trees for delete to authenticated
  using (user_id = auth.uid());
```

### 3.3 quotes table

```sql
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id),
  user_id uuid not null references public.users(id),
  customer_id uuid,                  -- references public.customers when R8 lands
  status text not null default 'draft', -- draft → quoted → accepted → scheduled → completed → invoiced → paid
  total_cents int,                   -- USD cents, server-computed
  trees jsonb,                       -- snapshot of trees included in this quote
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index quotes_account_id_idx on public.quotes(account_id);
create index quotes_status_idx on public.quotes(status);

alter table public.quotes enable row level security;

-- Read: any user in the account can see any quote (foremen + owners share visibility)
create policy quotes_select_own_account
  on public.quotes for select to authenticated
  using (account_id = public.current_account_id());

-- Insert: must belong to user's account
create policy quotes_insert_own_account
  on public.quotes for insert to authenticated
  with check (account_id = public.current_account_id() and user_id = auth.uid());

-- Update: any user in the account can edit the quote (collaborative editing).
-- Tighten to user_id = auth.uid() only if Cameron wants single-author quotes.
create policy quotes_update_own_account
  on public.quotes for update to authenticated
  using (account_id = public.current_account_id())
  with check (account_id = public.current_account_id());

-- Delete: only the original author
create policy quotes_delete_own
  on public.quotes for delete to authenticated
  using (user_id = auth.uid());
```

### 3.4 What this gives us

- A user only sees their own account's data, period.
- Insert can't smuggle a wrong `account_id` (the `with check` clause rejects it).
- Multi-user accounts (P5+) get cross-user visibility within the account but personal-author boundaries on tree edits.
- The `current_account_id()` function caches the lookup so RLS doesn't tank read performance.

**Test plan for these policies (out of scope for R5, but flag for whoever implements):**
- Sign in as user A in account X. Insert a tree with `account_id = X`. Should succeed.
- Same user A. Insert a tree with `account_id = Y` (a different account). Should fail with permission denied via the `with check`.
- Sign in as user B in account Y. Try to read trees for account X. Should return zero rows.
- Sign in as user C in account X (multi-user). Read trees that user A created. Should succeed (read), but `update` on those trees should fail.

---

## 4. Anon-mode strategy

The picker, the calculator, and the leaf decision tree should all work for anon users (per FMS vision and the SMS_FALLBACK spec §5 implicit assumption). Three options for "anon then upgrade":

### Option 1 — Pure client-side until upgrade (recommended)

- Anon users: localStorage + IndexedDB only. No server calls except `/api/estimate` (and that's not yet shipped).
- The picker + calculator + favorites + recent species all work offline, persisted locally.
- "Save tree" is gated behind sign-in: tapping it shows the auth modal.
- On account creation, the client posts its local state once: `POST /api/account/initialize {favorites, recent_species, anon_local_trees: [...]}`. Server inserts these into the user's new `account_id`.

Pros: simplest. No server-side anon JWT to manage. No orphaned data when an anon user never converts.
Cons: anon work doesn't sync across devices (one anon user = one device).

### Option 2 — Supabase anonymous sign-in

- Supabase Auth supports anonymous sign-in (since v2022; documented at <https://supabase.com/docs/guides/auth/auth-anonymous>). Issues a JWT with `is_anonymous = true`.
- Server creates a temporary `accounts` row + `users` row marked anon.
- On real signup, Supabase has a `linkIdentity()` call that promotes the anon user to a real one — preserves the `auth.uid()`, so all FK relationships hold.

Pros: cross-device sync via the anon account ID. Server-side history immediately on first interaction.
Cons: more complex; orphaned anon accounts need cleanup; rate-limit concern if anon-signups become a spam vector.

### Option 3 — Don't ship anon (gated app)

- Force sign-in before anything works.
- Removes complexity but kills the homeowner-facing onramp story (yard sign + SMS quote without app install).

**Recommendation: Option 1 for MVP, evaluate Option 2 in P3 when saved trees ship.** Option 1 is the smallest possible commitment; the data model in §2 + §3 is identical either way, only the client-state migration changes.

---

## 5. Capacitor wrap considerations

Supabase OAuth in a Capacitor wrap has documented issues. Cameron will hit these — flag now, fix once.

### Issues to know about

1. **PKCE code verifier disappears between SFSafariViewController and the app.** When Supabase OAuth opens Safari, the verifier is stored in a cookie; iOS may clear backgrounded WKWebView cookies, and the verifier is gone when the deep-link returns ([Medium write-up](https://medium.com/@vpodugu/supabase-pkce-oauth-in-capacitor-ios-why-your-code-verifier-disappears-and-how-to-fix-it-29a4747dce9e)).
2. **Deep-link round-trip from custom scheme silently fails.** The deep link arrives but `getSession()` returns null because the auth code was never exchanged.

### Recommended approaches

- **Use Cap-go's `capacitor-supabase` plugin** ([GitHub](https://github.com/Cap-go/capacitor-supabase)). Wraps the native iOS/Android SDK + Capacitor bridge so the OAuth flow goes through the platform's native browser-tab APIs (SFAuthenticationSession on iOS, Custom Tabs on Android) which preserve cookies correctly.
- **Or: redirect to an HTTPS endpoint first, which then 302s to your custom scheme.** SFSafariViewController handles server-side redirects reliably.
- **Or: use `signInWithOAuth({skipBrowserRedirect: true})`** to handle the redirect URL manually with `Browser.open()` from `@capacitor/browser`, then catch the deep link with `App.addListener('appUrlOpen')` and call `setSession()` with the resulting tokens.

### Session refresh

Once the session lands, `supabase-js` handles refresh transparently via `autoRefreshToken: true` (default). On Capacitor, ensure the tokens are persisted to a Capacitor-aware storage layer (e.g., `@capacitor/preferences` or the Cap-go plugin's built-in storage) — the default `localStorage` works on web but is ephemeral on iOS and may not survive backgrounding.

```js
import { createClient } from '@supabase/supabase-js';
import { Preferences } from '@capacitor/preferences';

const supabase = createClient(URL, ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storage: {
      getItem: async key => (await Preferences.get({ key })).value,
      setItem: async (key, value) => Preferences.set({ key, value }),
      removeItem: async key => Preferences.remove({ key })
    }
  }
});
```

### Apple Sign-In specifically

Apple requires Sign in with Apple if any other social provider is offered, per App Store Review Guidelines §4.8. Since we ship Google + Facebook, Apple is mandatory for iOS.

- Apple Developer account required ($99/yr) — covered in R4.
- Configure Sign in with Apple in the Supabase Auth dashboard with Apple Service ID + private key.
- iOS-native Apple Sign-In is preferred over web-based on iOS for review compliance.

---

## 6. Account-to-phone linking for SMS-fallback

Per `SMS_FALLBACK_SPEC.md` §6: a user links their phone via a reverse-confirm SMS (`TQLINK 384192`). This is **not** Supabase Auth's phone-OTP flow. They serve different goals.

| Flow | Purpose | Owner |
|---|---|---|
| Supabase phone OTP | "Sign in to TreeQ via phone number." User enters phone, Supabase sends a code, user enters code, gets a session. | Supabase Auth (out of the box) |
| TQLINK reverse-confirm | "Link this phone to my existing TreeQ account so SMS quotes save to history." User is already signed in; SMS is to **prove ownership of phone** so the SMS handler can resolve `from_phone` → `account_id`. | Custom; lives in our `account_phones` table |

**Recommendation: keep these separate.** The SMS spec's flow stands alone — it's a small `account_phones` table populated by the SMS webhook handler when it sees a `TQLINK <code>` message and matches the code to a recently-issued one in `link_phone_codes`. This gives Cameron the option to add Supabase phone-OTP signup later (P3 or beyond) without touching the SMS-link flow.

Schema sketch:

```sql
create table public.account_phones (
  account_id uuid not null references public.accounts(id),
  phone_e164 text not null,
  label text,
  linked_at timestamptz default now(),
  primary key (account_id, phone_e164)
);

create index account_phones_phone_idx on public.account_phones(phone_e164);

create table public.link_phone_codes (
  code text primary key,                    -- e.g. '384192'
  account_id uuid not null references public.accounts(id),
  expires_at timestamptz not null,
  consumed_at timestamptz
);

-- RLS: a user can see their account's linked phones; can't see anyone else's
alter table public.account_phones enable row level security;
create policy account_phones_select_own
  on public.account_phones for select to authenticated
  using (account_id = public.current_account_id());

-- Insertion is done by the SMS handler running with the service role key; not a user action.
-- No RLS insert policy = service-role-only inserts. Safe.
```

For the SMS handler, the lookup is `select account_id from public.account_phones where phone_e164 = $1` keyed on the `from` field of the inbound webhook. Index covers it.

---

## 7. Open questions / next steps

1. **Supabase project: free vs Pro.** Free tier covers MVP. $25/mo Pro adds: 100k MAU, 7-day backups, point-in-time recovery, support SLAs. Pro can wait until P3+ when there's real user data to protect.
2. **Email magic link for first launch?** Lowest-friction signup but introduces an email-rendering surface. Probably yes — ship as an option alongside Google/Apple/Facebook. Defer email-password until support burden justifies it.
3. **Anon→signup migration: client-only or server-side?** Per §4, recommendation is client-only at MVP. Revisit when saved trees ship.
4. **Capacitor SDK choice: Supabase official + workarounds, or Cap-go plugin?** Official + the HTTPS→custom-scheme redirect pattern is the lighter dependency. Cap-go is more turnkey but adds a maintained-by-someone-else surface. Lean Cap-go if Cameron values speed; lean official if he wants supply-chain conservatism.
5. **Multi-tenancy at `accounts` level — owner can invite other users (foreman, crew).** Out of scope for R5; P5 ticket. Schema in §2 leaves room (`role` field on `users`).

---

## Sources

- [Supabase RLS overview](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase RLS multi-tenant pattern (DEV.to)](https://dev.to/issuecapture/row-level-security-in-supabase-multi-tenant-saas-from-day-one-4lon)
- [Supabase RLS production patterns (Makerkit)](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)
- [Supabase RLS performance discussion #149922](https://github.com/orgs/community/discussions/149922)
- [Supabase native mobile deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
- [Capacitor + Supabase OAuth PKCE issue write-up](https://medium.com/@vpodugu/supabase-pkce-oauth-in-capacitor-ios-why-your-code-verifier-disappears-and-how-to-fix-it-29a4747dce9e)
- [Cap-go capacitor-supabase plugin](https://github.com/Cap-go/capacitor-supabase)
- [Supabase OAuth Capacitor discussion #11548](https://github.com/orgs/supabase/discussions/11548)
- [Capacitor 7 GA + 8 release cadence (Ionic blog)](https://ionic.io/blog/capacitor-7-has-hit-ga)
- Project files referenced: `ROADMAP.md` §F3, `SMS_FALLBACK_SPEC.md` §6
