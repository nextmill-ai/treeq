-- TreeQ Stage 1 Supabase migration
-- Tenant-scoped operational data + estimator I/O log.
-- Mirrors the SpartanTreeNY Notion schemas (Dump Spots, Vendors, Subcontractors,
-- Plant Price Comparison, Materials / Pickup Spots / Material Pricing).
--
-- Conventions:
--   - UUID primary keys (gen_random_uuid())
--   - TIMESTAMPTZ for all timestamps
--   - All operational tables have org_id (FK -> organizations) and RLS enabled
--   - Multi-select fields stored as TEXT[] with CHECK constraints
--   - Single-select fields use ENUM types where the values are stable

------------------------------------------------------------
-- Extensions
------------------------------------------------------------
create extension if not exists pgcrypto;          -- gen_random_uuid()
create extension if not exists "uuid-ossp";

------------------------------------------------------------
-- Enums
------------------------------------------------------------

-- Dump-spot fee model
create type dump_fee_type as enum ('free', 'flat_fee', 'per_yard', 'per_ton');

-- Pickup-spot pricing model
create type pickup_price_type as enum ('free', 'flat_fee', 'per_yard', 'per_ton', 'per_bag');

-- Material-price unit of measure
create type material_price_unit as enum ('per_yard', 'per_ton', 'per_bag', 'each', 'per_pallet');

-- Vendor primary categorization
create type vendor_category as enum (
  'tree_work_supplies',
  'landscaping_supplies',
  'equipment_supplier',
  'landfill_yard',
  'plant_nursery',
  'auto_shop',
  'equipment_repair_center',
  'mobile_repair',
  'trailers',
  'tire_center'
);

-- Vendor active state (NEW — solves the "Permanently Closed" mismodel from Notion)
create type vendor_status as enum ('active', 'permanently_closed', 'out_of_business');

-- Subcontractor active state
create type subcontractor_status as enum ('trial', 'active', 'inactive');

-- Plant price availability
create type plant_availability as enum ('to_check', 'backordered', 'in_stock');

-- Estimator outcome
create type quote_status as enum (
  'draft',        -- created but not yet sent to customer
  'sent',         -- price quoted to customer
  'won',          -- customer accepted
  'lost',         -- customer declined
  'dead',         -- went cold / never closed
  'escalated'     -- LLM flagged for owner review
);

-- Estimator engine used
create type estimator_engine as enum ('llm_sonnet', 'llm_opus', 'math_v1', 'manual');

------------------------------------------------------------
-- Reference data: vocab tables for multi-select TEXT[] columns
-- These exist so we can validate inputs and grow the lists without DDL changes.
------------------------------------------------------------

create table dump_material_types (
  value text primary key,
  display_name text not null,
  sort_order integer not null default 0
);

insert into dump_material_types (value, display_name, sort_order) values
  ('hardwood_logs',     'Hardwood Logs',     10),
  ('softwood_logs',     'Softwood Logs',     20),
  ('chips',             'Chips',             30),
  ('stumps',            'Stumps',            40),
  ('clean_fill',        'Clean Fill',        50),
  ('mixed_green_waste', 'Mixed Green Waste', 60);

create table pickup_material_types (
  value text primary key,
  display_name text not null,
  sort_order integer not null default 0
);

insert into pickup_material_types (value, display_name, sort_order) values
  ('topsoil', 'Topsoil', 10),
  ('mulch',   'Mulch',   20),
  ('stone',   'Stone',   30),
  ('plants',  'Plants',  40);

create table subcontractor_services (
  value text primary key,
  display_name text not null,
  sort_order integer not null default 0
);

insert into subcontractor_services (value, display_name, sort_order) values
  ('climbing',        'Climbing',        10),
  ('stump_grinding',  'Stump Grinding',  20),
  ('crane_operation', 'Crane Operation', 30),
  ('skid_steer',      'Skid Steer',      40),
  ('hauling',         'Hauling',         50),
  ('plowing',         'Plowing',         60),
  ('landscaping',     'Landscaping',     70),
  ('hardscape',       'Hardscape',       80),
  ('fencing',         'Fencing',         90),
  ('carpentry',       'Carpentry',       100),
  ('gutters',         'Gutters',         110),
  ('roofing',         'Roofing',         120),
  ('tree_service',    'Tree Service',    130),
  ('paving',          'Paving',          140),
  ('lawn_mowing',     'Lawn Mowing',     150),
  ('sealcoating',     'Sealcoating',     160),
  ('plumbing',        'Plumbing',        170);

create table subcontractor_equipment (
  value text primary key,
  display_name text not null,
  sort_order integer not null default 0
);

insert into subcontractor_equipment (value, display_name, sort_order) values
  ('bucket_truck',  'Bucket Truck',  10),
  ('crane',         'Crane',         20),
  ('stump_grinder', 'Stump Grinder', 30),
  ('chipper',       'Chipper',       40),
  ('mini_skid',     'Mini Skid',     50),
  ('loader',        'Loader',        60),
  ('dump_trailer',  'Dump Trailer',  70),
  ('log_truck',     'Log Truck',     80),
  ('paver',         'Paver',         90),
  ('snowplow',      'Snowplow',      100),
  ('lawn_mower',    'Lawn Mower',    110);

create table vendor_service_offerings (
  value text primary key,
  display_name text not null,
  sort_order integer not null default 0
);

insert into vendor_service_offerings (value, display_name, sort_order) values
  ('tires',              'Tires',              10),
  ('inspections',        'Inspections',        20),
  ('brakes',             'Brakes',             30),
  ('alignment',          'Alignment',          40),
  ('welding',            'Welding',            50),
  ('repair',             'Repair',             60),
  ('mobile_repair',      'Mobile Repair',      70),
  ('campers',            'Campers',            80),
  ('equipment_rental',   'Equipment Rental',   90),
  ('equipment_repair',   'Equipment Repair',   100),
  ('small_engine_repair','Small Engine Repair',110),
  ('transport',          'Transport',          120),
  ('waste_disposal',     'Waste Disposal',     130),
  ('dumpsters',          'Dumpsters',          140);
-- NOTE: "Permanently Closed" intentionally NOT in vendor service offerings here —
-- it's a status, captured on vendors.status (vendor_status enum).

------------------------------------------------------------
-- Tenant scaffolding
------------------------------------------------------------

create table organizations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                     -- 'spartan', 'powell', etc.
  name text not null,
  primary_market text,                            -- e.g. 'Rochester NY'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed Spartan as the first tenant
insert into organizations (slug, name, primary_market) values
  ('spartan', 'Spartan Tree & Landscape', 'Rochester NY');

create table users (
  id uuid primary key default gen_random_uuid(),  -- matches auth.users.id when wired to Supabase Auth
  org_id uuid not null references organizations(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null default 'member',            -- 'owner' | 'admin' | 'salesperson' | 'crew' | 'member'
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index users_org_idx on users(org_id);

------------------------------------------------------------
-- Vendors (mirrors Notion 🧰 Vendors)
------------------------------------------------------------
create table vendors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  notion_id text,                                 -- original Notion page ID for sync
  name text not null,
  category vendor_category,
  status vendor_status not null default 'active',
  service_offerings text[] not null default '{}',
  contact_name text,
  phone text,
  email text,
  website text,
  location text,
  lat double precision,
  lng double precision,
  preferred boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendors_service_offerings_valid
    check (service_offerings <@ (select array_agg(value) from vendor_service_offerings))
);
create index vendors_org_idx on vendors(org_id);
create index vendors_org_category_idx on vendors(org_id, category);
create index vendors_org_status_idx on vendors(org_id, status);
create index vendors_notion_idx on vendors(notion_id) where notion_id is not null;

------------------------------------------------------------
-- Dump Spots (mirrors Notion 🗺️ Dump Spots)
------------------------------------------------------------
create table dump_spots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  notion_id text,
  site_name text not null,
  lat double precision,
  lng double precision,
  hours text,
  materials_accepted text[] not null default '{}',
  fee_type dump_fee_type,
  typical_fee numeric(10,2),
  access_notes text,
  contact_phone text,
  field_contact_vendor_id uuid references vendors(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dump_spots_materials_valid
    check (materials_accepted <@ (select array_agg(value) from dump_material_types))
);
create index dump_spots_org_idx on dump_spots(org_id);
create index dump_spots_org_geo_idx on dump_spots(org_id, lat, lng);
create index dump_spots_notion_idx on dump_spots(notion_id) where notion_id is not null;

------------------------------------------------------------
-- Subcontractors (mirrors Notion 🛠️ Subcontractors)
------------------------------------------------------------
create table subcontractors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  notion_id text,
  company_or_contact_name text not null,
  status subcontractor_status not null default 'trial',
  services text[] not null default '{}',
  equipment text[] not null default '{}',
  rate numeric(10,2),                             -- $/hr; null = unknown
  insurance_expires date,
  w9_on_file boolean not null default false,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subs_services_valid
    check (services <@ (select array_agg(value) from subcontractor_services)),
  constraint subs_equipment_valid
    check (equipment <@ (select array_agg(value) from subcontractor_equipment))
);
create index subs_org_idx on subcontractors(org_id);
create index subs_org_status_idx on subcontractors(org_id, status);
create index subs_org_insurance_idx on subcontractors(org_id, insurance_expires);
create index subs_notion_idx on subcontractors(notion_id) where notion_id is not null;

------------------------------------------------------------
-- Plant Price Comparison (mirrors Notion 🌱 Plant Price Comparison)
-- A plant_price is one (vendor=nursery, plant, size, date) observation.
------------------------------------------------------------
create table plant_prices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  notion_id text,
  plant_name text not null,                        -- the title in Notion
  species_common_name text,
  nursery_vendor_id uuid references vendors(id) on delete set null,
  size text,                                       -- container / caliper
  price numeric(10,2),
  price_date date,
  availability plant_availability not null default 'to_check',
  product_url text,
  sku text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plant_prices_org_idx on plant_prices(org_id);
create index plant_prices_org_plant_idx on plant_prices(org_id, lower(plant_name));
create index plant_prices_nursery_idx on plant_prices(nursery_vendor_id);
create index plant_prices_notion_idx on plant_prices(notion_id) where notion_id is not null;

------------------------------------------------------------
-- Pickup Spots (mirrors Notion Pickup Spots under Materials page)
------------------------------------------------------------
create table pickup_spots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  notion_id text,
  site_name text not null,
  lat double precision,
  lng double precision,
  hours text,
  materials_available text[] not null default '{}',
  sat_open boolean not null default false,
  sun_open boolean not null default false,
  price_type pickup_price_type,
  typical_price numeric(10,2),
  access_notes text,
  contact_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pickup_materials_valid
    check (materials_available <@ (select array_agg(value) from pickup_material_types))
);
create index pickup_spots_org_idx on pickup_spots(org_id);
create index pickup_spots_org_geo_idx on pickup_spots(org_id, lat, lng);
create index pickup_spots_notion_idx on pickup_spots(notion_id) where notion_id is not null;

------------------------------------------------------------
-- Material Pricing (mirrors Notion 💲 Material Pricing)
-- Joins a pickup_spot to (material, unit, price_per_unit).
------------------------------------------------------------
create table material_prices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  notion_id text,
  pickup_spot_id uuid not null references pickup_spots(id) on delete cascade,
  material text not null references pickup_material_types(value),
  unit material_price_unit not null,
  price_per_unit numeric(10,2) not null,
  item_label text,                                  -- the "Item" title field in Notion
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index material_prices_org_idx on material_prices(org_id);
create index material_prices_spot_idx on material_prices(pickup_spot_id);
create index material_prices_material_idx on material_prices(org_id, material);

------------------------------------------------------------
-- Quotes — the estimator I/O log
-- Every salesperson request → Sonnet 4.6 response is one row here.
-- This is the training/calibration corpus for the future deterministic engine.
------------------------------------------------------------
create table quotes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references users(id) on delete set null,    -- the salesperson
  status quote_status not null default 'draft',
  engine estimator_engine not null,                        -- which estimator produced this

  -- Customer context (optional — captured for follow-up + outcome tracking)
  customer_name text,
  customer_phone text,
  customer_email text,
  job_address text,
  job_lat double precision,
  job_lng double precision,

  -- Salesperson inputs (what they submitted)
  description text,                                        -- free-text job description
  photos_json jsonb,                                       -- array of {url, role, taken_at}
  structured_inputs_json jsonb,                            -- species picker output, DBH, height, etc.

  -- Estimator output
  model_id text,                                           -- e.g. 'claude-sonnet-4-6'
  estimated_price numeric(10,2),
  estimated_price_low numeric(10,2),
  estimated_price_high numeric(10,2),
  line_items_json jsonb,                                   -- LLM-proposed breakdown
  reasoning text,                                          -- LLM-generated rationale (server-side only — do NOT show client)
  escalated boolean not null default false,
  escalate_reason text,                                    -- if escalated, why (e.g. crane, structure proximity, $-cap)

  -- Cost / token tracking
  prompt_tokens integer,
  completion_tokens integer,
  api_cost_usd numeric(10,4),

  -- Outcome (filled in after the fact for calibration)
  quoted_price numeric(10,2),                              -- what salesperson actually sent the customer
  sold_price numeric(10,2),                                -- what customer paid (if won)
  job_completed_at timestamptz,
  actual_hours_worked numeric(8,2),                        -- ground-truth labor for calibration
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quotes_org_idx on quotes(org_id);
create index quotes_org_user_idx on quotes(org_id, user_id);
create index quotes_org_status_idx on quotes(org_id, status);
create index quotes_org_created_idx on quotes(org_id, created_at desc);

------------------------------------------------------------
-- updated_at triggers
------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'organizations','users','vendors','dump_spots','subcontractors',
      'plant_prices','pickup_spots','material_prices','quotes'
    ])
  loop
    execute format(
      'create trigger %I_updated_at before update on %I for each row execute function set_updated_at()',
      t || '_set', t
    );
  end loop;
end$$;

------------------------------------------------------------
-- Row-Level Security
-- Pattern: each request must set the org_id via auth.jwt() or a
-- request-scoped GUC. Stage 1 uses a simple "user belongs to org" rule.
------------------------------------------------------------
alter table organizations    enable row level security;
alter table users            enable row level security;
alter table vendors          enable row level security;
alter table dump_spots       enable row level security;
alter table subcontractors   enable row level security;
alter table plant_prices     enable row level security;
alter table pickup_spots     enable row level security;
alter table material_prices  enable row level security;
alter table quotes           enable row level security;

-- Helper: current user's org_id (replace with real Supabase Auth lookup)
create or replace function current_org_id()
returns uuid
language sql
stable
as $$
  select org_id from users where id = auth.uid()
$$;

-- Org members can read/write their own org's data
create policy org_isolation_organizations on organizations
  using (id = current_org_id());

create policy org_isolation_users on users
  using (org_id = current_org_id());

create policy org_isolation_vendors on vendors
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy org_isolation_dump_spots on dump_spots
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy org_isolation_subcontractors on subcontractors
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy org_isolation_plant_prices on plant_prices
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy org_isolation_pickup_spots on pickup_spots
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy org_isolation_material_prices on material_prices
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy org_isolation_quotes on quotes
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

-- Server-side service-role key bypasses RLS for the Notion import / Edge Function
-- estimator → that's how Stage 1 writes to quotes before user auth is wired.

-- END STAGE 1
