-- Migration 0004: P1 favorites + P3 saved_trees
-- Depends on: 20260514120000_auth_profiles.sql (public.accounts, public.profiles)

-- -------------------------------------------------------------------------
-- Helper: resolves the current user's account_id in one call.
-- Policies reference this instead of a repeated subquery so explain plans
-- can cache it per-statement.
-- -------------------------------------------------------------------------
create or replace function public.current_account_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select account_id from public.profiles where id = auth.uid()
$$;

-- -------------------------------------------------------------------------
-- P1: favorites
-- Composite PK (account_id, species_key) — no duplicates, O(1) lookup.
-- -------------------------------------------------------------------------
create table public.favorites (
  account_id  uuid not null references public.accounts(id) on delete cascade,
  species_key text not null check (char_length(species_key) between 1 and 64),
  created_at  timestamptz not null default now(),
  primary key (account_id, species_key)
);

create index favorites_account_idx on public.favorites (account_id);

alter table public.favorites enable row level security;

create policy favorites_select_own on public.favorites
  for select
  using (account_id = public.current_account_id());

create policy favorites_insert_own on public.favorites
  for insert
  with check (account_id = public.current_account_id());

create policy favorites_delete_own on public.favorites
  for delete
  using (account_id = public.current_account_id());

grant select, insert, delete on public.favorites to authenticated;
grant all on public.favorites to postgres, service_role;

-- -------------------------------------------------------------------------
-- P3: saved_trees
-- Stores one field measurement per row. Pricing is NOT stored here —
-- that lives on quotes once the pricing engine (P7) lands.
-- -------------------------------------------------------------------------
create table public.saved_trees (
  id             uuid         primary key default gen_random_uuid(),
  account_id     uuid         not null references public.accounts(id) on delete cascade,
  user_id        uuid         not null references auth.users(id) on delete cascade,
  species_key    text         not null check (char_length(species_key) between 1 and 64),
  dbh            numeric(5,2) not null check (dbh > 0 and dbh <= 300),
  height_ft      numeric(5,1)          check (height_ft > 0),
  crown_ft       numeric(5,1)          check (crown_ft > 0),
  trim_bucket    smallint     not null  check (trim_bucket between 0 and 4),
  cuts           integer      not null  check (cuts >= 0),
  seconds_total  integer      not null  check (seconds_total >= 0),
  notes          text,
  lat            double precision       check (lat between -90 and 90),
  lng            double precision       check (lng between -180 and 180),
  accuracy_m     double precision       check (accuracy_m >= 0),
  -- future FK to jobs table (P6+); nullable until that table exists
  job_id         uuid,
  created_at     timestamptz  not null default now()
);

create index saved_trees_account_created_idx
  on public.saved_trees (account_id, created_at desc);

create index saved_trees_user_idx
  on public.saved_trees (user_id);

alter table public.saved_trees enable row level security;

create policy saved_trees_select_own on public.saved_trees
  for select
  using (account_id = public.current_account_id());

create policy saved_trees_insert_own on public.saved_trees
  for insert
  with check (account_id = public.current_account_id());

create policy saved_trees_delete_own on public.saved_trees
  for delete
  using (account_id = public.current_account_id());

grant select, insert, delete on public.saved_trees to authenticated;
grant all on public.saved_trees to postgres, service_role;
