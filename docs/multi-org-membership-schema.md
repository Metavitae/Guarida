# Multi-org membership support — schema

Spec for "Guarida - Direct Instructions for CC (2026-07-28, v3)" item 4
(support for a person belonging to more than one organization) — the
task's own words: "the one most likely to introduce a real data-leak
risk if done carelessly." Written for the founder to run in Supabase's
SQL Editor — CC has no DDL access, same as every other schema change
here.

## What already works, checked before writing anything

`memberships` (see `docs/access-model.md`) already supports a person
belonging to multiple orgs — it's `(org_id, person_id, role, status)`
with a uniqueness constraint on `(org_id, person_id, role)`, not on
`person_id` alone. No new join table needed; the task's own doc guessed
this might be missing, it isn't. Every org-scoped table's RLS
(`is_active_member(org_id)`) already checks membership **per table row's
own `org_id`**, so it was never possible for someone to read another
org's rows through those tables regardless of this task.

## The real gap

Two places assumed exactly one active org per person, silently:

1. **Role-check functions** (`is_active_worker()`, `is_admin_or_staff()`,
   `is_admin()`, `is_legal_reviewer()`, `can_review_legal()`) check "does
   this person have an active membership with this role in ANY org" -
   explicitly documented this way (`docs/worker-login-schema.md`: "the
   app has no per-org routing yet"). For someone active in two orgs with
   *different* roles, this means passing a role check based on whichever
   org happens to grant it, not the one they're currently acting in.
2. **Every screen's own "which org am I" query** (`donors`, `cross-border`,
   `expenses`, `inventory`, `prospects`, plus `case-intake`/`Nav` via
   `my_org()`) picks `.limit(1)` - the first row Postgres happens to
   return, with no ordering and no concept of a user's actual choice.

Neither of these leaks data through RLS (which stays correct per-row
regardless) - but both make "which org's role/data am I seeing" genuinely
undefined for a multi-org person, which is exactly the property this task
asked to fix.

## 1. Org-scoped overloads (additive - existing zero-arg calls untouched)

```sql
create or replace function is_active_worker(check_org_id uuid)
returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from memberships m
    join people p on p.id = m.person_id
    where p.auth_user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('admin', 'staff', 'vet')
      and m.org_id = check_org_id
  );
$$;

create or replace function is_admin_or_staff(check_org_id uuid)
returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from memberships m
    join people p on p.id = m.person_id
    where p.auth_user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('admin', 'staff')
      and m.org_id = check_org_id
  );
$$;

create or replace function is_admin(check_org_id uuid)
returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from memberships m
    join people p on p.id = m.person_id
    where p.auth_user_id = auth.uid()
      and m.status = 'active'
      and m.role = 'admin'
      and m.org_id = check_org_id
  );
$$;

create or replace function is_legal_reviewer(check_org_id uuid)
returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from memberships m
    join people p on p.id = m.person_id
    where p.auth_user_id = auth.uid()
      and m.status = 'active'
      and m.role = 'legal_reviewer'
      and m.org_id = check_org_id
  );
$$;

create or replace function can_review_legal(check_org_id uuid)
returns boolean
language sql security definer stable as $$
  select is_admin(check_org_id) or is_legal_reviewer(check_org_id);
$$;

revoke all on function is_active_worker(uuid) from public;
revoke all on function is_admin_or_staff(uuid) from public;
revoke all on function is_admin(uuid) from public;
revoke all on function is_legal_reviewer(uuid) from public;
revoke all on function can_review_legal(uuid) from public;
grant execute on function is_active_worker(uuid) to authenticated;
grant execute on function is_admin_or_staff(uuid) to authenticated;
grant execute on function is_admin(uuid) to authenticated;
grant execute on function is_legal_reviewer(uuid) to authenticated;
grant execute on function can_review_legal(uuid) to authenticated;
```

`create or replace function name(uuid)` is a distinct overload from the
existing `name()` (Postgres identifies functions by name **and**
parameter types) - the zero-arg versions keep working exactly as before
for anything that still calls them without an org id (there's nothing
left that does, after this task's own frontend changes, but nothing
breaks if there were). No `drop` needed for these five.

## 2. `my_orgs()` — list every org a person is active in (for the switcher)

```sql
create or replace function my_orgs()
returns table (org_id uuid, name text, role text)
language sql security definer stable as $$
  select o.id, o.name, m.role
  from organizations o
  join memberships m on m.org_id = o.id
  join people p on p.id = m.person_id
  where p.auth_user_id = auth.uid()
    and m.status = 'active'
  order by o.name;
$$;

revoke all on function my_orgs from public;
grant execute on function my_orgs to authenticated;
```

## 3. `my_org()` — needs an actual signature change, not an overload

Unlike the five functions above, `my_org()` (added in the tenant-scoping
audit, `docs/multi-tenant-audit-schema.md`) needs to accept an *optional*
org id and actually use it when given one - a same-shaped overload
wouldn't achieve that if the zero-arg version keeps existing separately
with its old `limit 1` behavior. This one needs `drop` + recreate:

```sql
drop function if exists my_org();

create function my_org(check_org_id uuid default null)
returns table (org_id uuid, name text, country text, jurisdiction_state text)
language sql security definer stable as $$
  select o.id, o.name, o.country, o.jurisdiction_state
  from organizations o
  join memberships m on m.org_id = o.id
  join people p on p.id = m.person_id
  where p.auth_user_id = auth.uid()
    and m.status = 'active'
    and (check_org_id is null or m.org_id = check_org_id)
  limit 1;
$$;

revoke all on function my_org from public;
grant execute on function my_org to authenticated;
```

Safe to drop: confirmed every existing call site is `supabase.rpc("my_org")`
with no arguments, and a defaulted parameter still resolves correctly
when PostgREST calls the function with an empty argument object - so
this is a no-op change for every caller unless CC's frontend changes
(below) start passing `check_org_id` explicitly.

## How the frontend uses these

`gd_current_org_id` cookie (set by a real choice via a new org-switcher
UI component, only shown to people with 2+ active orgs) is the source of
truth for "which org am I acting as right now." `middleware.js` and
every page that resolves "my org" now check this cookie first, falling
back to the exact same behavior as before (`limit 1` / zero-arg role
checks) when it's absent - which is every single-org person today,
including 100% of Wet Noses' current workers. **Nothing changes for
anyone until a second org and a multi-org person both actually exist.**
