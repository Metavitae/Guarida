# Guarida — Access & Permissions Data Model

This is the foundation everything else depends on: multi-org isolation, roles, and the one-tap kill switch. Built for Postgres/Supabase, since Row-Level Security (RLS) is what makes the kill switch a database guarantee instead of a UI promise.

---

## 1. How the kill switch actually works

Revoking someone doesn't delete their account — it flips `memberships.status` to `'revoked'`. Every RLS policy on every org-scoped table checks for an **active** membership row before allowing access. The moment that flip happens:

1. Their next API call — from the app or the WhatsApp bridge — fails RLS and returns nothing, even if their session token is still technically valid.
2. We also force-expire their Supabase auth session via the admin API in the same action, so they're kicked out immediately rather than waiting for token expiry.
3. The WhatsApp bridge checks membership status before routing any message through to org threads, so a revoked person's WhatsApp number stops being treated as "inside" the org's comms even though it's still their personal WhatsApp.

One button in the UI = one `UPDATE` + one session-revoke call. No cleanup job, no delay.

---

## 2. Core schema

```sql
-- ORGANIZATIONS ------------------------------------------------------------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org_type text not null check (org_type in ('rescue','shelter','hotel','foster_network')),
  country text not null default 'MX',
  jurisdiction_state text,          -- e.g. 'CDMX', 'Jalisco'
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now()
);

-- PEOPLE (one row per human, across all orgs they touch) -------------------
create table people (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,          -- links to Supabase auth.users
  full_name text not null,
  email text,
  whatsapp_number text unique,       -- E.164 format
  created_at timestamptz not null default now()
);

-- MEMBERSHIPS (the kill-switch table) --------------------------------------
create table memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  role text not null check (role in
    ('admin','staff','volunteer','foster','vet','donor','investor')),
  status text not null default 'active' check (status in ('active','revoked')),
  joined_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references people(id),
  unique (org_id, person_id, role)
);

create index on memberships (person_id, status);
create index on memberships (org_id, status);
```

---

## 3. Row-Level Security pattern (applies to every org-scoped table)

```sql
-- Helper: is this person an active member of this org?
create or replace function is_active_member(check_org_id uuid)
returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from memberships m
    join people p on p.id = m.person_id
    where m.org_id = check_org_id
      and p.auth_user_id = auth.uid()
      and m.status = 'active'
  );
$$;

-- Example: cases table
create table cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  title text not null,
  description text not null,
  species text,
  location text,
  jurisdiction text not null default 'MX',
  status text not null default 'open',
  created_by uuid references people(id),
  created_at timestamptz not null default now()
);

alter table cases enable row level security;

create policy "org members can access their org's cases"
  on cases for all
  using (is_active_member(org_id))
  with check (is_active_member(org_id));
```

Every table below (`case_media`, `inventory_items`, `expenses`, `donors`, `donations`, `emergency_contacts`, `social_posts`, etc.) gets the same `is_active_member(org_id)` policy. One function, reused everywhere — when the security model changes, it changes in one place.

---

## 4. Supporting tables (Phase 1 scope)

```sql
create table case_media (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  media_type text not null check (media_type in ('photo','video')),
  url text not null,
  witness_name text,
  witness_contact text,
  captured_at timestamptz not null default now()
);

create table legal_references (
  id uuid primary key default gen_random_uuid(),
  jurisdiction text not null,        -- 'MX-Federal', 'MX-CDMX', etc.
  statute_code text not null,
  title text not null,
  summary text not null,
  source_url text,
  lawyer_reviewed boolean not null default false,
  reviewed_by text,
  reviewed_at timestamptz
);

create table case_legal_matches (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  legal_reference_id uuid not null references legal_references(id),
  suggested_by text not null default 'ai',   -- 'ai' | person_id if manual
  confirmed_by uuid references people(id),   -- null until a human confirms
  confirmed_at timestamptz
);

create table donors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null,
  contact text,
  donor_type text not null check (donor_type in ('prospect','donor','investor')),
  stage text not null default 'prospect'
    check (stage in ('prospect','contacted','active','lapsed')),
  notes text
);

create table donations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  donor_id uuid references donors(id),
  case_id uuid references cases(id),   -- optional: earmarked to a case
  amount numeric(12,2) not null,
  currency text not null default 'MXN',
  donated_at timestamptz not null default now()
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  case_id uuid references cases(id),
  amount numeric(12,2) not null,
  currency text not null default 'MXN',
  category text,
  description text,
  receipt_url text,
  created_at timestamptz not null default now()
);

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null,
  category text,
  quantity numeric not null default 0,
  unit text,
  reorder_threshold numeric,
  updated_at timestamptz not null default now()
);

create table emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  category text not null check (category in
    ('vet','fire','police','animal_control','poison_control','management')),
  name text not null,
  phone text not null,
  priority_order int default 0
);

-- ANIMALS (the gap we caught: not every animal record is an abuse case) --
create table animals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text,
  species text not null,
  breed text,
  sex text check (sex in ('male','female','unknown')),
  date_of_birth date,
  intake_date timestamptz not null default now(),
  intake_type text check (intake_type in
    ('stray','surrender','transfer','seizure','born_in_care')),
  status text not null default 'in_care' check (status in
    ('in_care','fostered','adopted','transferred','deceased','returned_to_owner')),
  microchip_number text,
  external_ref text,      -- e.g. the animal's ID in Shelter Manager, for sync matching
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table animals enable row level security;
create policy "org members can access their org's animals"
  on animals for all
  using (is_active_member(org_id))
  with check (is_active_member(org_id));

-- FOSTER PLACEMENTS (explicitly asked for: track foster homes per animal) -
create table foster_placements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  animal_id uuid not null references animals(id),
  foster_person_id uuid not null references people(id),
  start_date date not null default current_date,
  end_date date,
  status text not null default 'active' check (status in ('active','completed'))
);

alter table foster_placements enable row level security;
create policy "org members can access their org's foster placements"
  on foster_placements for all
  using (is_active_member(org_id))
  with check (is_active_member(org_id));

-- VET NOTIFICATIONS (who needs to know about a case's medical needs) ----
create table vet_notifications (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  vet_person_id uuid not null references people(id),
  notified_at timestamptz not null default now(),
  care_plan_text text,          -- filled in later, once the vet has seen the case
  acknowledged_at timestamptz
);

alter table vet_notifications enable row level security;
create policy "org members can access vet notifications for their org's cases"
  on vet_notifications for all
  using (exists (
    select 1 from cases c where c.id = vet_notifications.case_id
    and is_active_member(c.org_id)
  ));

-- Link abuse/legal cases and expenses to a specific animal, when relevant.
-- Not every animal has a case, and not every case starts with a known animal
-- (e.g. a report before the animal is even in care) — so both stay optional.
alter table cases add column animal_id uuid references animals(id);
alter table expenses add column animal_id uuid references animals(id);
```

---

## 5. Why this shape holds up

- **A person can belong to many orgs** (`memberships` is the join table) — someone can volunteer at two shelters, or be a vet serving three, without duplicate accounts.
- **A donor's giving is scoped per-org** but their `people` row is shared, so if they also volunteer somewhere, that's one identity, two roles.
- **`case_legal_matches` never auto-confirms** — `confirmed_by` stays null until a human clicks confirm, which is the technical enforcement of the "advisory, not automatic" rule from the plan doc.
- **Every expense/donation can (optionally) link to a case**, which is what makes the "memory of every case and its expenses" donor-facing reports possible later — it's a join, not a rebuild.

---

## 6. Animals vs. Cases — why these are separate

`animals` is the routine, everyday record: every dog, cat, or other animal that comes through the org, whether it's a normal surrender or a stray with no drama attached. This is what a system like Shelter Manager (ASM) is built around, and it's what most of Wet Noses' daily work actually touches.

`cases` is specifically for abuse/legal matters — it's the one that triggers the legal-reference lookup and (eventually) authority reporting. A case *can* point to an animal record (`cases.animal_id`), but most animals will never have one, and a case can technically exist before an animal is even formally in care.

Conflating these two would have made the legal-reporting logic accidentally trigger on routine intakes, and made routine animal tracking carry unnecessary legal weight. Keeping them separate, linked only when relevant, avoids both problems.

---

## 7. Next build step

Wire up Supabase Auth + the `is_active_member()` policy on a throwaway `cases` table first, and test the kill switch end-to-end (revoke → confirm session dies → confirm WhatsApp bridge stops routing) before building anything else on top. If the kill switch doesn't work, nothing else matters.
