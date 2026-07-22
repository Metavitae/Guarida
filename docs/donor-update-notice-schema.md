# Donor-update WhatsApp notices — schema (Part A)

Spec for "Guarida - Direct Instructions for CC" (donor-update notices +
Mistral-style scroll, Part A), relayed manually while Drive writes are
unreliable. Written for the founder to run in Supabase's SQL Editor — CC
has no DDL access.

## What was checked before writing anything — two real findings

1. **`donors` has no `whatsapp_number` column.** The task said "recipient:
   the donor's whatsapp_number, same field pattern as donors and
   prospects" — checked against the real schema
   (`docs/access-model.md`/`docs/donor-accounting-schema.md`): only
   `prospects` has that column; `donors` only has a single free-text
   `contact` field. The task's premise assumed a column that doesn't
   exist yet. Adding it, since there's no way to resolve a recipient
   without it.

2. **Donors aren't `people`/`memberships` rows — the existing kill-switch
   doesn't apply to them.** `sendWhatsAppTemplate()` (built for vet-care
   and foster-checkin) authorizes every send through
   `getActiveMembership()`, which checks `memberships.status = 'active'`
   for that phone number. Donors are external supporters tracked in
   their own `donors` table — they were never meant to have a
   `memberships` row, and giving them one would incorrectly grant them
   org-member access to cases/vet notifications/etc. via every other
   table's RLS. Sending to a donor through the existing function would
   always fail with "no active membership," not because of a bug but
   because the two concepts (org member vs. external donor) are
   genuinely different trust boundaries. Built a parallel, donor-scoped
   authorization path instead of stretching the membership one to cover
   a case it was never designed for.

## 1. `donors.whatsapp_number`

```sql
alter table donors add column if not exists whatsapp_number text;
```

## 2. WhatsApp message template — submitted to Meta

- **Name:** `guarida_donor_update`
- **Language:** `en_US`
- **Category:** `UTILITY` — this is personalized, account-specific
  correspondence about a donor's own contribution, not bulk promotional
  content, so it fits the same category as the other two templates
  rather than `MARKETING`. A real judgment call, stated plainly rather
  than assumed.
- **Body:** `Hi {{1}}! Thank you for supporting Guarida — {{2}}. We're so grateful for your generosity.`
  (`{{1}}` donor name, `{{2}}` a short summary staff writes at send time
  — e.g. "your gift is helping fund Luna's vet care" or a general update;
  well within Meta's ~1024-char body limit)
- Submitted via the Graph API during this task; ID and live approval
  status reported alongside the commit, same honest-pending pattern as
  the other two templates.

## 3. Sending logic — new donor-scoped authorization, reusing everything else

`sendWhatsAppTemplateToDonor()` in `lib/whatsapp.js`: looks up the real
`donors` row by id + org_id (this *is* the authorization boundary — the
donor-table equivalent of "active membership" for staff), sends via the
same Meta template call as `sendWhatsAppTemplate()`, logs to
`whatsapp_messages` with `message_type = 'donor_update'`,
`template_name = 'guarida_donor_update'`, `person_id = null` (donors
aren't `people` rows). No new columns needed on `whatsapp_messages` —
`message_type`/`template_name` already exist from the vet-care task.

## 4. Trigger — manual, per the task's own instruction

No donor-to-case earmarking exists yet (flagged as an open question in
`docs/donor-accounting-schema.md`, still open) — per the task's explicit
instruction, this doesn't try to auto-detect which donors care about
which case. A "Send update" action on the donor card lets staff write
the `{{2}}` summary themselves at send time.
