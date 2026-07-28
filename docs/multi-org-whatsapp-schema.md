# Multi-org WhatsApp routing + templates — schema

Spec for "Guarida - Direct Instructions for CC (2026-07-28, v3)" items 1
and 2 (WhatsApp routing for multiple organizations, per-organization
WhatsApp templates). Written for the founder to run in Supabase's SQL
Editor — CC has no DDL access, same as every other schema change here.

## Why two tables, one doc

Both items are the same underlying gap: WhatsApp credentials and
templates currently live in global env vars / hardcoded strings, good
for exactly one tenant. They're specced together since they're the same
"per-org WhatsApp settings" domain and belong in the same migration, but
built and reported as separate items per the founder's own instruction
to go one at a time.

## 1. `organization_whatsapp_config` — per-org credentials

```sql
create table organization_whatsapp_config (
  org_id uuid primary key references organizations(id) on delete cascade,
  provider text not null default 'meta',
  waba_id text not null,
  phone_number_id text not null,
  access_token text not null,
  app_secret text,              -- null falls back to the deployment-wide
                                 -- META_WHATSAPP_APP_SECRET env var (see below)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index organization_whatsapp_config_phone_number_id_key
  on organization_whatsapp_config (phone_number_id);

alter table organization_whatsapp_config enable row level security;
-- Deliberately NO policies for authenticated/anon - this table holds live
-- access tokens. RLS enabled + zero permissive policies = every non-
-- service-role request is denied outright, same as `people`/`organizations`
-- would be if their policies weren't buggy. Only lib/whatsapp.js's
-- service-role admin client (which bypasses RLS entirely) ever reads
-- this table. No client-side code should ever query it directly.
```

**Why `app_secret` is nullable, `access_token`/`waba_id`/`phone_number_id`
aren't:** a phone number, WABA, and permanent token are meaningless
without real per-org values - there's no sensible fallback. But
`app_secret` gates the ONE shared webhook URL's signature check, and two
realistic setups exist: (a) every org's WABA lives under Guarida's own
single Meta Business App (one shared `app_secret` for everyone, the
simplest case), or (b) an org brings their own completely separate Meta
App (needs their own `app_secret`). Supporting both without forcing a
choice now: null means "use the shared deployment secret," a real value
overrides it per-org.

## 2. `whatsapp_templates` — per-org template registry

```sql
create table whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  purpose text not null check (purpose in
    ('vet_care_notice', 'foster_checkin', 'donor_update')),
  template_name text not null,       -- Meta's actual template name for this org's WABA
  meta_template_id text,             -- null until Meta assigns one post-submission
  category text,                     -- e.g. 'UTILITY' - Meta's own categorization
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  language_code text not null default 'en_US',
  created_at timestamptz not null default now(),
  unique (org_id, purpose)
);

alter table whatsapp_templates enable row level security;

create policy "org members can view their org's whatsapp templates"
  on whatsapp_templates for select
  using (is_active_member(org_id));

create policy "admin/staff can manage their org's whatsapp templates"
  on whatsapp_templates for insert with check (is_admin_or_staff() and is_active_member(org_id));

create policy "admin/staff can update their org's whatsapp templates"
  on whatsapp_templates for update
  using (is_admin_or_staff() and is_active_member(org_id))
  with check (is_admin_or_staff() and is_active_member(org_id));

create policy "legal_reviewer excluded from whatsapp_templates"
  on whatsapp_templates as restrictive for all
  using (not is_legal_reviewer())
  with check (not is_legal_reviewer());
```

`purpose` is a fixed enum, not a free-text key - the three existing send
paths (vet-care notice, foster check-in, donor update) are the only
template types the app sends today. A genuinely new notice type is a
code change anyway (a new API route/send function), so it can extend
this check constraint at the same time, same as any other schema
change here.

Unlike `organization_whatsapp_config`, this table has no live secrets in
it (template names/ids/status are the same kind of information already
shown in `/api/whatsapp/status` to any active worker) - readable by any
org member, writable by admin/staff, same shape as most other org-scoped
tables in this app.

## 3. Migrating Wet Noses' existing config into these tables

Once the tables above exist, CC will insert Wet Noses' real values
(already live in `frontend/.env.local` / Vercel) as their own rows via
the service-role key - no further SQL needed for that, it's a normal
insert once the schema exists. `lib/whatsapp.js` will fall back to the
current env-var behavior automatically if no row exists yet for a given
org, so nothing about Wet Noses' current (paused) WhatsApp setup breaks
in the gap between this doc being written and being run.
