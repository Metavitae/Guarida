# Donation logging + donations RLS narrowing — schema

Spec for "Guarida - Direct Instructions for CC" (update, 2026-07-27
~17:50, relayed via "Get it 2"). Written for the founder to run in
Supabase's SQL Editor — CC has no DDL access.

## What was checked before writing anything

- **`donations` table already exists** (`docs/access-model.md`): `id`,
  `org_id`, `donor_id`, `case_id` (nullable — "optional: earmarked to a
  case"), `amount`, `currency`, `donated_at`. No schema change needed for
  the entry/edit UI itself — both directions of earmarking (donor sets
  `case_id` at entry, staff assigns/changes it after) are just writes to
  a column that already exists.
- **Real gap, same shape as the one already fixed on `donors`**:
  `donations` is still on only the blanket `is_active_member(org_id)`
  policy every table gets by default — meaning any active worker (`vet`,
  `foster`, `volunteer`, not just `admin`/`staff`) can read/write
  donation records directly via a Supabase client call, regardless of
  whether they can reach the `/donors` page itself (page-level gating in
  `middleware.js` and table-level RLS are separate layers — this fixes
  the RLS layer, which is the one that actually matters for direct API
  access). `is_admin_or_staff()` already exists (created in
  `docs/donor-accounting-schema.md`, already live and in use by
  `donors`) — no new function needed, just the same restrictive policy
  applied to a second table.

**Policy applied — DONE (2026-07-27, run by the founder via Supabase's SQL
editor; independently confirmed by CC).** Verification method: seeded a
real throwaway donation row via service role, then read it with both a
freshly-created `vet`-role test account and a `staff`-role test account.
`vet` got an empty result (`[]`), `staff` got the row back. Not ambiguous
— this used a row known to exist, not just an absence of data. Both test
accounts and the seeded row were deleted afterward.

## 1. Restrictive policy on `donations` — admin/staff only

Same pattern as `donors` (`docs/donor-accounting-schema.md` section 2):
combines with the existing permissive `is_active_member(org_id)` policy —
access to `donations` now requires both active org membership and
admin/staff role.

```sql
create policy "only admin/staff can access donations"
  on donations as restrictive for all
  using (is_admin_or_staff())
  with check (is_admin_or_staff());
```

## 2. Known, accepted side effect on `/cases/[id]`

The case-detail page is gated at the route level by `is_active_worker()`
(admin/staff/vet), broader than `is_admin_or_staff()`. After this policy
is added, a `vet` who can reach a case's detail page will see its
Donations section as empty even if real donations are linked to that
case — RLS silently filters rows rather than erroring, so nothing breaks,
but the section will under-report for that role. This follows directly
from the founder's own instruction that donor/financial data shouldn't be
broadly readable, so it's flagged here as an accepted consequence, not a
bug to fix separately.

## 3. Middleware — no change needed

Donation logging lives inside `/donors` (already gated `is_admin_or_staff()`
per `docs/donor-accounting-schema.md` section 3) — no new route, so no
middleware change.
