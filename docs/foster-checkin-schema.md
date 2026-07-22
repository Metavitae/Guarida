# Foster check-in notices — schema

Spec for "Guarida - Direct Instructions for CC" (created 2026-07-22T12:23:02Z),
relayed via "Get it 2". Written for the founder to run in Supabase's SQL
Editor — CC has no DDL access.

## What was checked before writing anything

- **`foster_placements` has no notes/flag field** — confirmed against
  `docs/access-model.md`'s actual definition (`id`, `org_id`, `animal_id`,
  `foster_person_id`, `start_date`, `end_date`, `status`). The task said
  to reuse one if it exists; it doesn't, so a small addition is needed —
  kept minimal per the task's own "don't build a complex triage system"
  instruction.
- **`status` already means what's needed** — `'active'`/`'completed'` is
  the existing "is this placement current" signal, reused directly for
  both recipient resolution and the check-in trigger.
- **Trigger choice: manually-triggerable, not periodic/cron.** The task
  allowed either. This app has no scheduling infrastructure at all today
  (no Vercel Cron config, no background job runner) — building that would
  be new infrastructure, not "check-in logic and template content" per
  the task's own framing of what this pass should be about. A manual
  "Send check-in" button (same pattern as vet-care's notice send) ships
  today; periodic automation is a real, separate future task if wanted.
- **No existing page lists foster placements** — `/donors` is still
  mock-only (per the 2026-07-21 session-close log), and there's no
  `/fosters` page at all. Adding one, matching the existing simple
  list-plus-action pattern (`vet-care`, `authority-report`).

## 1. `foster_placements` — minimal check-in fields

```sql
alter table foster_placements add column if not exists needs_attention boolean not null default false;
alter table foster_placements add column if not exists last_checkin_at timestamptz;
alter table foster_placements add column if not exists last_checkin_note text;
```

## 2. WhatsApp message template — submitted to Meta

- **Name:** `guarida_foster_checkin`
- **Language:** `en_US` (same pragmatic default as `guarida_vet_care_notice`)
- **Category:** `UTILITY`
- **Body:** `Hi! Quick check-in on {{1}} — reply "all good" or "needs attention" and we'll follow up.`
- Submitted via the Graph API during this task; ID and live approval
  status reported alongside the commit.

## 3. Inbound reply handling — extends the existing webhook, doesn't fork it

`frontend/app/api/whatsapp/webhook/route.js`'s inbound handler already
logs every message and resolves the sender's person record. This task
adds one more step after that: if the sender currently has any active
`foster_placements` rows, update `last_checkin_at`/`last_checkin_note` on
all of them with the reply, and set `needs_attention = true` if the reply
text contains "attention" (case-insensitive) — matching the exact word
the template itself prompts the foster to reply with, kept deliberately
simple per the task's instruction not to build a full form/triage system.

**Known, accepted limitation:** if a foster has more than one active
placement, a reply updates all of them (no way to know which animal a
freeform "needs attention" reply refers to without asking that as a
separate question, which the task explicitly said to keep out of scope
for this first version). Worth a real follow-up if a foster with
multiple animals becomes common — flagging now rather than quietly
deciding it's fine forever.
