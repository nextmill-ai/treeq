/*
================================================================================
SUPABASE DASHBOARD — manual steps (Google OAuth, redirects)
================================================================================
1) Authentication → Providers → Google → Enable.
   - Paste Web Client ID and Web Client Secret from Google Cloud Console
     (APIs & Services → Credentials → OAuth 2.0 Client IDs → Web application).

2) Google Cloud Console (https://console.cloud.google.com/apis/credentials):
   - Application type: Web application
   - Authorized JavaScript origins:
       https://<YOUR_PROJECT_REF>.supabase.co
   - Authorized redirect URIs:
       https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback

3) Supabase → Authentication → URL Configuration:
   - Site URL: https://treeqapp.com  (production)
   - Additional Redirect URLs (add each you use):
       https://treeqapp.com
       https://treeqapp.com/
       http://localhost:8888          (optional: Netlify CLI default)
       http://localhost:8888/
       http://127.0.0.1:8888
   - Save. (Wildcard * is not recommended for OAuth redirects.)

4) After running this migration: Authentication → Users — sign up once with
   Google and confirm a row appears in public.accounts and public.profiles.

5) Optional: Authentication → Email Templates — irrelevant for Google-only.

================================================================================
*/

create extension if not exists pgcrypto;

-- P2 minimal auth: company shell + user profile linked to auth.users

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  market_city text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create index profiles_account_idx on public.profiles (account_id);

-- ---------------------------------------------------------------------------
-- New user: one account row + one profile row (id = auth user)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_account_id uuid;
  display_name text;
begin
  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(coalesce(new.email, 'user'), '@', 1)
  );

  insert into public.accounts (name, market_city)
  values (display_name, null)
  returning id into new_account_id;

  insert into public.profiles (id, account_id, full_name)
  values (
    new.id,
    new_account_id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      display_name
    )
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS: profiles — only own row, select + update (insert via trigger only)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select
  using (auth.uid() = id);

create policy profiles_update_own on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Lock down accounts from arbitrary client access; trigger still inserts (security definer).
alter table public.accounts enable row level security;

create policy accounts_select_own on public.accounts
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.account_id = accounts.id
    )
  );

grant usage on schema public to postgres, anon, authenticated, service_role;

grant select on public.accounts to authenticated;
grant select, update on public.profiles to authenticated;

grant all on public.accounts to postgres, service_role;
grant all on public.profiles to postgres, service_role;
