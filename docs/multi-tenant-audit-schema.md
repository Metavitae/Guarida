# Multi-tenant audit (2026-07-28) — schema change needed

Spec for the tenant-scoping audit ("audit the whole app for hardcoded
Wet Noses assumptions"). Same pattern as every other schema change in
this repo: written for the founder to run in Supabase's SQL Editor — CC
has no DDL access.

## Why this is needed

Fixing `case-intake`'s hardcoded `"MX-Nayarit"` jurisdiction (so a future
tenant outside Nayarit gets matched against their own applicable law,
not Wet Noses') and `Nav.jsx`'s hardcoded `"Wet Noses"` breadcrumb (so a
future tenant sees their own org name) both require reading the current
user's own `organizations` row — but a direct `.from("organizations")`
select hits the **same still-unfixed infinite-recursion bug on `people`'s
RLS policy** flagged in `docs/inventory-accounting-schema.md` during an
earlier session. Confirmed directly, not assumed: created a disposable
real staff account, signed in for a real access token, and a plain
`organizations` select came back `infinite recursion detected in policy
for relation "people"` — same error anon requests get. This isn't new;
it's the same standing bug, just newly relevant because two features now
need to read `organizations` for the first time.

Same sidestep this codebase already uses for `people` (see
`my_person_id()` in `docs/inventory-accounting-schema.md`): a narrow
`security definer` RPC that resolves only what the caller needs, without
touching or fixing the underlying broken policy.

## `my_org()` — resolves the caller's own org

```sql
create or replace function my_org()
returns table (org_id uuid, name text, country text, jurisdiction_state text)
language sql security definer stable as $$
  select o.id, o.name, o.country, o.jurisdiction_state
  from organizations o
  join memberships m on m.org_id = o.id
  join people p on p.id = m.person_id
  where p.auth_user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

revoke all on function my_org from public;
grant execute on function my_org to authenticated;
```

`limit 1` picks one org if the caller belongs to more than one active
org — same known limitation as the rest of the app today (see the RLS
finding below), not something this function introduces.

## Status: RUN, verified live (2026-07-28)

Founder ran this in Supabase's SQL Editor. Verified directly with a real
disposable staff account (created, tested, deleted - zero rows left
behind): `my_org()` returns `{org_id, name: "Wet Noses Rescue", country:
"MX", jurisdiction_state: "Nayarit"}` for a real authenticated session.
Confirmed as a genuine sidestep, not a coincidental fix: the same
session's direct `organizations` select still hits the old recursion
error. `app/case-intake/page.jsx` and `components/Nav.jsx` are both live
on this now - no redeploy needed, they call it client-side on next page
load.
