/**
 * Guarida — WhatsApp Bridge
 * ------------------------------------------------------------------
 * The rule this file exists to enforce: a person's WhatsApp number is
 * only "inside" an org's comms if they have an ACTIVE membership at
 * the moment the message moves — checked on every single message, both
 * directions. This is the kill switch from the access-model doc,
 * applied to the one channel (WhatsApp) that lives outside our own
 * database and would otherwise keep working after someone's revoked.
 *
 * Two directions:
 *   INBOUND  — Twilio webhook fires when someone messages the number.
 *   OUTBOUND — sendWhatsAppMessage() is called by the rest of the app
 *              (e.g. "notify the vet", "alert the org admin").
 *
 * Both paths call the same membership check. No shortcuts.
 * ------------------------------------------------------------------
 */

const express = require('express');
const twilio = require('twilio');
const { createClient } = require('@supabase/supabase-js');

// ---------------------------------------------------------------------
// Setup — all real secrets come from environment variables, never
// hardcoded. Placeholders below are what you'll set once you have
// the Twilio credentials.
// ---------------------------------------------------------------------
const {
  TWILIO_ACCOUNT_SID,      // from Twilio console
  TWILIO_AUTH_TOKEN,       // from Twilio console
  TWILIO_WHATSAPP_NUMBER,  // e.g. 'whatsapp:+15551234567'
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  PILOT_ORG_ID,            // Wet Noses' org_id in Guarida, for the MVP
} = process.env;

function getTwilioClient() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error('Missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN env vars.');
  }
  return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars.');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// ---------------------------------------------------------------------
// The one function both directions depend on: is this phone number
// an ACTIVE member of the org, right now?
// ---------------------------------------------------------------------
async function getActiveMembership(supabase, phoneNumber, orgId) {
  const normalized = phoneNumber.replace(/^whatsapp:/, '');

  const { data: person, error: personErr } = await supabase
    .from('people')
    .select('id, full_name')
    .eq('whatsapp_number', normalized)
    .maybeSingle();

  if (personErr) throw personErr;
  if (!person) return null; // unknown number — not in the system at all

  const { data: membership, error: memberErr } = await supabase
    .from('memberships')
    .select('id, role, status')
    .eq('person_id', person.id)
    .eq('org_id', orgId)
    .eq('status', 'active')
    .maybeSingle();

  if (memberErr) throw memberErr;
  if (!membership) return null; // exists in system, but not active here — kill switch in effect

  return { person, membership };
}

async function logMessage(supabase, { orgId, personId, direction, body, whatsappSid }) {
  const { error } = await supabase.from('messages').insert({
    org_id: orgId,
    person_id: personId,
    direction,          // 'inbound' | 'outbound'
    body,
    whatsapp_sid: whatsappSid || null,
    created_at: new Date().toISOString(),
  });
  if (error) console.error('Failed to log message:', error.message);
}

// ---------------------------------------------------------------------
// INBOUND — Twilio calls this URL when someone messages the number.
// ---------------------------------------------------------------------
function buildApp() {
  const app = express();
  app.use(express.urlencoded({ extended: false }));

  app.post('/webhook/whatsapp', async (req, res) => {
    const from = req.body.From;   // e.g. 'whatsapp:+523221234567'
    const body = req.body.Body;
    const sid = req.body.MessageSid;

    const twiml = new twilio.twiml.MessagingResponse();

    try {
      const supabase = getSupabaseClient();
      const result = await getActiveMembership(supabase, from, PILOT_ORG_ID);

      if (!result) {
        // Either an unknown number, or someone whose access was revoked.
        // Deliberately silent — no reply, no routing. A revoked person
        // messaging the org number should see nothing different happen,
        // not an error that confirms they've been cut off.
        console.log(`Inbound from unrecognized/inactive number: ${from} — dropped.`);
        res.type('text/xml').send(twiml.toString());
        return;
      }

      await logMessage(supabase, {
        orgId: PILOT_ORG_ID,
        personId: result.person.id,
        direction: 'inbound',
        body,
        whatsappSid: sid,
      });

      console.log(`Routed message from ${result.person.full_name} (${result.membership.role}) into org thread.`);
      // No auto-reply here by design — real routing/notification logic
      // (e.g. "alert on-duty staff") plugs in at this point in Phase 2.
      res.type('text/xml').send(twiml.toString());
    } catch (err) {
      console.error('Webhook error:', err.message);
      res.type('text/xml').send(twiml.toString()); // still 200 — don't let Twilio retry-storm us
    }
  });

  return app;
}

// ---------------------------------------------------------------------
// OUTBOUND — called from elsewhere in the app to message someone.
// Same membership check applies before anything gets sent.
// ---------------------------------------------------------------------
async function sendWhatsAppMessage(toPersonPhone, body, orgId = PILOT_ORG_ID) {
  const supabase = getSupabaseClient();
  const result = await getActiveMembership(supabase, toPersonPhone, orgId);

  if (!result) {
    throw new Error(`Refusing to send: ${toPersonPhone} has no active membership in org ${orgId}.`);
  }

  const client = getTwilioClient();
  const message = await client.messages.create({
    from: TWILIO_WHATSAPP_NUMBER,
    to: `whatsapp:${toPersonPhone.replace(/^whatsapp:/, '')}`,
    body,
  });

  await logMessage(supabase, {
    orgId,
    personId: result.person.id,
    direction: 'outbound',
    body,
    whatsappSid: message.sid,
  });

  return message;
}

module.exports = { buildApp, getActiveMembership, sendWhatsAppMessage };

// ---------------------------------------------------------------------
// Run standalone: `node bridge.js`
// ---------------------------------------------------------------------
if (require.main === module) {
  const app = buildApp();
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Guarida WhatsApp bridge listening on :${port}`));
}
