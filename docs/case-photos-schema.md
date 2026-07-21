# Case Photos — consent & sensitivity data model

Spec for the "Guarida — Direct Instructions for CC" doc created 2026-07-21T16:50:20Z
(photo/media consent structure for the future public "journey" landing page).

**Not run against the live database.** Like every other schema change tonight,
this is written for the founder to run via Supabase's SQL Editor — CC has no
DDL access (only PostgREST via the anon/service-role REST API, which can't
create tables or policies). Two deviations from the original spec, both
because the original spec assumed things about the schema that turned out not
to be true — flagged here rather than guessed at:

1. **No `users` table exists.** The real schema (docs/access-model.md) uses
   `people` (linked to Supabase's built-in `auth.users` via
   `people.auth_user_id`). Every `references users(id)` in the original spec
   is `references people(id)` below.
2. **No "reviewer" role exists.** `memberships.role` only allows
   `admin, staff, volunteer, foster, vet, donor, investor` — no reviewer
   distinction. Per the spec's own fallback instruction, `public_ok` review
   is restricted to `admin` for now. Open question for the founder: is a
   dedicated reviewer role worth adding later, or is admin-only fine
   long-term?

No existing storage-bucket convention was found anywhere in the codebase
(`case_media.url` is just a bare text column, no bucket/path pattern
established) — so this proposes a new one rather than matching something
that doesn't exist yet, per the spec's own "check before creating a new
convention" instruction.

---

## 1. Table

```sql
create table case_photos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  case_id uuid not null references cases(id) on delete cascade,
  storage_path text not null,
  photo_type text not null check (photo_type in
    ('intake','medical','story','adoption','other')),
  public_ok boolean not null default false,
  sensitivity text not null default 'normal' check (sensitivity in ('normal','graphic')),
  rights_holder_name text,
  rights_holder_person_id uuid references people(id),
  consent_notes text,
  caption text,
  display_order integer,
  uploaded_by uuid not null references people(id),
  uploaded_at timestamptz not null default now(),
  reviewed_by uuid references people(id),
  reviewed_at timestamptz
);

alter table case_photos enable row level security;
```

## 2. RLS policies

Standard org-scoped read/write, same `is_active_member(org_id)` helper used
everywhere else in the schema — plus a DB-level guarantee (not just app
logic) that a regular uploader can never self-publish or self-review a photo.

```sql
-- Org members can see every photo in their org, including unreviewed/graphic
-- ones - staff/vet need this for internal case work, this isn't the public view.
create policy "org members can view their org's case photos"
  on case_photos for select
  using (is_active_member(org_id));

-- Org members can upload, but the row is forced unreviewed on insert - the
-- WITH CHECK makes this a database guarantee, not something app code has to
-- remember to enforce.
create policy "org members can upload case photos, unreviewed by default"
  on case_photos for insert
  with check (
    is_active_member(org_id)
    and public_ok = false
    and reviewed_by is null
    and reviewed_at is null
  );

-- Helper: is this person an active admin of this org? (mirrors
-- is_active_member, adds the role check)
create or replace function is_org_admin(check_org_id uuid)
returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from memberships m
    join people p on p.id = m.person_id
    where m.org_id = check_org_id
      and p.auth_user_id = auth.uid()
      and m.status = 'active'
      and m.role = 'admin'
  );
$$;

-- Only admins can update case_photos at all - covers both the public_ok
-- review action and any other edit (caption, display_order, etc). Simpler
-- and safer than trying to split "uploader can edit their own caption" out
-- via RLS today; flagged in the Log report as a deliberate simplification,
-- not an oversight - easy to loosen later if staff need caption self-edit.
create policy "only admins can update case photos"
  on case_photos for update
  using (is_org_admin(org_id))
  with check (is_org_admin(org_id));

-- No delete policy - default deny. Case photos are potential evidence;
-- deletion isn't something this pass should enable at all. Flagged as an
-- assumption, not a guess - easy to add a narrow admin-only delete policy
-- later if there's a real need (e.g. wrong upload, GDPR-style request).
```

## 3. Public exposure — SECURITY DEFINER function, not a plain view

A plain view on `case_photos` would still be subject to the base table's RLS
for whoever queries it (Postgres views run with the querying role's
privileges by default) — so a naive view would be just as invisible to
`anon` as the table itself, not a safe public window into it. The correct
Supabase pattern for "expose a filtered subset to anon without exposing the
table" is a `security definer` function that internally bypasses RLS and
hard-codes the filter, then grants `execute` (not `select` on any table) to
anon:

```sql
create or replace function public_case_photos(p_case_id uuid default null)
returns table (
  case_id uuid,
  storage_path text,
  photo_type text,
  caption text,
  display_order integer
)
language sql
security definer
stable
as $$
  select case_id, storage_path, photo_type, caption, display_order
  from case_photos
  where public_ok = true
    and sensitivity = 'normal'
    and (p_case_id is null or case_id = p_case_id)
  order by case_id, display_order nulls last;
$$;

revoke all on function public_case_photos from public;
grant execute on function public_case_photos to anon, authenticated;
```

Note deliberately excluded from the public return columns: `org_id`,
`rights_holder_name`, `rights_holder_person_id`, `consent_notes`,
`uploaded_by`, `reviewed_by` — none of that belongs in front of a public
landing page regardless of `public_ok`.

## 4. Storage

Proposed convention (new — nothing existing to match):
`org-{org_id}/case-{case_id}/{photo_id}.{ext}`, one private bucket
(`case-photos`), **not public by default**. Public access to an individual
object should be mediated the same way the row-level filter is — a signed
URL generated only for rows `public_case_photos()` actually returns, not a
permanently-public bucket URL. Bucket creation and its own storage-level RLS
policy (mirroring the table policy: org members read/write their own org's
prefix, admin-only for anything touching `public_ok`-adjacent flows) still
needs to be created via the Supabase dashboard's Storage section — outside
what SQL alone covers, and outside what CC can do from here either.

## 5. Explicitly not done in this pass

- No landing page UI — being designed separately, per instruction.
- No ASM connector photo-path changes — none found to touch anyway.
- No caption self-edit policy for non-admin uploaders (see §2 above).
- No delete policy of any kind.
- Storage bucket itself not created (dashboard-only step).
