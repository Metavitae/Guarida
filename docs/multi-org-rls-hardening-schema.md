# Multi-org RLS hardening — real gap found during the founder's own required test

Not part of the original v3 task's four items directly - found *because*
of item 4's own explicit instruction ("test explicitly with a mocked
multi-org user... this is the one most likely to introduce a real
data-leak risk if done carelessly"). Written for the founder to run in
Supabase's SQL Editor — CC has no DDL access, same as every other schema
change here.

## What was tested, and what it found

Built a real disposable multi-org person via service role: **staff** at
Wet Noses, **vet** (not staff/admin) at a throwaway second org. Verified
the new org-scoped role functions themselves work correctly
(`is_admin_or_staff(check_org_id)` correctly returned `true` for Wet
Noses and `false` for the throwaway org, where this person is only a
vet). That part is solid.

Then went one step further and tested an actual **table**, not just the
role functions in isolation: seeded a throwaway `donors` row in the
throwaway org (service role), then read `donors` back **as the
multi-org test session**. It came back. **A person who is only a `vet`
at an org - explicitly not supposed to see that org's donor/financial
data at all - could read it anyway, solely because they happen to be
`staff` at a completely different org.**

Root cause: `donors` (and every other table with a `legal_reviewer`-
exclusion or admin/staff-only restrictive policy) still uses the
**zero-arg** role functions (`is_admin_or_staff()`, `is_admin()`,
`is_legal_reviewer()`) in its actual RLS policies - "does this person
hold this role in ANY org," not "in THIS row's org." The org-scoped
overloads added in `docs/multi-org-membership-schema.md` were wired into
the app's routing/UI layer (middleware, page queries) but not yet into
the underlying table policies themselves - so the data-layer gap the
founder was worried about was still real underneath the fixed UI layer.
Test data (throwaway org, person, membership, seeded donor row, auth
user) all deleted afterward - confirmed zero rows left behind.

**Also caught two of my own new policies making the exact same mistake**
(`whatsapp_templates`, `organization_theme` from this same task's earlier
items) - written before this test surfaced the pattern. Fixed here too.

## The fix — same shape everywhere: pass the row's own org to the role check

### 1. Tables with a direct `org_id` column

```sql
do $$
declare
  t text;
begin
  foreach t in array array[
    'animals', 'case_photos', 'cases', 'donations', 'donors',
    'emergency_contacts', 'expenses', 'foster_placements',
    'inventory_items', 'inventory_movements', 'memberships',
    'cross_border_transports', 'prospects', 'whatsapp_messages',
    'whatsapp_templates', 'organization_theme'
  ]
  loop
    execute format('drop policy if exists %I on %I', 'legal_reviewer excluded from ' || t, t);
    execute format(
      'create policy %I on %I as restrictive for all using (not is_legal_reviewer(org_id)) with check (not is_legal_reviewer(org_id))',
      'legal_reviewer excluded from ' || t, t
    );
  end loop;
end $$;
```

### 2. `organizations` — special case: the row *is* the org, no separate `org_id` column

```sql
drop policy if exists "legal_reviewer excluded from organizations" on organizations;
create policy "legal_reviewer excluded from organizations"
  on organizations as restrictive for all
  using (not is_legal_reviewer(id))
  with check (not is_legal_reviewer(id));
```

Low practical urgency - `organizations` is already unreadable directly to
any non-service-role caller regardless (the standing `people` recursion
bug), so this restrictive policy is currently moot either way. Fixed for
consistency, not because it's exploitable today.

### 3. Tables that link to their org only through `cases` - need the row's own case looked up, not assumed

```sql
drop policy if exists "legal_reviewer excluded from case_legal_matches" on case_legal_matches;
create policy "legal_reviewer excluded from case_legal_matches"
  on case_legal_matches as restrictive for all
  using (not is_legal_reviewer((select c.org_id from cases c where c.id = case_legal_matches.case_id)))
  with check (not is_legal_reviewer((select c.org_id from cases c where c.id = case_legal_matches.case_id)));

drop policy if exists "legal_reviewer excluded from case_media" on case_media;
create policy "legal_reviewer excluded from case_media"
  on case_media as restrictive for all
  using (not is_legal_reviewer((select c.org_id from cases c where c.id = case_media.case_id)))
  with check (not is_legal_reviewer((select c.org_id from cases c where c.id = case_media.case_id)));

drop policy if exists "legal_reviewer excluded from vet_notifications" on vet_notifications;
create policy "legal_reviewer excluded from vet_notifications"
  on vet_notifications as restrictive for all
  using (not is_legal_reviewer((select c.org_id from cases c where c.id = vet_notifications.case_id)))
  with check (not is_legal_reviewer((select c.org_id from cases c where c.id = vet_notifications.case_id)));
```

### 4. Admin/staff-only restrictive policies - the actual leak found live

```sql
drop policy if exists "only admin/staff can access donor records" on donors;
create policy "only admin/staff can access donor records"
  on donors as restrictive for all
  using (is_admin_or_staff(org_id))
  with check (is_admin_or_staff(org_id));

drop policy if exists "only admin/staff can access donations" on donations;
create policy "only admin/staff can access donations"
  on donations as restrictive for all
  using (is_admin_or_staff(org_id))
  with check (is_admin_or_staff(org_id));

drop policy if exists "only admin/staff can access prospects" on prospects;
create policy "only admin/staff can access prospects"
  on prospects as restrictive for all
  using (is_admin_or_staff(org_id))
  with check (is_admin_or_staff(org_id));
```

### 5. This task's own two new tables - same bug, caught before the founder ever ran into it live

```sql
drop policy if exists "admin/staff can manage their org's whatsapp templates" on whatsapp_templates;
create policy "admin/staff can manage their org's whatsapp templates"
  on whatsapp_templates for insert with check (is_admin_or_staff(org_id));

drop policy if exists "admin/staff can update their org's whatsapp templates" on whatsapp_templates;
create policy "admin/staff can update their org's whatsapp templates"
  on whatsapp_templates for update
  using (is_admin_or_staff(org_id))
  with check (is_admin_or_staff(org_id));

drop policy if exists "admin can insert their org's theme" on organization_theme;
create policy "admin can insert their org's theme"
  on organization_theme for insert
  with check (is_admin(org_id));

drop policy if exists "admin can update their org's theme" on organization_theme;
create policy "admin can update their org's theme"
  on organization_theme for update
  using (is_admin(org_id))
  with check (is_admin(org_id));
```

## Not touched, deliberately

`legal_references` - its one `is_admin() or is_legal_reviewer()` policy
stays zero-arg. That table has no `org_id` at all and isn't org-owned
data (it's shared statute reference text, filtered by jurisdiction
string, same for every tenant) - "which org" doesn't apply to it.

## After this runs

Re-running the exact same live test (throwaway second org, throwaway
person as vet there, seeded donor row) should come back **empty** for
that session - that's the confirmation this is actually fixed, not just
patched in theory. Will run it again the moment this is applied, before
calling item 4 done.
