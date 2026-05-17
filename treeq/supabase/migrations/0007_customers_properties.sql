-- Migration 0007: CRM core — crm_customers + crm_properties
-- Depends on: 0006_roles_and_invitations.sql (set_updated_at, current_role)
--
-- NOTE: The legacy `customers` and `properties` tables (0002) are the LLM
-- estimator FMS-backbone schema keyed by `org_id`. They are still referenced
-- by `treeq-ai.js` + `jobber-webhook.js` and may not be reshaped without
-- breaking those flows. The Quote Builder CRM uses a parallel `crm_*` set
-- keyed by `account_id` (auth/RLS aligned to the post-2026-05-14 model).
-- Migration to merge the two namespaces is deferred (Roadmap P6+).
--
-- One crm_customer (homeowner / property owner) → many crm_properties.
-- crm_quotes (0008) references both.
--
-- Roles capability matrix (enforced by RLS):
--   owner / admin / estimator → full CRUD
--   viewer                    → select only
--
-- Soft-delete via archived_at; never hard delete (FMS audit posture).

-- ─────────────────────────────────────────────────────────────────────
-- crm_customers
-- ─────────────────────────────────────────────────────────────────────
create table public.crm_customers (
  id                    uuid        primary key default gen_random_uuid(),
  account_id            uuid        not null references public.accounts(id) on delete cascade,
  name                  text        not null check (char_length(name) between 1 and 150),
  primary_phone         text                check (primary_phone is null or char_length(primary_phone) between 5 and 32),
  primary_email         text                check (primary_email is null or char_length(primary_email) between 3 and 254),
  notes                 text,
  created_by_user_id    uuid        references public.profiles(id) on delete set null,
  archived_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index crm_customers_account_name_idx     on public.crm_customers (account_id, name);
create index crm_customers_account_active_idx   on public.crm_customers (account_id, archived_at)
  where archived_at is null;
create index crm_customers_search_idx on public.crm_customers
  using gin (
    to_tsvector('simple',
      coalesce(name,'') || ' ' || coalesce(primary_email,'') || ' ' || coalesce(primary_phone,''))
  );

create trigger crm_customers_set_updated_at
  before update on public.crm_customers
  for each row execute function public.set_updated_at();

alter table public.crm_customers enable row level security;

create policy crm_customers_select_own on public.crm_customers
  for select
  using (account_id = public.current_account_id());

create policy crm_customers_insert_writer on public.crm_customers
  for insert
  with check (
    account_id = public.current_account_id()
    and public.current_role() in ('owner','admin','estimator')
  );

create policy crm_customers_update_writer on public.crm_customers
  for update
  using (
    account_id = public.current_account_id()
    and public.current_role() in ('owner','admin','estimator')
  )
  with check (account_id = public.current_account_id());

create policy crm_customers_delete_admin on public.crm_customers
  for delete
  using (
    account_id = public.current_account_id()
    and public.current_role() in ('owner','admin')
  );

grant select, insert, update, delete on public.crm_customers to authenticated;
grant all on public.crm_customers to postgres, service_role;

-- ─────────────────────────────────────────────────────────────────────
-- crm_properties
-- ─────────────────────────────────────────────────────────────────────
create table public.crm_properties (
  id              uuid        primary key default gen_random_uuid(),
  account_id      uuid        not null references public.accounts(id) on delete cascade,
  customer_id     uuid        not null references public.crm_customers(id) on delete cascade,
  address_line1   text        not null check (char_length(address_line1) between 1 and 200),
  address_line2   text                check (address_line2 is null or char_length(address_line2) <= 200),
  city            text                check (city is null or char_length(city) <= 100),
  state           text                check (state is null or char_length(state) <= 50),
  zip             text                check (zip is null or char_length(zip) <= 20),
  lat             numeric(9,6)        check (lat is null or (lat between -90 and 90)),
  lng             numeric(9,6)        check (lng is null or (lng between -180 and 180)),
  notes           text,
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index crm_properties_account_customer_idx on public.crm_properties (account_id, customer_id);
create index crm_properties_account_active_idx   on public.crm_properties (account_id, archived_at)
  where archived_at is null;

create trigger crm_properties_set_updated_at
  before update on public.crm_properties
  for each row execute function public.set_updated_at();

alter table public.crm_properties enable row level security;

create policy crm_properties_select_own on public.crm_properties
  for select
  using (account_id = public.current_account_id());

create policy crm_properties_insert_writer on public.crm_properties
  for insert
  with check (
    account_id = public.current_account_id()
    and public.current_role() in ('owner','admin','estimator')
  );

create policy crm_properties_update_writer on public.crm_properties
  for update
  using (
    account_id = public.current_account_id()
    and public.current_role() in ('owner','admin','estimator')
  )
  with check (account_id = public.current_account_id());

create policy crm_properties_delete_admin on public.crm_properties
  for delete
  using (
    account_id = public.current_account_id()
    and public.current_role() in ('owner','admin')
  );

grant select, insert, update, delete on public.crm_properties to authenticated;
grant all on public.crm_properties to postgres, service_role;
