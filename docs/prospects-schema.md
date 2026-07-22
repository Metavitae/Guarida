# Donor/investor prospecting pipeline — schema

Spec for "Guarida - Direct Instructions for CC" (prospecting pipeline,
relayed manually by the founder while Drive writes are unreliable).
Written for the founder to run in Supabase's SQL Editor — CC has no DDL
access.

## What was checked before writing anything

- **`donors.donor_type` already has a `'prospect'` value** — the task
  explicitly acknowledged this and asked for a genuinely separate table
  anyway, since a prospect needs fields (`source`, next-follow-up date)
  that don't belong on `donors`, and a real convert action that creates
  a distinct `donors` row rather than just relabeling a status. Not a
  duplicate of an existing concept — a real, deliberate design choice
  stated explicitly in the task, not decided silently here.
- **`donors.contact` is one free-text field**; the task asked for
  "email and phone/whatsapp_number reusing the existing pattern" — read
  as reusing `people.whatsapp_number`'s column name/shape (E.164), not
  `donors.contact`'s single-field shape, so `prospects` gets its own
  `email` + `whatsapp_number` columns.
- **RLS reuses `is_admin_or_staff()`**, built for `donors` in the prior
  task — same access model, per the task's own instruction.

## 1. Table

```sql
create table prospects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null,
  email text,
  whatsapp_number text,
  source text,
  stage text not null default 'identified'
    check (stage in ('identified', 'contacted', 'engaged', 'converted', 'declined')),
  next_follow_up_date date,
  notes text,
  converted_donor_id uuid references donors(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table prospects enable row level security;
```

## 2. RLS — same model as `donors`

```sql
create policy "org members can access their org's prospects"
  on prospects for all
  using (is_active_member(org_id))
  with check (is_active_member(org_id));

create policy "only admin/staff can access prospects"
  on prospects as restrictive for all
  using (is_admin_or_staff())
  with check (is_admin_or_staff());

create policy "legal_reviewer excluded from prospects"
  on prospects as restrictive for all
  using (not is_legal_reviewer())
  with check (not is_legal_reviewer());
```

## 3. Convert-to-donor

No new SQL needed — the app inserts a real `donors` row (`name`, `contact`
built from `email`/`whatsapp_number`, `donor_type = 'donor'`,
`stage = 'active'`, `notes` carried over) and sets
`prospects.converted_donor_id`, `prospects.stage = 'converted'` in one
action. The prospect row is never deleted — `converted_donor_id` is the
permanent link from prospect history to the real donor record.

## 4. Middleware

`/prospects` gets the same `is_admin_or_staff()` branch as `/donors` in
`frontend/middleware.js` — not the general `is_active_worker()` gate,
since `vet` shouldn't reach donor/prospect data any more here than on
`/donors`.
