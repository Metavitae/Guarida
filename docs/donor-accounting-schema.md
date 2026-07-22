# Donor CRUD + case-expense ledger — schema

Spec for "Guarida - Direct Instructions for CC" (Parts A & B, relayed
manually by the founder since Drive writes were failing on the chat
session's end). Written for the founder to run in Supabase's SQL Editor —
CC has no DDL access.

## What was checked before writing anything

- **`donors` already exists**, live, real (`docs/access-model.md`,
  confirmed real via a two-sided RLS test in an earlier session per
  `docs/inventory-accounting-schema.md`): `name`, `contact`, `donor_type`
  (`prospect`/`donor`/`investor`), `stage`, `notes`. No new table —
  donors are their own table, not `people` rows with a role, and nothing
  here needed changing to match the task's field list.
- **`expenses.case_id` already exists** (`references cases(id)`,
  nullable — "optional: earmarked to a case" per the schema's own
  comment on the sibling `donations.case_id`). Part B needs no new
  linking column at all — this was already built.
- **`donations.case_id` also already exists** — donor-to-case earmarking
  *could* be derived from this later, but per the task's own instruction
  not to invent that model in this pass, this doc doesn't touch it. Real
  open question for a future task, not decided here.
- **Real gap: donor records currently have no role restriction beyond
  general org membership.** `donors` only has the blanket
  `is_active_member(org_id)` policy every table gets — meaning today a
  `volunteer`, `foster`, or `vet` role can read/write donor contact
  info and financials, not just `admin`/`staff`. The task explicitly
  asks for admin/staff-only access here, and explicitly says to reuse
  the `legal_reviewer` restrictive-policy pattern — this is that pattern,
  applied narrower (by role, not by table).

## 1. Helper: admin or staff (narrower than `is_active_worker()`, which also allows `vet`)

```sql
create or replace function is_admin_or_staff()
returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from memberships m
    join people p on p.id = m.person_id
    where p.auth_user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('admin', 'staff')
  );
$$;

revoke all on function is_admin_or_staff from public;
grant execute on function is_admin_or_staff to authenticated;
```

## 2. Restrictive policy on `donors` — admin/staff only

Combines with the existing permissive `is_active_member(org_id)` policy
and the existing `legal_reviewer` exclusion (`donors` was already in that
array) — access to `donors` now requires all three: active org member,
admin or staff, and not `legal_reviewer`.

```sql
create policy "only admin/staff can access donor records"
  on donors as restrictive for all
  using (is_admin_or_staff())
  with check (is_admin_or_staff());
```

## 3. Middleware

`/donors` needs its own branch in `frontend/middleware.js` checking
`is_admin_or_staff()` instead of the general `is_active_worker()` it's
currently gated by — same shape as `/legal-review`'s narrower
`can_review_legal()` branch, since `vet` currently passes the general
gate and shouldn't reach donor records per this task.

Nothing needed for the case-expense ledger's own RLS — `expenses` already
has the right protection (general org-member policy + `legal_reviewer`
exclusion, both already in place), and this task didn't ask to narrow it
further the way it did for `donors`.
