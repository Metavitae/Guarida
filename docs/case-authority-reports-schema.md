# Authority-reporting compiler — schema (v2, general-purpose)

Spec for "Guarida - Direct Instructions for CC" (created 2026-07-22T07:33:50Z),
relayed via "Get it 2". **Supersedes and replaces** the first version of this
doc (spec created 07:06:50Z, built and verified against ebanderas.gob.mx's
exact form fields) — the founder correctly pushed back that mirroring one
government site's specific form is fragile and out of scope. This version is
general-purpose across whatever authority/process staff actually use.

The first version was fully built and verified end-to-end against the real
database, but **never committed or pushed** — caught the re-scope before
anything went live. `case_authority_reports` currently has zero real rows
(confirmed empirically before this rewrite), so this migration drops and
recreates the table rather than writing a column-rename/migration chain —
simpler and safe given there's no real data to preserve.

## 1. Drop the v1 table (already run live, no real data in it)

```sql
drop table if exists case_authority_reports;
```

## 2. Table (v2)

```sql
create table case_authority_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  case_id uuid not null references cases(id) on delete cascade,
  animal_id uuid references animals(id),

  -- simple internal classification, based on the linked animal's species
  -- (or the case's own species field if no animal is linked) — not tied to
  -- any external authority's category list.
  category text not null check (category in ('domestic', 'wildlife')),

  -- who/what/when/where/why, auto-drafted from the case's existing notes,
  -- always human-editable before being considered final.
  description text,

  -- reporter/staff contact — defaults to the logged-in user's own profile,
  -- editable. No address fields — this isn't mirroring a form's required set.
  reporter_name text,
  reporter_phone text,
  reporter_email text,

  -- evidence file references, reusing case_photos (see below). A generous
  -- but real app-level limit for storage/UX reasons — Guarida's own choice,
  -- not copied from any government form.
  evidence_photo_ids uuid[] not null default '{}',
  constraint case_authority_reports_evidence_reasonable_limit
    check (array_length(evidence_photo_ids, 1) is null or array_length(evidence_photo_ids, 1) <= 6),

  -- record-keeping only, set once staff has actually taken this somewhere.
  -- Free-text on purpose: Guarida doesn't need to know each authority's
  -- process in advance (e.g. "filed via Bahía de Banderas site", "called
  -- 089", "emailed PROFEPA").
  reported_at timestamptz,
  reported_by uuid references people(id),
  reported_via text,

  created_by uuid not null references people(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table case_authority_reports enable row level security;
```

## 3. `case_photos.photo_type` widening — unaffected by the re-scope, keep as-is

The v1 migration already widened `case_photos.photo_type` to include
`authority_report` (general-purpose tag, not tied to which authority). If v1's
SQL was run in full, this step is already done and running it again is a
no-op-safe re-check; skip if already applied. If you're running this doc
fresh, include it:

```sql
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'case_photos'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%photo_type%';

  if cname is not null and position('authority_report' in pg_get_constraintdef(
    (select oid from pg_constraint where conname = cname)
  )) = 0 then
    execute format('alter table case_photos drop constraint %I', cname);
    alter table case_photos add constraint case_photos_photo_type_check
      check (photo_type in ('intake', 'medical', 'story', 'adoption', 'other', 'authority_report'));
  end if;
end $$;
```

## 4. `my_person_profile()` — unaffected by the re-scope, keep as-is

Already created by v1 if that SQL was run in full. No change needed; included
here only for a from-scratch run:

```sql
create or replace function my_person_profile()
returns table (full_name text, email text, whatsapp_number text)
language sql security definer stable as $$
  select full_name, email, whatsapp_number
  from people
  where auth_user_id = auth.uid();
$$;

revoke all on function my_person_profile from public;
grant execute on function my_person_profile to authenticated;
```

## 5. RLS (re-created, since the table was dropped)

Same org-scoped pattern as `cases`/`case_photos`. No delete policy —
deliberate, same reasoning as `case_photos`.

```sql
create policy "org members can view their org's authority reports"
  on case_authority_reports for select
  using (is_active_member(org_id));

create policy "org members can create authority reports"
  on case_authority_reports for insert
  with check (is_active_member(org_id));

create policy "org members can edit their org's authority reports"
  on case_authority_reports for update
  using (is_active_member(org_id))
  with check (is_active_member(org_id));

create policy "legal_reviewer excluded from case_authority_reports"
  on case_authority_reports as restrictive for all
  using (not is_legal_reviewer())
  with check (not is_legal_reviewer());
```

## 6. Storage — unchanged from v1

Still reuses the existing `case-photos` bucket and its established path
convention, still tags evidence rows `photo_type = 'authority_report'`,
still appends the new `case_photos.id` to `evidence_photo_ids`. Nothing
about the storage/evidence mechanism was form-specific, so v1's design here
carries over unchanged — only the "how many files" cap number changed
(4 → 6, and reframed as Guarida's own limit, not the form's).

## 7. Middleware — unchanged from v1

`/authority-report` is already in `frontend/middleware.js`'s matcher on the
general `is_active_worker()` branch — no change needed, same route path,
just a different page behind it.
