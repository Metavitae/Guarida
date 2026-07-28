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
 *
 * Multi-org (2026-07-28): credentials and template names used to be
 * global env vars / hardcoded strings, good for exactly one tenant.
 * getOrgWhatsAppConfig()/resolveTemplate() below resolve them per-org from
 * organization_whatsapp_config / whatsapp_templates (see
 * docs/multi-org-whatsapp-schema.md), falling back to Wet Noses' original
 * env-var values if a row doesn't exist yet for a given org (or the
 * tables themselves haven't been created yet) - so nothing breaks in the
 * gap between this being written and the founder running that migration.
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

// Resolves an org's own WhatsApp credentials from organization_whatsapp_config
// (see docs/multi-org-whatsapp-schema.md). Falls back to the deployment-wide
// env vars (Wet Noses' original setup) if no row exists yet for this org, or
// the table itself doesn't exist yet - .maybeSingle() returns {data: null,
// error} in both cases without throwing, so this never crashes the caller.
// Exported (unlike the other internals here) because the webhook route also
// needs it, to pick the right org's app_secret before verifying an inbound
// request's signature.
export async function getOrgWhatsAppConfig(supabase, orgId) {
  const { data } = await supabase
    .from("organization_whatsapp_config")
    .select("waba_id, phone_number_id, access_token, app_secret")
    .eq("org_id", orgId)
    .maybeSingle();

  if (data) {
    return {
      wabaId: data.waba_id,
      phoneNumberId: data.phone_number_id,
      token: data.access_token,
      appSecret: data.app_secret || process.env.META_WHATSAPP_APP_SECRET,
    };
  }

  return {
    wabaId: process.env.META_WHATSAPP_WABA_ID || "1022668264095877",
    phoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID,
    token: process.env.META_WHATSAPP_TOKEN,
    appSecret: process.env.META_WHATSAPP_APP_SECRET,
  };
}

// Looks up an org's WhatsApp config by the phone_number_id Meta's webhook
// says received the message - this is how inbound routing tells which org
// a message belongs to without assuming a single tenant. Returns null (not
// an org id) if the table doesn't exist yet or no org has claimed that
// number, so callers can fall back to PILOT_ORG_ID for Wet Noses' own
// unmigrated number.
export async function resolveOrgIdByPhoneNumberId(supabase, phoneNumberId) {
  if (!phoneNumberId) return null;
  const { data } = await supabase
    .from("organization_whatsapp_config")
    .select("org_id")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();
  return data?.org_id ?? null;
}

// Wet Noses' own template names, used only as a fallback for orgs with no
// whatsapp_templates row yet (including Wet Noses themselves, until their
// three existing approved templates are migrated into the table).
const FALLBACK_TEMPLATES = {
  vet_care_notice: { templateName: "guarida_vet_care_notice", languageCode: "en_US" },
  foster_checkin: { templateName: "guarida_foster_checkin", languageCode: "en_US" },
  donor_update: { templateName: "guarida_donor_update_v2", languageCode: "en_US" },
};

async function resolveTemplate(supabase, orgId, purpose) {
  const { data } = await supabase
    .from("whatsapp_templates")
    .select("template_name, language_code, status")
    .eq("org_id", orgId).eq("purpose", purpose).maybeSingle();

  if (data) {
    if (data.status !== "approved") {
      throw new Error(`The "${purpose}" template isn't approved yet for this org (status: ${data.status}).`);
    }
    return { templateName: data.template_name, languageCode: data.language_code };
  }

  const fallback = FALLBACK_TEMPLATES[purpose];
  if (!fallback) throw new Error(`No template configured for purpose "${purpose}".`);
  return fallback;
}

async function callMetaSend(payload, config) {
  if (!config.token || !config.phoneNumberId) {
    throw new Error("Missing WhatsApp access token / phone number id for this org.");
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
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

  const config = await getOrgWhatsAppConfig(supabase, orgId);
  const { providerMessageId } = await callMetaSend(buildPayload(toPersonPhone), config);

  await logWhatsAppMessage(supabase, {
    orgId, personId: result.person.id, direction: "outbound",
    fromNumber: config.phoneNumberId, toNumber: normalizePhoneNumber(toPersonPhone),
    body, providerMessageId, messageType, templateName,
  });

  return { providerMessageId, person: result.person };
}

// Free-form text — only works within an open 24-hour customer-service
// window (WhatsApp policy, confirmed the hard way tonight). Fine for
// replying to an active conversation; NOT for business-initiated notices.
export async function sendWhatsAppMessage(toPersonPhone, body, orgId) {
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
export async function sendWhatsAppTemplate(toPersonPhone, templateName, languageCode, bodyParams, orgId, messageType = "template") {
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

// Purpose-based template sending - resolves the SENDING org's own template
// name/language from whatsapp_templates (falling back to Wet Noses'
// defaults) instead of the caller needing to know a hardcoded template
// name. This is what makes a second tenant's own (differently-named)
// approved templates just work without touching the three send routes.
export async function sendOrgTemplateNotice(toPersonPhone, purpose, orgId, bodyParams, messageType = purpose) {
  const supabase = getSupabaseAdmin();
  const { templateName, languageCode } = await resolveTemplate(supabase, orgId, purpose);
  return sendWhatsAppTemplate(toPersonPhone, templateName, languageCode, bodyParams, orgId, messageType);
}

// Read-only status check — no message send, no side effects. Doubles as
// a live token-validity check: debug_token fails first if the token is
// expired/invalid, before this ever gets to the template lookup.
// fallbackTemplateNames is only used if this org has no whatsapp_templates
// rows yet (including Wet Noses, pre-migration).
export async function getTemplateStatuses(orgId, fallbackTemplateNames) {
  const supabase = getSupabaseAdmin();
  const config = await getOrgWhatsAppConfig(supabase, orgId);
  if (!config.token) throw new Error("Missing WhatsApp access token for this org.");

  const { data: templateRows } = await supabase.from("whatsapp_templates").select("template_name").eq("org_id", orgId);
  const templateNames = templateRows?.length ? templateRows.map((r) => r.template_name) : fallbackTemplateNames;

  const debugRes = await fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${config.token}&access_token=${config.token}`);
  const debugJson = await debugRes.json();
  if (!debugRes.ok || debugJson.error) {
    return { tokenValid: false, tokenError: debugJson.error?.message || "debug_token call failed", templates: [] };
  }

  const templatesRes = await fetch(`https://graph.facebook.com/v21.0/${config.wabaId}/message_templates?fields=name,status,category,rejected_reason&limit=100`, {
    headers: { Authorization: `Bearer ${config.token}` },
  });
  const templatesJson = await templatesRes.json();
  if (!templatesRes.ok) {
    return { tokenValid: true, tokenExpiresAt: debugJson.data?.expires_at, wabaId: config.wabaId, tokenError: `message_templates call failed: ${JSON.stringify(templatesJson)}`, templates: [] };
  }

  const all = templatesJson.data || [];
  const filtered = templateNames ? all.filter((t) => templateNames.includes(t.name)) : all;
  return { tokenValid: true, tokenExpiresAt: debugJson.data?.expires_at, wabaId: config.wabaId, templates: filtered };
}

// Donors aren't `people`/`memberships` rows — they're external supporters,
// not org members, so getActiveMembership()'s "active membership" check
// doesn't apply to them at all (and shouldn't: giving a donor a membership
// row would incorrectly grant them org-member RLS access everywhere else).
// This is the donor-table equivalent authorization boundary: a real,
// existing donors row in this org *is* the check, same role the
// membership check plays for staff. Builds the donor-update template's
// {{1}}/{{2}} (name, summary) from the donor row itself, so the caller
// never has to know the donor's name before this function looks it up.
export async function sendDonorUpdateNotice(donorId, summary, orgId) {
  const supabase = getSupabaseAdmin();
  const { data: donor, error: donorErr } = await supabase
    .from("donors").select("id, name, whatsapp_number").eq("id", donorId).eq("org_id", orgId).maybeSingle();
  if (donorErr) throw donorErr;
  if (!donor) throw new Error(`Refusing to send: no donor ${donorId} in org ${orgId}.`);
  if (!donor.whatsapp_number) throw new Error(`Donor ${donor.name} has no whatsapp_number on file.`);

  const provider = process.env.WHATSAPP_PROVIDER || "meta";
  if (provider !== "meta") throw new Error(`Unsupported WHATSAPP_PROVIDER: ${provider}`);

  const { templateName, languageCode } = await resolveTemplate(supabase, orgId, "donor_update");
  const config = await getOrgWhatsAppConfig(supabase, orgId);

  const bodyParams = [donor.name, summary || "your continued support of our work"];
  const { providerMessageId } = await callMetaSend({
    messaging_product: "whatsapp",
    to: normalizePhoneNumber(donor.whatsapp_number).replace("+", ""),
    type: "template",
    template: { name: templateName, language: { code: languageCode }, components: [{ type: "body", parameters: bodyParams.map((text) => ({ type: "text", text })) }] },
  }, config);

  await logWhatsAppMessage(supabase, {
    orgId, personId: null, direction: "outbound",
    fromNumber: config.phoneNumberId, toNumber: normalizePhoneNumber(donor.whatsapp_number),
    body: bodyParams.join(" | "), providerMessageId, messageType: "donor_update", templateName,
  });

  return { providerMessageId, donor };
}
