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

export async function getActiveMembership(supabase, phoneNumber, orgId) {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) return null;

  const { data: person, error: personErr } = await supabase
    .from("people").select("id, full_name").eq("whatsapp_number", normalized).maybeSingle();
  if (personErr) throw personErr;
  if (!person) return null; // unknown number

  const { data: membership, error: memberErr } = await supabase
    .from("memberships").select("id, role, status")
    .eq("person_id", person.id).eq("org_id", orgId).eq("status", "active").maybeSingle();
  if (memberErr) throw memberErr;
  if (!membership) return null; // known person, but not active in this org — kill switch

  return { person, membership };
}

export async function logWhatsAppMessage(supabase, { orgId, personId, direction, fromNumber, toNumber, body, providerMessageId }) {
  const { error } = await supabase.from("whatsapp_messages").insert({
    org_id: orgId, person_id: personId ?? null, direction,
    from_number: fromNumber ?? null, to_number: toNumber ?? null,
    body: body ?? null, provider_message_id: providerMessageId ?? null,
  });
  if (error) console.error("Failed to log whatsapp message:", error.message);
}

async function sendViaMeta(toNumber, body) {
  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) throw new Error("Missing META_WHATSAPP_TOKEN / META_WHATSAPP_PHONE_NUMBER_ID.");

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizePhoneNumber(toNumber).replace("+", ""),
      type: "text",
      text: { body },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Meta send failed: ${JSON.stringify(json)}`);
  return { providerMessageId: json.messages?.[0]?.id };
}

// Outbound — call this from anywhere else in the app (vet notification,
// case update, etc.). Runs the same active-membership check as inbound
// before sending anything.
export async function sendWhatsAppMessage(toPersonPhone, body, orgId = process.env.PILOT_ORG_ID) {
  const supabase = getSupabaseAdmin();
  const result = await getActiveMembership(supabase, toPersonPhone, orgId);
  if (!result) {
    throw new Error(`Refusing to send: ${toPersonPhone} has no active membership in org ${orgId}.`);
  }

  const provider = process.env.WHATSAPP_PROVIDER || "meta";
  if (provider !== "meta") throw new Error(`Unsupported WHATSAPP_PROVIDER: ${provider}`);
  const { providerMessageId } = await sendViaMeta(toPersonPhone, body);

  await logWhatsAppMessage(supabase, {
    orgId, personId: result.person.id, direction: "outbound",
    fromNumber: process.env.META_WHATSAPP_PHONE_NUMBER_ID, toNumber: normalizePhoneNumber(toPersonPhone),
    body, providerMessageId,
  });

  return { providerMessageId, person: result.person };
}
