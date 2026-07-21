# Guarida — WhatsApp Bridge

## What it does
- **Inbound:** Twilio hits `/webhook/whatsapp` when someone messages your
  number. The code checks if that phone number belongs to an *active*
  member of the org before routing the message anywhere. Revoked or
  unrecognized numbers get silently dropped — no reply, no error, no sign
  anything happened. That's deliberate: a revoked person shouldn't see
  confirmation that they've been cut off.
- **Outbound:** `sendWhatsAppMessage()` — call this from anywhere else in
  the app (vet notification, case update, etc.). It runs the same active-
  membership check before sending anything.

## Tested already
Ran a mock test (`test.js`) simulating an active volunteer, a revoked
person, and an unknown number — confirmed the logic allows the first and
blocks the other two. Output was:
```
Active volunteer -> ALLOWED (Maria (active volunteer))
Revoked person   -> BLOCKED (correct)
Unknown number   -> BLOCKED (correct)
```

## What you need to fill in once Twilio approval lands
Set these as environment variables — never hardcode them in the file:

```
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=whatsapp:+1XXXXXXXXXX
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
PILOT_ORG_ID=<Wet Noses' org_id once created in the database>
```

## Running it
```
npm install
node bridge.js
```
Then point Twilio's webhook (in the console, under your WhatsApp sender's
settings) at `https://<your-server>/webhook/whatsapp`.

## Still needed before this is fully live
- The `messages` table isn't in the original access-model doc — add it:
  `org_id, person_id, direction, body, whatsapp_sid, created_at`, same
  `is_active_member(org_id)` RLS policy as everything else.
- Real hosting for this server (Twilio needs a public URL to hit) — a
  small Supabase Edge Function or a cheap always-on host both work; happy
  to set either up once you pick.
