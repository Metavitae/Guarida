# Vet-care recommendation notices — schema

Spec for "Guarida - Direct Instructions for CC" (created 2026-07-22T12:10:31Z),
relayed via "Get it 2". Written for the founder to run in Supabase's SQL
Editor — CC has no DDL access.

## What was checked before writing anything

- **`vet_notifications` already exists** (`docs/access-model.md`), with
  exactly the fields this task needs for a care recommendation:
  `care_plan_text` ("filled in later, once the vet has seen the case") and
  `acknowledged_at`. No new table needed — reusing this directly rather
  than inventing `case_vet_recommendations`, per the task's own
  instruction to check first.
- **`foster_placements` already tracks who's caring for an animal**
  (`animal_id` → `foster_person_id`, `status = 'active'`) — this is the
  existing assignment link, reused for recipient resolution rather than
  building a parallel one.
- **Real gap found: `cases.needs_vet_care` doesn't exist.**
  `case-intake/page.jsx` has a "This case needs veterinary attention"
  toggle (`requiresVet` state) that has never actually been saved
  anywhere — `handleSubmit` only ever inserted into `cases` and
  `case_legal_matches`, never anything vet-related. This means there is
  currently no way to discover which cases need vet care at all, which
  `vet-care/page.jsx` (itself still 100% mock/hardcoded data) would need
  to query. Fixing this is a small, necessary part of making the trigger
  point in this task real, not scope creep — without it, nothing here has
  anything to discover.

## 1. `cases.needs_vet_care` — the missing trigger flag

```sql
alter table cases add column if not exists needs_vet_care boolean not null default false;
```

## 2. `whatsapp_messages` — distinguish notice sends from ordinary chatter

```sql
alter table whatsapp_messages add column if not exists message_type text default 'chatter';
alter table whatsapp_messages add column if not exists template_name text;
```

## 3. WhatsApp message template — submitted to Meta, not built locally

Templates are Meta-side objects (submitted via the Graph API, approved by
Meta's review, then referenced by name when sending) — nothing to run in
Supabase for this part. Submitted during this task:

- **Name:** `guarida_vet_care_notice`
- **Language:** `en_US`
- **Category:** `UTILITY` (operational info to a foster/staff caregiver,
  not marketing)
- **Body:** `Guarida care notice for {{1}}: {{2}} Case ref: {{3}} — check the app for full details.`
  (`{{1}}` animal name, `{{2}}` short care summary, `{{3}}` case title —
  kept short since templates have their own length/formatting limits and
  the full recommendation lives in `vet_notifications.care_plan_text`,
  not crammed into the template itself)
- **Meta template ID:** `1010479202037137`
- **Status at time of submission:** `PENDING` — Meta's review isn't
  instant; this is an honest "submitted, not yet approved" state, not a
  live/working send path yet.

Static wrapper text submitted in English as a pragmatic default (the
dynamic `{{2}}` content — whatever the vet actually writes — will be in
whatever language they use, most likely Spanish given the rest of the
app). Worth a translated resubmission later if the founder wants the
wrapper text itself in Spanish too — flagging as a real open choice, not
deciding it silently.
