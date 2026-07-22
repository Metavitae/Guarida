# Cross-border transport / quarantine stage — schema

Spec for "build the cross-border transport/quarantine stage" (created
2026-07-22T01:52:27Z), building the proposal from the prior check-and-propose
task per the founder's three confirmed decisions. Same pattern as every
other schema change this session: written for the founder to run in
Supabase's SQL Editor — CC has no DDL access.

## 1. New table (name is a placeholder — see note)

```sql
-- PLACEHOLDER table name, pending Wet Noses' own internal term for this
-- stage. Kept as a plain table with no special handling anywhere, so a
-- future rename is a simple `alter table ... rename to ...` plus updating
-- the handful of obvious references (this file, RLS policy names, the
-- frontend page) — nothing hardcodes the name anywhere unusual.
create table cross_border_transports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  animal_id uuid references animals(id),
  status text check (status in ('quarantine', 'in_transit', 'completed', 'cancelled')),
  destination_country text,
  destination_state text,
  quarantine_start date,
  quarantine_end date,
  transport_date date,
  responsible_person_id uuid references people(id),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table cross_border_transports enable row level security;

create policy "org members can view their org's cross-border transports"
  on cross_border_transports for select
  using (is_active_member(org_id));

create policy "org members can log cross-border transports"
  on cross_border_transports for insert
  with check (is_active_member(org_id));

create policy "org members can update their org's cross-border transports"
  on cross_border_transports for update
  using (is_active_member(org_id))
  with check (is_active_member(org_id));
```

Has an update policy (unlike `inventory_movements`, which is intentionally
append-only) — a transport record needs to actually progress through
quarantine → in_transit → completed/cancelled over time, so it's a real
mutable record, not a historical log entry.

## 2. Widen `animals.status` — done defensively, not by guessing the constraint's name

Postgres auto-names an inline `check (...)` constraint like
`<table>_<column>_check` by default, so `animals_status_check` is very
likely correct — but guessing wrong and silently no-op'ing would leave the
*old* 6-value constraint still active, and it would keep rejecting
`quarantine`/`in_transit` even after a *new* constraint was added (Postgres
requires all CHECK constraints on a column to pass simultaneously). To
avoid that failure mode entirely, this finds the real constraint by its
actual definition instead of assuming its name:

```sql
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'animals'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%status%';
  if con_name is not null then
    execute format('alter table animals drop constraint %I', con_name);
  end if;
end $$;

alter table animals add constraint animals_status_check
  check (status in (
    'in_care', 'fostered', 'adopted', 'transferred', 'deceased',
    'returned_to_owner', 'quarantine', 'in_transit'
  ));
```

Two new top-level values (`quarantine`, `in_transit`) as distinct states,
not folded into one — per the founder's explicit decision that these need
to be visible/distinguishable at a glance without opening the detail
table.

No automatic status-transition logic — staff log this manually, same as
every other status change elsewhere in the app, per instruction.
