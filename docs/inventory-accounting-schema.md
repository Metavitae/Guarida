# Inventory & expenses — schema additions

Spec for "build inventory and basic accounting tracking" (created
2026-07-22T00:40:45Z). Same pattern as every other schema change this
session: written for the founder to run in Supabase's SQL Editor — CC has
no DDL access.

## What already existed, checked before writing anything new

`inventory_items` and `expenses` were both already defined in the original
schema run (docs/access-model.md) and are real, live tables — confirmed by
inserting a real test row into each via service role, then confirming the
anon key could NOT see it, then confirming the founder's real active-admin
session COULD see it (the same two-sided test that caught the
`legal_references` RLS gap earlier tonight — this time both tables passed
cleanly in both directions, nothing to fix). Test rows deleted after.

`expenses.currency` already defaults to `'MXN'` and is a plain text code
column (no exchange-rate logic) — exactly the "store amount + currency
code, don't convert" pattern this task asked for, reused as-is.
`inventory_items.category` / `expenses.category` are both plain text, no
existing enum/check-constraint convention for category anywhere in the
schema — followed that same free-text approach for the new table below
rather than inventing a stricter pattern that doesn't exist elsewhere.

`inventory_items` was missing nothing needed. `expenses` was missing one
field the task asked for: `logged_by`.

## 1. Add `logged_by` to the existing `expenses` table

```sql
alter table expenses add column if not exists logged_by uuid references people(id);
```

## 2. New table: `inventory_movements`

History log, so a quantity update never silently erases how it got there —
same principle as why `cases` and `case_photos` keep records rather than
just current state.

```sql
create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  item_id uuid not null references inventory_items(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  quantity numeric not null check (quantity > 0),
  note text,
  logged_by uuid references people(id),
  created_at timestamptz not null default now()
);

alter table inventory_movements enable row level security;

create policy "org members can view their org's inventory movements"
  on inventory_movements for select
  using (is_active_member(org_id));

create policy "org members can log inventory movements"
  on inventory_movements for insert
  with check (is_active_member(org_id));
```

No update/delete policy on movements themselves - a logged movement is a
historical record, not something meant to be edited after the fact
(consistent with not building reconciliation/editing features, out of
scope per the task).

## 3. Bug found while building this, not part of the original task

Querying `people` directly as an authenticated (non-service-role) user
throws `infinite recursion detected in policy for relation "people"`
(Postgres 42P17) - a real, broken RLS policy on `people`, not a missing
one. Reproduced directly against the founder's own real, active session.
`memberships` is unaffected (tested the same way, works correctly) - only
`people` itself is broken.

**Not fixed here** - diagnosing and fixing a recursive policy is real,
separate schema work outside this task's scope, and risky to guess at
blind. **Not currently breaking anything live**: checked every frontend
file in the deployed app - nothing queries `people` directly from the
client today (only two standalone backend scripts do, both using the
service-role key, which bypasses RLS entirely and never hits this).
Worth its own dedicated fix pass. Flagged plainly in the Log/ report
this doc's task responds to.

Practical workaround for *this* task: `log_inventory_movement()` below
needs to resolve the calling user's own `person_id`. Doing that with a
raw `select from people` would hit the same recursion bug. Added a small
`security definer` helper - same narrow pattern as the existing
`is_active_worker()` - that resolves only the caller's own id, sidestepping
the broken policy without touching or fixing it:

```sql
create or replace function my_person_id()
returns uuid
language sql security definer stable as $$
  select id from people where auth_user_id = auth.uid();
$$;

revoke all on function my_person_id from public;
grant execute on function my_person_id to authenticated;
```

## 4. Function: log a movement and update the item's quantity atomically

Deliberately **not** `security definer` itself (only the small helper
above is) - it runs as the calling user, so the existing RLS policies on
both tables still gate who can actually do this, the same as if the two
writes had been made directly. Also guards against stock going negative
(a basic correctness check, not the low-stock *alerting* the task
explicitly said not to build).

```sql
create or replace function log_inventory_movement(
  p_item_id uuid,
  p_direction text,
  p_quantity numeric,
  p_note text default null
)
returns inventory_items
language plpgsql
as $$
declare
  v_org_id uuid;
  v_person_id uuid;
  v_current_qty numeric;
  v_new_qty numeric;
  v_result inventory_items;
begin
  select org_id, quantity into v_org_id, v_current_qty
  from inventory_items where id = p_item_id;

  if v_org_id is null then
    raise exception 'inventory item not found';
  end if;

  v_person_id := my_person_id();

  if p_direction = 'in' then
    v_new_qty := v_current_qty + p_quantity;
  elsif p_direction = 'out' then
    v_new_qty := v_current_qty - p_quantity;
    if v_new_qty < 0 then
      raise exception 'Not enough stock: only % on hand', v_current_qty;
    end if;
  else
    raise exception 'direction must be ''in'' or ''out''';
  end if;

  insert into inventory_movements (org_id, item_id, direction, quantity, note, logged_by)
  values (v_org_id, p_item_id, p_direction, p_quantity, p_note, v_person_id);

  update inventory_items set quantity = v_new_qty, updated_at = now()
  where id = p_item_id
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function log_inventory_movement from public;
grant execute on function log_inventory_movement to authenticated;
```
