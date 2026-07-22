/**
 * WhatsApp send/receive abstraction — server-side only (uses the
 * service-role key, never import this from a "use client" component).
 *
 * The rule this file exists to enforce, same as the old backend/
 * whatsapp-bridge/bridge.js it replaces: a phone number is only "inside"
 * an org's comms if it belongs to an ACTIVE membership at the moment the
 * message moves — checked on both directions, every time. WhatsApp is the
 * one channel that lives outside our own database and would otherwise
 * keep working after someone's revoked.
 *
 * WHATSAPP_PROVIDER selects the backend ('meta' today; 'twilio' can be
 * added the same way later) — swapping providers is a config change here,
 * not a rewrite of anything that calls sendWhatsAppMessage().
 */

import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, key);
}

// Meta's numbers arrive without a leading '+' (e.g. "5213221234567").
// people.whatsapp_number is stored E.164 with the '+' — normalize both
// ways so lookups actually match.
export function normalizePhoneNumber(raw) {
  const digits = String(raw || "").replace(/^whatsapp:/, "").replace(/[^\d]/g, "");
  return digits ? `+${digits}` : "";
}

// Mexican numbers have two live E.164-ish forms in the wild: the modern
// standard (+52XXXXXXXXXX, 10 digits) and WhatsApp's own legacy internal
// form (+521XXXXXXXXXX, with a "1" inserted after the country code) —
// Meta's inbound webhook and message-status callbacks use the +521 form
// even when the number was originally sent/verified as +52. Confirmed
// directly: a real inbound reply arrived as +5213221174070 while the
// matching people row was stored as +523221174070 — an exact-string
// match silently missed it. Generate both candidate forms so lookups
// work regardless of which one Meta happens to hand back.
function mxCandidates(normalized) {
  if (normalized.startsWith("+521") && normalized.length === 14) {
    return [normalized, "+52" + normalized.slice(4)];
  }
  if (normalized.startsWith("+52") && !normalized.startsWith("+521") && normalized.length === 13) {
    return [normalized, "+521" + normalized.slice(3)];
  }
  return [normalized];
}

export async function getActiveMembership(supabase, phoneNumber, orgId) {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) return null;

  const { data: people, error: personErr } = await supabase
    .from("people").select("id, full_name").in("whatsapp_number", mxCandidates(normalized));
  if (personErr) throw personErr;
  const person = people?.[0];
  if (!person) return null; // unknown number

  const { data: membership, error: memberErr } = await supabase
    .from("memberships").select("id, role, status")
    .eq("person_id", person.id).eq("org_id", orgId).eq("status", "active").maybeSingle();
  if (memberErr) throw memberErr;
  if (!membership) return null; // known person, but not active in this org — kill switch

  return { person, membership };
}

export async function logWhatsAppMessage(supabase, { orgId, personId, direction, fromNumber, toNumber, body, providerMessageId, messageType, templateName }) {
  const { error } = await supabase.from("whatsapp_messages").insert({
    org_id: orgId, person_id: personId ?? null, direction,
    from_number: fromNumber ?? null, to_number: toNumber ?? null,
    body: body ?? null, provider_message_id: providerMessageId ?? null,
    message_type: messageType ?? "chatter", template_name: templateName ?? null,
  });
  if (error) console.error("Failed to log whatsapp message:", error.message);
}

async function callMetaSend(payload) {
  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error("Missing META_WHATSAPP_TOKEN / META_WHATSAPP_PHONE_NUMBER_ID.");

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Meta send failed: ${JSON.stringify(json)}`);
  return { providerMessageId: json.messages?.[0]?.id };
}

// Shared by both send paths below: same kill-switch, same logging shape.
async function sendChecked(toPersonPhone, orgId, buildPayload, { body, messageType, templateName }) {
  const supabase = getSupabaseAdmin();
  const result = await getActiveMembership(supabase, toPersonPhone, orgId);
  if (!result) {
    throw new Error(`Refusing to send: ${toPersonPhone} has no active membership in org ${orgId}.`);
  }

  const provider = process.env.WHATSAPP_PROVIDER || "meta";
  if (provider !== "meta") throw new Error(`Unsupported WHATSAPP_PROVIDER: ${provider}`);
  const { providerMessageId } = await callMetaSend(buildPayload(toPersonPhone));

  await logWhatsAppMessage(supabase, {
    orgId, personId: result.person.id, direction: "outbound",
    fromNumber: process.env.META_WHATSAPP_PHONE_NUMBER_ID, toNumber: normalizePhoneNumber(toPersonPhone),
    body, providerMessageId, messageType, templateName,
  });

  return { providerMessageId, person: result.person };
}

// Free-form text — only works within an open 24-hour customer-service
// window (WhatsApp policy, confirmed the hard way tonight). Fine for
// replying to an active conversation; NOT for business-initiated notices.
export async function sendWhatsAppMessage(toPersonPhone, body, orgId = process.env.PILOT_ORG_ID) {
  return sendChecked(
    toPersonPhone, orgId,
    (to) => ({ messaging_product: "whatsapp", to: normalizePhoneNumber(to).replace("+", ""), type: "text", text: { body } }),
    { body, messageType: "chatter" }
  );
}

// Template — the only path allowed for business-initiated messages
// outside an open window (e.g. a vet-care notice to a foster who hasn't
// messaged the number). bodyParams fills the template's {{1}}, {{2}}, ...
// placeholders in order.
export async function sendWhatsAppTemplate(toPersonPhone, templateName, languageCode, bodyParams, orgId = process.env.PILOT_ORG_ID, messageType = "template") {
  return sendChecked(
    toPersonPhone, orgId,
    (to) => ({
      messaging_product: "whatsapp",
      to: normalizePhoneNumber(to).replace("+", ""),
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components: [{ type: "body", parameters: bodyParams.map((text) => ({ type: "text", text })) }],
      },
    }),
    { body: bodyParams.join(" | "), messageType, templateName }
  );
}

// Donors aren't `people`/`memberships` rows — they're external supporters,
// not org members, so getActiveMembership()'s "active membership" check
// doesn't apply to them at all (and shouldn't: giving a donor a membership
// row would incorrectly grant them org-member RLS access everywhere else).
// This is the donor-table equivalent authorization boundary: a real,
// existing donors row in this org *is* the check, same role the
// membership check plays for staff. Builds guarida_donor_update's
// {{1}}/{{2}} (name, summary) from the donor row itself, so the caller
// never has to know the donor's name before this function looks it up.
export async function sendDonorUpdateNotice(donorId, summary, orgId = process.env.PILOT_ORG_ID) {
  const supabase = getSupabaseAdmin();
  const { data: donor, error: donorErr } = await supabase
    .from("donors").select("id, name, whatsapp_number").eq("id", donorId).eq("org_id", orgId).maybeSingle();
  if (donorErr) throw donorErr;
  if (!donor) throw new Error(`Refusing to send: no donor ${donorId} in org ${orgId}.`);
  if (!donor.whatsapp_number) throw new Error(`Donor ${donor.name} has no whatsapp_number on file.`);

  const provider = process.env.WHATSAPP_PROVIDER || "meta";
  if (provider !== "meta") throw new Error(`Unsupported WHATSAPP_PROVIDER: ${provider}`);

  const bodyParams = [donor.name, summary || "your continued support of our work"];
  const { providerMessageId } = await callMetaSend({
    messaging_product: "whatsapp",
    to: normalizePhoneNumber(donor.whatsapp_number).replace("+", ""),
    type: "template",
    template: { name: "guarida_donor_update", language: { code: "en_US" }, components: [{ type: "body", parameters: bodyParams.map((text) => ({ type: "text", text })) }] },
  });

  await logWhatsAppMessage(supabase, {
    orgId, personId: null, direction: "outbound",
    fromNumber: process.env.META_WHATSAPP_PHONE_NUMBER_ID, toNumber: normalizePhoneNumber(donor.whatsapp_number),
    body: bodyParams.join(" | "), providerMessageId, messageType: "donor_update", templateName: "guarida_donor_update",
  });

  return { providerMessageId, donor };
}
