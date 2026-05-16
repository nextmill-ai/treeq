-- TreeQ migration 0003 — transcriptions log.
-- Every Whisper call lands here so we can audit accuracy on chainsaw-adjacent audio.

create table transcriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete set null,
  user_id uuid references users(id) on delete set null,
  model text not null,                              -- 'gpt-4o-mini-transcribe' | 'whisper-1' | ...
  media_type text not null,                         -- e.g. 'audio/webm'
  duration_sec numeric(8,2),
  size_bytes integer,
  text text,
  latency_ms integer,
  cost_usd numeric(10,5),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index transcriptions_org_idx on transcriptions(org_id, created_at desc);
create index transcriptions_user_idx on transcriptions(user_id, created_at desc);

alter table transcriptions enable row level security;

-- org members can see their tenant's transcriptions; service-role bypasses.
create policy org_isolation_transcriptions on transcriptions
  using (org_id is null or org_id = current_org_id())
  with check (org_id is null or org_id = current_org_id());

-- END 0003
