-- Migration 0005: P4 account_resources + P5 employees / subcontractors / proficiency
-- Depends on: 0004_saved_trees_favorites.sql (public.current_account_id)

-- -------------------------------------------------------------------------
-- P4: account_resources
-- One row per (account, resource_key). size_matrix is a jsonb map of
-- size-tier flags, e.g. {"40_50": true, "51_60": false}.
-- resource_key values are defined in the app layer (roadmap F4.1 taxonomy).
-- -------------------------------------------------------------------------
create table public.account_resources (
  account_id   uuid    not null references public.accounts(id) on delete cascade,
  resource_key text    not null check (char_length(resource_key) between 1 and 64),
  owned        boolean not null default false,
  size_matrix  jsonb,
  updated_at   timestamptz not null default now(),
  primary key  (account_id, resource_key)
);

alter table public.account_resources enable row level security;

create policy resources_select_own on public.account_resources
  for select
  using (account_id = public.current_account_id());

create policy resources_insert_own on public.account_resources
  for insert
  with check (account_id = public.current_account_id());

create policy resources_update_own on public.account_resources
  for update
  using (account_id = public.current_account_id())
  with check (account_id = public.current_account_id());

create policy resources_delete_own on public.account_resources
  for delete
  using (account_id = public.current_account_id());

grant select, insert, update, delete on public.account_resources to authenticated;
grant all on public.account_resources to postgres, service_role;

-- -------------------------------------------------------------------------
-- P5: employees
-- Roles + seniority tiers per roadmap F5.1.
-- jobber_id is NULL until Jobber OAuth sync lands (P6).
-- -------------------------------------------------------------------------
create type employee_role as enum (
  'ground_crew',
  'foreman',
  'bucket_operator',
  'aerial_arborist'
);

create type employee_seniority as enum (
  'junior',
  'regular',
  'senior'
);

create table public.employees (
  id          uuid               primary key default gen_random_uuid(),
  account_id  uuid               not null references public.accounts(id) on delete cascade,
  name        text               not null check (char_length(name) between 1 and 100),
  role        employee_role      not null,
  seniority   employee_seniority not null,
  hire_date   date,
  jobber_id   text,
  active      boolean            not null default true,
  created_at  timestamptz        not null default now()
);

create index employees_account_idx    on public.employees (account_id);
create index employees_jobber_id_idx  on public.employees (jobber_id) where jobber_id is not null;

alter table public.employees enable row level security;

create policy employees_select_own on public.employees
  for select
  using (account_id = public.current_account_id());

create policy employees_insert_own on public.employees
  for insert
  with check (account_id = public.current_account_id());

create policy employees_update_own on public.employees
  for update
  using (account_id = public.current_account_id())
  with check (account_id = public.current_account_id());

create policy employees_delete_own on public.employees
  for delete
  using (account_id = public.current_account_id());

grant select, insert, update, delete on public.employees to authenticated;
grant all on public.employees to postgres, service_role;

-- -------------------------------------------------------------------------
-- P5: subcontractors
-- Companies or individuals, grouped by service type per roadmap F5.2.
-- -------------------------------------------------------------------------
create type subcontractor_service as enum (
  'contract_climbing',
  'crane',
  'log_truck',
  'stump_grinding',
  'stump_full_service'
);

create table public.subcontractors (
  id           uuid                   primary key default gen_random_uuid(),
  account_id   uuid                   not null references public.accounts(id) on delete cascade,
  name         text                   not null check (char_length(name) between 1 and 150),
  service      subcontractor_service  not null,
  contact      text,
  default_rate numeric(10,2)          check (default_rate >= 0),
  active       boolean                not null default true,
  created_at   timestamptz            not null default now()
);

create index subcontractors_account_idx on public.subcontractors (account_id);

alter table public.subcontractors enable row level security;

create policy subcontractors_select_own on public.subcontractors
  for select
  using (account_id = public.current_account_id());

create policy subcontractors_insert_own on public.subcontractors
  for insert
  with check (account_id = public.current_account_id());

create policy subcontractors_update_own on public.subcontractors
  for update
  using (account_id = public.current_account_id())
  with check (account_id = public.current_account_id());

create policy subcontractors_delete_own on public.subcontractors
  for delete
  using (account_id = public.current_account_id());

grant select, insert, update, delete on public.subcontractors to authenticated;
grant all on public.subcontractors to postgres, service_role;

-- -------------------------------------------------------------------------
-- P4+P5: proficiency matrix — employee × resource × optional size tier
-- level 1..10 mirrors the operator-skill slider on the calculator.
-- size_key is '' when the resource has no size matrix (e.g., "chipper").
-- -------------------------------------------------------------------------
create table public.proficiency (
  account_id   uuid     not null references public.accounts(id) on delete cascade,
  employee_id  uuid     not null references public.employees(id) on delete cascade,
  resource_key text     not null check (char_length(resource_key) between 1 and 64),
  size_key     text     not null default '' check (char_length(size_key) <= 32),
  level        smallint not null check (level between 1 and 10),
  primary key  (account_id, employee_id, resource_key, size_key)
);

create index proficiency_account_idx   on public.proficiency (account_id);
create index proficiency_employee_idx  on public.proficiency (employee_id);

alter table public.proficiency enable row level security;

create policy proficiency_select_own on public.proficiency
  for select
  using (account_id = public.current_account_id());

create policy proficiency_insert_own on public.proficiency
  for insert
  with check (account_id = public.current_account_id());

create policy proficiency_update_own on public.proficiency
  for update
  using (account_id = public.current_account_id())
  with check (account_id = public.current_account_id());

create policy proficiency_delete_own on public.proficiency
  for delete
  using (account_id = public.current_account_id());

grant select, insert, update, delete on public.proficiency to authenticated;
grant all on public.proficiency to postgres, service_role;
