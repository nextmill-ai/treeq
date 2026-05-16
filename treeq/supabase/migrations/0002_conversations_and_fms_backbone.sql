-- TreeQ Stage 2 migration — conversations + knowledge + FMS backbone
--
-- Adds:
--   v0.1 user-facing:
--     - conversations         (daily threads, one per tenant+user+UTC date)
--     - conversation_turns    (individual user/assistant messages w/ tool calls)
--     - knowledge_sources     (per-tenant connector configs: Notion / GDrive / QBO / etc.)
--     - knowledge_documents   (individual indexed files/pages)
--     - knowledge_chunks      (RAG chunks w/ pgvector embedding)
--
--   FMS backbone (back-end shaped, no front-end yet):
--     - customers
--     - properties
--     - jobs
--     - job_tree_items
--     - job_events
--     - crews
--     - schedule_slots
--     - external_integrations
--
-- All new tables get RLS using the existing current_org_id() helper.
-- Embedding dim = 1536 to match OpenAI text-embedding-3-small.

------------------------------------------------------------
-- Extensions
------------------------------------------------------------
create extension if not exists vector;     -- pgvector for knowledge_chunks.chunk_embedding

------------------------------------------------------------
-- Enums
------------------------------------------------------------

create type conversation_role as enum ('user', 'assistant');

create type conversation_tool as enum (
  'ask_question',
  'answer_question',
  'finalize_estimate'
);

create type knowledge_source_kind as enum (
  'notion',
  'google_drive',
  'quickbooks',
  'jobber_csv',
  'file_upload'
);

create type knowledge_source_status as enum (
  'connected',
  'disconnected',
  'syncing',
  'error'
);

create type knowledge_doc_status as enum (
  'pending',
  'parsing',
  'embedding',
  'indexed',
  'failed'
);

create type customer_source as enum (
  'manual',
  'jobber',
  'qbo',
  'tenant_app',
  'webform',
  'import_csv'
);

create type job_status as enum (
  'lead',
  'estimated',
  'approved',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled'
);

create type tree_action as enum (
  'remove',
  'prune',
  'cable',
  'treat',
  'inspect',
  'plant'
);

create type job_event_type as enum (
  'note',
  'photo',
  'status_change',
  'crew_check_in',
  'crew_check_out',
  'customer_message',
  'invoice_sent',
  'payment_received'
);

create type schedule_slot_status as enum (
  'planned',
  'in_progress',
  'completed',
  'missed',
  'cancelled'
);

create type external_integration_kind as enum (
  'jobber',
  'qbo',
  'stripe',
  'twilio',
  'quo',
  'fcm',
  'notion',
  'google_drive'
);

create type external_integration_status as enum (
  'pending',
  'connected',
  'disconnected',
  'error',
  'token_expired'
);

------------------------------------------------------------
-- Conversations
-- One row per (org, user, UTC date). conversation_turns rolls up under it.
------------------------------------------------------------
create table conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  thread_date date not null,                  -- UTC date the thread covers
  title text,                                 -- optional human label
  message_count integer not null default 0,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id, thread_date)
);
create index conversations_org_user_date_idx on conversations(org_id, user_id, thread_date desc);
create index conversations_org_recent_idx on conversations(org_id, last_message_at desc nulls last);

create table conversation_turns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  turn_index integer not null,
  role conversation_role not null,
  content_json jsonb not null,                  -- raw Anthropic content blocks
  text_preview text,                            -- short flattened preview for grep
  tool_name conversation_tool,                  -- null for plain text turns
  referenced_quote_id uuid references quotes(id) on delete set null,
  citations_json jsonb,                         -- answer_question: [{title, snippet, kind, ref_id}, ...]
  tokens_in integer,
  tokens_out integer,
  latency_ms integer,
  created_at timestamptz not null default now()
);
create index conv_turns_conversation_idx on conversation_turns(conversation_id, turn_index);
create index conv_turns_org_idx on conversation_turns(org_id, created_at desc);
create index conv_turns_quote_idx on conversation_turns(referenced_quote_id) where referenced_quote_id is not null;

------------------------------------------------------------
-- Knowledge sources, documents, chunks (RAG layer)
------------------------------------------------------------
create table knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  kind knowledge_source_kind not null,
  display_name text not null,
  config_json jsonb not null default '{}'::jsonb,
  status knowledge_source_status not null default 'connected',
  last_synced_at timestamptz,
  last_error text,
  document_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index knowledge_sources_org_idx on knowledge_sources(org_id);
create index knowledge_sources_org_kind_idx on knowledge_sources(org_id, kind);

create table knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  source_id uuid not null references knowledge_sources(id) on delete cascade,
  external_id text,                              -- Notion page id, GDrive file id, etc.
  title text not null,
  uri text,                                      -- canonical URL back to the source if any
  mime_type text,
  size_bytes integer,
  indexed_status knowledge_doc_status not null default 'pending',
  indexed_status_detail text,
  chunk_count integer not null default 0,
  last_indexed_at timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id)
);
create index knowledge_documents_org_idx on knowledge_documents(org_id);
create index knowledge_documents_source_idx on knowledge_documents(source_id);
create index knowledge_documents_status_idx on knowledge_documents(org_id, indexed_status);

create table knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  document_id uuid not null references knowledge_documents(id) on delete cascade,
  position_in_doc integer not null,
  chunk_text text not null,
  chunk_embedding vector(1536),
  token_count integer,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index knowledge_chunks_doc_idx on knowledge_chunks(document_id, position_in_doc);
create index knowledge_chunks_org_idx on knowledge_chunks(org_id);

-- HNSW index for cosine similarity. pgvector >= 0.5 (Supabase ships 0.7+).
-- Application MUST also filter by org_id in WHERE for tenant isolation.
create index knowledge_chunks_embedding_hnsw_idx
  on knowledge_chunks
  using hnsw (chunk_embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

------------------------------------------------------------
-- FMS backbone — back-end shaped only for now
------------------------------------------------------------

create table customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  primary_phone text,
  primary_email text,
  addresses_json jsonb not null default '[]'::jsonb,
  source customer_source not null default 'manual',
  external_ids_json jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_org_idx on customers(org_id);
create index customers_org_phone_idx on customers(org_id, primary_phone);
create index customers_org_email_idx on customers(org_id, lower(primary_email));
create index customers_org_name_idx on customers(org_id, lower(name));

create table properties (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  address text not null,
  city text,
  state text,
  zip text,
  lat double precision,
  lng double precision,
  access_notes text,
  gate_code text,
  dog_warning boolean not null default false,
  trees_json jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index properties_org_idx on properties(org_id);
create index properties_customer_idx on properties(customer_id);
create index properties_org_geo_idx on properties(org_id, lat, lng);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  property_id uuid references properties(id) on delete set null,
  primary_quote_id uuid references quotes(id) on delete set null,
  status job_status not null default 'lead',
  service_lines text[] not null default '{}',
  scheduled_for date,
  scheduled_window text,
  completed_at timestamptz,
  total_quoted numeric(10,2),
  total_invoiced numeric(10,2),
  total_paid numeric(10,2),
  external_ids_json jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_org_idx on jobs(org_id);
create index jobs_org_status_idx on jobs(org_id, status);
create index jobs_org_scheduled_idx on jobs(org_id, scheduled_for);
create index jobs_customer_idx on jobs(customer_id);
create index jobs_property_idx on jobs(property_id);
create index jobs_quote_idx on jobs(primary_quote_id) where primary_quote_id is not null;

create table job_tree_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  species_key text,
  dbh numeric(6,2),
  height_ft numeric(6,2),
  crown_radius_ft numeric(6,2),
  lean text,
  structure_proximity text,
  action tree_action not null default 'remove',
  photos_json jsonb not null default '[]'::jsonb,
  estimated_subtotal numeric(10,2),
  actual_subtotal numeric(10,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index job_tree_items_job_idx on job_tree_items(job_id);
create index job_tree_items_org_idx on job_tree_items(org_id);

create table job_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  event_type job_event_type not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references users(id) on delete set null,
  external_source text,
  external_event_id text,
  created_at timestamptz not null default now()
);
create index job_events_job_idx on job_events(job_id, created_at desc);
create index job_events_org_idx on job_events(org_id, created_at desc);
create index job_events_org_type_idx on job_events(org_id, event_type);

create table crews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  lead_user_id uuid references users(id) on delete set null,
  member_user_ids uuid[] not null default '{}',
  default_equipment text[] not null default '{}',
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crews_org_idx on crews(org_id);
create index crews_org_active_idx on crews(org_id, is_active);

create table schedule_slots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  crew_id uuid references crews(id) on delete set null,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  status schedule_slot_status not null default 'planned',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end > scheduled_start)
);
create index schedule_slots_org_window_idx on schedule_slots(org_id, scheduled_start);
create index schedule_slots_crew_window_idx on schedule_slots(crew_id, scheduled_start);
create index schedule_slots_job_idx on schedule_slots(job_id);

create table external_integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  kind external_integration_kind not null,
  display_name text,
  oauth_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  config_json jsonb not null default '{}'::jsonb,
  status external_integration_status not null default 'pending',
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, kind)
);
create index external_integrations_org_idx on external_integrations(org_id);

------------------------------------------------------------
-- updated_at triggers for the new tables
------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'conversations',
      'knowledge_sources',
      'knowledge_documents',
      'customers',
      'properties',
      'jobs',
      'job_tree_items',
      'crews',
      'schedule_slots',
      'external_integrations'
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
-- Same pattern as 0001: every operational table scoped to current_org_id().
------------------------------------------------------------
alter table conversations          enable row level security;
alter table conversation_turns     enable row level security;
alter table knowledge_sources      enable row level security;
alter table knowledge_documents    enable row level security;
alter table knowledge_chunks       enable row level security;
alter table customers              enable row level security;
alter table properties             enable row level security;
alter table jobs                   enable row level security;
alter table job_tree_items         enable row level security;
alter table job_events             enable row level security;
alter table crews                  enable row level security;
alter table schedule_slots         enable row level security;
alter table external_integrations  enable row level security;

create policy org_isolation_conversations on conversations
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy org_isolation_conversation_turns on conversation_turns
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy org_isolation_knowledge_sources on knowledge_sources
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy org_isolation_knowledge_documents on knowledge_documents
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy org_isolation_knowledge_chunks on knowledge_chunks
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy org_isolation_customers on customers
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy org_isolation_properties on properties
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy org_isolation_jobs on jobs
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy org_isolation_job_tree_items on job_tree_items
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy org_isolation_job_events on job_events
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy org_isolation_crews on crews
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy org_isolation_schedule_slots on schedule_slots
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy org_isolation_external_integrations on external_integrations
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

------------------------------------------------------------
-- Helper RPC: vector search scoped to current_org_id().
-- Edge Function with service-role key calls this directly.
------------------------------------------------------------
create or replace function match_knowledge_chunks(
  p_org_id uuid,
  p_query_embedding vector(1536),
  p_match_count integer default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_title text,
  document_source_kind knowledge_source_kind,
  chunk_text text,
  similarity real,
  metadata_json jsonb,
  external_id text
)
language sql
stable
as $$
  select
    c.id as chunk_id,
    c.document_id,
    d.title as document_title,
    s.kind as document_source_kind,
    c.chunk_text,
    1 - (c.chunk_embedding <=> p_query_embedding) as similarity,
    c.metadata_json,
    d.external_id
  from knowledge_chunks c
  join knowledge_documents d on d.id = c.document_id
  join knowledge_sources s on s.id = d.source_id
  where c.org_id = p_org_id
    and c.chunk_embedding is not null
  order by c.chunk_embedding <=> p_query_embedding
  limit p_match_count;
$$;

-- END STAGE 2
