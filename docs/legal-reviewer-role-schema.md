# legal_reviewer role — schema

Spec for "add a distinct legal_reviewer role, scoped narrowly to
legal_references only" (created 2026-07-22T02:32:19Z). Same pattern as
every other schema change this session: written for the founder to run
in Supabase's SQL Editor — CC has no DDL access.

## What was checked before writing anything, not assumed

- `memberships.role`'s real constraint name: `memberships_role_check` —
  didn't need the defensive lookup used for `animals.status`, because a
  real insert attempt with `role: 'legal_reviewer'` failed with a
  constraint-violation error that names the constraint directly
  (`violates check constraint "memberships_role_check"`). Confirmed by
  the database itself, not guessed.
- Whether admin already has UPDATE access to `legal_references` (the
  task's framing assumed "admin retains" it): tested directly with the
  founder's real session — a real PATCH returned **HTTP 200 with an
  empty array**, the exact same silent-RLS-block pattern that hit
  `legal_references` SELECT earlier tonight before that got fixed. There
  is currently no UPDATE policy on this table at all — not even for
  admin. So this task also has to *create* that access, not just
  preserve something that already existed.
- `legal_references.reviewed_by`'s real type: **`text`, not `uuid`**
  (unlike `case_photos.reviewed_by`, which is a `uuid` FK to `people`).
  Confirmed via the live schema before writing anything that would have
  wrongly tried to store a person id there. The UI below uses the
  reviewer's session email as plain text for this field instead of a
  `people` lookup — which also has the side benefit of never touching
  `people`'s still-broken recursive RLS policy for this feature at all.

## 1. Widen `memberships.role`

```sql
alter table memberships drop constraint memberships_role_check;

alter table memberships add constraint memberships_role_check
  check (role in (
    'admin', 'staff', 'volunteer', 'foster', 'vet', 'donor', 'investor',
    'legal_reviewer'
  ));
```

## 2. Helper functions

`is_admin()` and `is_legal_reviewer()` mirror the existing
`is_active_worker()` pattern (any org, not org-scoped — this app has no
per-org routing yet, same reasoning as before). `can_review_legal()`
combines them for a single round-trip from the frontend/middleware.

```sql
create or replace function is_admin()
returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from memberships m
    join people p on p.id = m.person_id
    where p.auth_user_id = auth.uid()
      and m.status = 'active'
      and m.role = 'admin'
  );
$$;

create or replace function is_legal_reviewer()
returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from memberships m
    join people p on p.id = m.person_id
    where p.auth_user_id = auth.uid()
      and m.status = 'active'
      and m.role = 'legal_reviewer'
  );
$$;

create or replace function can_review_legal()
returns boolean
language sql security definer stable as $$
  select is_admin() or is_legal_reviewer();
$$;

revoke all on function is_admin from public;
revoke all on function is_legal_reviewer from public;
revoke all on function can_review_legal from public;
grant execute on function is_admin to authenticated;
grant execute on function is_legal_reviewer to authenticated;
grant execute on function can_review_legal to authenticated;
```

## 3. New UPDATE policy on `legal_references`

Additive — the existing public SELECT policy (`legal_references are
publicly readable`) is untouched, since case-intake's live legal-match
suggestions still need anon/authenticated read access. This only adds
write access, scoped to admin and legal_reviewer specifically — not
staff/vet/anyone else `is_active_worker()` would otherwise cover.

```sql
create policy "admin and legal_reviewer can edit legal references"
  on legal_references for update
  using (is_admin() or is_legal_reviewer())
  with check (is_admin() or is_legal_reviewer());
```

No INSERT/DELETE policy — adding new jurisdictions (the queued
Oregon/BC/Alberta task) and any removals stay a service-role/founder
action for now, per this task's explicit scope (role/UI infrastructure
only, not the data-entry task).

## 4. Real gap found during verification, not part of the original plan — needs this fix to actually be done

Tested a disposable legal_reviewer-only account directly against every
other table, not just legal_references (per this task's own "test each
table directly, don't assume" instruction). Result: **every org-scoped
table currently uses the same "any active member of this org" SELECT
policy, with no role differentiation at all** — `legal_reviewer` inherits
the exact same broad read access as any other member. Confirmed
decisively (not from ambiguous empty results) by inserting real rows into
`cases`, `donors`, `expenses`, and `inventory_items` via service role,
then confirming the legal_reviewer-only account could read all four. This
directly contradicts the task's own stated principle (least access
needed) and its explicit verification requirement.

Fix: one **restrictive** policy per table, excluding `legal_reviewer`
specifically. Restrictive policies AND with whatever permissive policy
already exists on a table, so this doesn't require knowing or touching
any existing policy's definition — it only narrows access, and only for
accounts holding the `legal_reviewer` role. Every other role's existing
access is completely unaffected (`is_legal_reviewer()` is false for them,
so `not is_legal_reviewer()` is true, and the restriction is a no-op).

```sql
do $$
declare
  t text;
begin
  foreach t in array array[
    'animals', 'case_legal_matches', 'case_media', 'case_photos', 'cases',
    'donations', 'donors', 'emergency_contacts', 'expenses',
    'foster_placements', 'inventory_items', 'inventory_movements',
    'memberships', 'organizations', 'vet_notifications',
    'cross_border_transports'
  ]
  loop
    execute format(
      'create policy %I on %I as restrictive for all using (not is_legal_reviewer()) with check (not is_legal_reviewer())',
      'legal_reviewer excluded from ' || t, t
    );
  end loop;
end $$;
```

`people` is deliberately not in this list — it's already unreadable to
every authenticated non-service-role account (the standing recursion bug
flagged during the inventory/expenses task), so legal_reviewer is already
incidentally blocked from it. `legal_references` is also excluded, since
that's the one table this role is meant to access.
