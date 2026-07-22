# WhatsApp infrastructure — schema

Spec for "Guarida - Direct Instructions for CC" (created 2026-07-22T08:10:58Z),
relayed via "Get it 2". Written for the founder to run in Supabase's SQL
Editor — CC has no DDL access.

## What was checked before writing anything

- **`people.whatsapp_number` already exists** (`text unique`, E.164 format
  per `docs/access-model.md`) — confirmed directly rather than assumed,
  since `my_person_profile()` already reads it.
- **No real Twilio or Meta credentials exist anywhere** — checked every
  `.env.local` in the repo (root and `frontend/`) for key names (not
  values). Neither provider is configured.
- **`backend/whatsapp-bridge/` already exists** — a Twilio-based bridge
  (Express server, `messages` table, not `whatsapp_messages`) written
  during the original chat-session codebase assembly
  (`git log` shows it's untouched since the very first commit,
  `f902205`). It was only ever mock-tested (`test.js`, simulated data,
  no real Twilio account) and was never deployed — its own README still
  says "Still needed: real hosting for this server." This task's own
  framing assumes Meta Cloud API test mode, and since no real account
  exists for *either* provider, Meta genuinely is the easier path today
  (free test WABA, no card/business verification, per the task's own
  context) — so this doc does not extend the old Twilio bridge. Its
  kill-switch design (check active membership on both directions, log
  every message, silently drop unrecognized/revoked numbers) is real and
  good, and gets reused below — just against Meta's API instead of
  Twilio's, and as a Next.js Route Handler on Vercel instead of a
  separately-hosted Express server (Vercel already gives this app a
  public HTTPS URL, which was the old bridge's other unresolved gap).
  `backend/whatsapp-bridge/` itself is left untouched, not deleted.

## 1. Table

```sql
create table whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  person_id uuid references people(id),  -- null when the sender is unrecognized
  direction text not null check (direction in ('inbound', 'outbound')),
  from_number text,
  to_number text,
  body text,
  provider_message_id text,
  status text,
  status_detail text,
  created_at timestamptz not null default now()
);

alter table whatsapp_messages enable row level security;

create policy "org members can access their org's whatsapp messages"
  on whatsapp_messages for all
  using (is_active_member(org_id))
  with check (is_active_member(org_id));

create policy "legal_reviewer excluded from whatsapp_messages"
  on whatsapp_messages as restrictive for all
  using (not is_legal_reviewer())
  with check (not is_legal_reviewer());
```

Writes to this table only ever happen server-side (the webhook route and
the send function both use the service-role key, which bypasses RLS
entirely) — the `for all` policy above is what lets staff actually *view*
the org's message log from the app later, not what gates the writes
themselves. Membership gating for both directions happens in application
code (`getActiveMembership()` in `frontend/lib/whatsapp.js`), mirroring
exactly what the old Twilio bridge already did correctly.

## 1a. Addendum — `status`/`status_detail` (added after the table was already
   live, to diagnose why the first real test message never showed up on the
   founder's phone)

`status`/`status_detail` are already included in section 1's `create table`
above for anyone running this doc fresh. Since the table was already live
when this need came up, it needs an `alter table` instead:

```sql
alter table whatsapp_messages add column if not exists status text;
alter table whatsapp_messages add column if not exists status_detail text;
```

The webhook route now updates the matching outbound row (matched by
`provider_message_id`) whenever Meta sends a delivery-status callback
(`sent`/`delivered`/`read`/`failed`, with `status_detail` holding the raw
error payload if it failed) — this is what actually tells us whether a
message was delivered instead of guessing from silence.

## 2. Env vars needed (set in `frontend/.env.local`, and in Vercel's
   dashboard for the live webhook to work — never commit these)

```
WHATSAPP_PROVIDER=meta
META_WHATSAPP_TOKEN=...
META_WHATSAPP_PHONE_NUMBER_ID=...
META_WHATSAPP_APP_SECRET=...
WHATSAPP_WEBHOOK_VERIFY_TOKEN=...   # any string you choose, used in the Meta dashboard's webhook setup
PILOT_ORG_ID=<Wet Noses' real org_id>
```

`WHATSAPP_PROVIDER` is what makes switching providers later a config
change, not a rewrite — `frontend/lib/whatsapp.js` branches on this value.
