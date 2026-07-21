# Worker login gate — database function

Spec for the "add a real login gate for workers" doc (created 2026-07-21T18:05:05Z).
Same pattern as tonight's other two schema changes: written for the founder
to run in Supabase's SQL Editor — CC has no DDL access.

Mirrors the existing `is_active_member(org_id)` pattern exactly, but checks
across *any* org (the app has no per-org routing yet, so "can this person
use the internal app at all" is the right question, not "can they use one
specific org's data" — RLS still enforces the org-scoped question separately
and is untouched by this).

```sql
create or replace function is_active_worker()
returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from memberships m
    join people p on p.id = m.person_id
    where p.auth_user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('admin', 'staff', 'vet')
  );
$$;

revoke all on function is_active_worker from public;
grant execute on function is_active_worker to authenticated;
```

Called via RPC from Next.js middleware on every protected page request
(`supabase.rpc("is_active_worker")`) — not cached in a JWT claim, so
revoking someone's membership takes effect on their very next request,
matching the existing kill-switch guarantee used for data access.

## Hardening note, not part of this task but worth flagging

Checked `GET /auth/v1/settings`: `disable_signup` is `false` project-wide,
meaning anyone who enters an email at `/login` gets a real Supabase Auth
account created, even though this app has no legitimate self-signup flow
(per this task's own "no self-signup UI" decision). Not a data access
hole — `is_active_worker()` still blocks anyone without a real membership
row — but it does let random emails accumulate real `auth.users` rows.
Worth considering disabling public signup in the Auth dashboard at some
point; not blocking, not done here (dashboard-only, and out of this
task's stated scope).
