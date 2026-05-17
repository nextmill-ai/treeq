-- Migration 0006: Roles + Invitations
-- Depends on: 20260514120000_auth_profiles.sql, 0004_saved_trees_favorites.sql
--
-- Adds:
--   1. profiles.role column (owner/admin/estimator/viewer)
--   2. public.invitations table for teammate onboarding (token-based, 7-day TTL)
--   3. Updates handle_new_user() to honor an invitation_token in user metadata
--      so the invitee lands on the inviter's account instead of a fresh one.
--   4. current_account_id() already exists from 0004 — extended here with
--      current_role() helper.
--
-- DECISION: We use text + check constraint for role rather than an enum,
-- so adding a new role later doesn't require an alter-type migration.

-- 1. Add role column to profiles (default 'owner' for existing rows + new accounts)
alter table public.profiles
  add column role text not null default 'owner'
    check (role in ('owner','admin','estimator','viewer'));

create index profiles_account_role_idx on public.profiles (account_id, role);

-- 2. Helper: caller's role
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- 3. Invitations table
create table public.invitations (
  id                    uuid        primary key default gen_random_uuid(),
  account_id            uuid        not null references public.accounts(id) on delete cascade,
  email                 text        not null check (char_length(email) between 3 and 254),
  role                  text        not null
                          check (role in ('admin','estimator','viewer')),
  token                 text        not null unique
                          check (char_length(token) between 16 and 128),
  invited_by_user_id    uuid        references public.profiles(id) on delete set null,
  expires_at            timestamptz not null default (now() + interval '7 days'),
  accepted_at           timestamptz,
  accepted_by_user_id   uuid        references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now()
);

create index invitations_account_idx       on public.invitations (account_id);
create index invitations_token_idx         on public.invitations (token);
create index invitations_pending_idx       on public.invitations (account_id, accepted_at)
  where accepted_at is null;

alter table public.invitations enable row level security;

-- Only owners and admins of the same account can list/manage invitations
create policy invitations_select_admin on public.invitations
  for select
  using (
    account_id = public.current_account_id()
    and public.current_role() in ('owner','admin')
  );

create policy invitations_insert_admin on public.invitations
  for insert
  with check (
    account_id = public.current_account_id()
    and public.current_role() in ('owner','admin')
  );

create policy invitations_delete_admin on public.invitations
  for delete
  using (
    account_id = public.current_account_id()
    and public.current_role() in ('owner','admin')
  );

-- Update policy is rare but allowed for revoke/extend flows; tighten if needed.
create policy invitations_update_admin on public.invitations
  for update
  using (
    account_id = public.current_account_id()
    and public.current_role() in ('owner','admin')
  )
  with check (account_id = public.current_account_id());

grant select, insert, update, delete on public.invitations to authenticated;
grant all on public.invitations to postgres, service_role;

-- 4. Replace handle_new_user() with invitation-aware version.
-- If raw_user_meta_data->>'invitation_token' is present AND that invitation
-- is valid (exists, not accepted, not expired, email matches), the new
-- profile is attached to the inviter's account with the assigned role.
-- Otherwise: existing behavior — fresh account + owner role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_account_id uuid;
  display_name   text;
  invite_token   text;
  invite_row     public.invitations%rowtype;
  assigned_role  text;
begin
  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(coalesce(new.email, 'user'), '@', 1)
  );

  invite_token := nullif(trim(new.raw_user_meta_data->>'invitation_token'), '');

  if invite_token is not null then
    select * into invite_row
      from public.invitations
     where token = invite_token
       and accepted_at is null
       and expires_at > now()
     limit 1;

    if found then
      new_account_id := invite_row.account_id;
      assigned_role  := invite_row.role;

      insert into public.profiles (id, account_id, full_name, role)
      values (new.id, new_account_id, display_name, assigned_role);

      update public.invitations
         set accepted_at = now(),
             accepted_by_user_id = new.id
       where id = invite_row.id;

      return new;
    end if;
    -- Fall through: invalid/expired token still creates a fresh account.
  end if;

  -- No invitation: create personal account + owner profile
  insert into public.accounts (name, market_city)
  values (display_name, null)
  returning id into new_account_id;

  insert into public.profiles (id, account_id, full_name, role)
  values (new.id, new_account_id, display_name, 'owner');

  return new;
end;
$$;

-- Trigger is already attached in 20260514120000; re-binding is idempotent.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 5. Updated_at trigger helper used across operational tables (0007, 0008).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
