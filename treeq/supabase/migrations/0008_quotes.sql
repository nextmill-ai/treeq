-- Migration 0008: CRM quotes + line items + state machine
-- Depends on: 0007_customers_properties.sql
--
-- The quote_status enum is defined in 0001 (draft/sent/won/lost/dead/escalated).
-- We reuse it here. escalated is not used by the human-built CRM flow but
-- is kept in the enum for the LLM estimator legacy quotes.
--
-- Per-account quote numbering: accounts.next_quote_number column + BEFORE-INSERT
-- trigger atomically assigns crm_quotes.quote_number from that counter.

-- 1. Add per-account quote counter (idempotent)
alter table public.accounts
  add column if not exists next_quote_number integer not null default 1;

-- crm_quotes
create table public.crm_quotes (
  id                  uuid        primary key default gen_random_uuid(),
  account_id          uuid        not null references public.accounts(id) on delete cascade,
  customer_id         uuid        references public.crm_customers(id) on delete set null,
  property_id         uuid        references public.crm_properties(id) on delete set null,
  quote_number        integer     not null,
  status              quote_status not null default 'draft',
  total_cents         integer     not null default 0 check (total_cents >= 0),
  snapshot_jsonb      jsonb       not null default '{}'::jsonb,
  notes               text,
  created_by_user_id  uuid        references public.profiles(id) on delete set null,
  sent_at             timestamptz,
  won_at              timestamptz,
  lost_at             timestamptz,
  archived_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (account_id, quote_number)
);

create index crm_quotes_account_status_created_idx
  on public.crm_quotes (account_id, status, created_at desc);
create index crm_quotes_account_customer_idx
  on public.crm_quotes (account_id, customer_id);
create index crm_quotes_account_active_idx
  on public.crm_quotes (account_id, archived_at)
  where archived_at is null;

create trigger crm_quotes_set_updated_at
  before update on public.crm_quotes
  for each row execute function public.set_updated_at();

create or replace function public.assign_quote_number()
returns trigger
language plpgsql
as $$
declare
  next_n integer;
begin
  if new.quote_number is null or new.quote_number = 0 then
    update public.accounts
       set next_quote_number = next_quote_number + 1
     where id = new.account_id
    returning next_quote_number - 1 into next_n;

    if next_n is null then
      raise exception 'account % not found for quote_number assignment', new.account_id;
    end if;

    new.quote_number := next_n;
  end if;
  return new;
end;
$$;

create trigger crm_quotes_assign_number
  before insert on public.crm_quotes
  for each row execute function public.assign_quote_number();

alter table public.crm_quotes enable row level security;

create policy crm_quotes_select_own on public.crm_quotes
  for select
  using (account_id = public.current_account_id());

create policy crm_quotes_insert_writer on public.crm_quotes
  for insert
  with check (
    account_id = public.current_account_id()
    and public.current_role() in ('owner','admin','estimator')
  );

create policy crm_quotes_update_writer on public.crm_quotes
  for update
  using (
    account_id = public.current_account_id()
    and public.current_role() in ('owner','admin','estimator')
  )
  with check (account_id = public.current_account_id());

create policy crm_quotes_delete_admin on public.crm_quotes
  for delete
  using (
    account_id = public.current_account_id()
    and public.current_role() in ('owner','admin')
  );

grant select, insert, update, delete on public.crm_quotes to authenticated;
grant all on public.crm_quotes to postgres, service_role;

-- crm_quote_lines
create table public.crm_quote_lines (
  id              uuid        primary key default gen_random_uuid(),
  quote_id        uuid        not null references public.crm_quotes(id) on delete cascade,
  account_id      uuid        not null references public.accounts(id) on delete cascade,
  line_type       text        not null
                    check (line_type in (
                      'tree_removal','tree_trim','takedown','stump',
                      'haul','land_clearing','landscaping','phc',
                      'planting','labor','adjustment','other'
                    )),
  label           text        not null check (char_length(label) between 1 and 200),
  detail          text,
  amount_cents    integer     not null default 0,
  sort_order      smallint    not null default 0,
  created_at      timestamptz not null default now()
);

create index crm_quote_lines_quote_idx
  on public.crm_quote_lines (quote_id, sort_order);
create index crm_quote_lines_account_idx
  on public.crm_quote_lines (account_id);

alter table public.crm_quote_lines enable row level security;

create policy crm_quote_lines_select_own on public.crm_quote_lines
  for select
  using (account_id = public.current_account_id());

create policy crm_quote_lines_insert_writer on public.crm_quote_lines
  for insert
  with check (
    account_id = public.current_account_id()
    and public.current_role() in ('owner','admin','estimator')
  );

create policy crm_quote_lines_update_writer on public.crm_quote_lines
  for update
  using (
    account_id = public.current_account_id()
    and public.current_role() in ('owner','admin','estimator')
  )
  with check (account_id = public.current_account_id());

create policy crm_quote_lines_delete_writer on public.crm_quote_lines
  for delete
  using (
    account_id = public.current_account_id()
    and public.current_role() in ('owner','admin','estimator')
  );

grant select, insert, update, delete on public.crm_quote_lines to authenticated;
grant all on public.crm_quote_lines to postgres, service_role;

-- crm_quote_state_changes -- append-only audit trail
create table public.crm_quote_state_changes (
  id                  uuid        primary key default gen_random_uuid(),
  quote_id            uuid        not null references public.crm_quotes(id) on delete cascade,
  account_id          uuid        not null references public.accounts(id) on delete cascade,
  from_status         quote_status,
  to_status           quote_status not null,
  changed_by_user_id  uuid        references public.profiles(id) on delete set null,
  notes               text,
  changed_at          timestamptz not null default now()
);

create index crm_quote_state_changes_quote_idx
  on public.crm_quote_state_changes (quote_id, changed_at desc);
create index crm_quote_state_changes_account_idx
  on public.crm_quote_state_changes (account_id, changed_at desc);

alter table public.crm_quote_state_changes enable row level security;

create policy crm_qsc_select_own on public.crm_quote_state_changes
  for select
  using (account_id = public.current_account_id());

create policy crm_qsc_insert_writer on public.crm_quote_state_changes
  for insert
  with check (
    account_id = public.current_account_id()
    and public.current_role() in ('owner','admin','estimator')
  );

-- No update/delete: audit trail is append-only at policy level.

grant select, insert on public.crm_quote_state_changes to authenticated;
grant all on public.crm_quote_state_changes to postgres, service_role;
