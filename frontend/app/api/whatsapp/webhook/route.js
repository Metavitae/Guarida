import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";
import { getActiveMembership, logWhatsAppMessage, normalizePhoneNumber, getOrgWhatsAppConfig, resolveOrgIdByPhoneNumberId } from "../../../../lib/whatsapp";

// Meta's webhook verification handshake — hit once when you register the
// webhook URL in the App Dashboard. Must echo hub.challenge back verbatim
// if hub.verify_token matches what you configured there. One shared value
// deployment-wide - this proves ownership of the URL itself (registered
// once per Meta App), not tied to any one org's phone number.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Verification failed", { status: 403 });
}

function verifySignature(rawBody, signatureHeader, secret) {
  if (!secret || !signatureHeader) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Inbound — Meta POSTs here whenever someone messages ANY connected
// number, across every org this deployment serves. Logs every message to
// whatsapp_messages regardless of whether the sender is recognized; an
// unrecognized/inactive number is logged with person_id = null and never
// treated as an active member.
export async function POST(request) {
  const rawBody = await request.text();
  const payload = JSON.parse(rawBody);
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Multi-org routing (2026-07-28): which org a message belongs to is
  // resolved from the phone_number_id Meta says received it, not assumed
  // to be a single PILOT_ORG_ID - see docs/multi-org-whatsapp-schema.md.
  // Parsing the body before the signature check is safe (just reading
  // JSON, nothing is trusted or acted on yet) - it only picks WHICH org's
  // app_secret to try; the signature still has to actually verify below
  // before anything in the payload is treated as real. Falls back to
  // PILOT_ORG_ID for Wet Noses' own number if organization_whatsapp_config
  // doesn't exist yet or has no row for it.
  const firstPhoneNumberId = payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
  const signatureOrgId = (await resolveOrgIdByPhoneNumberId(supabase, firstPhoneNumberId)) || process.env.PILOT_ORG_ID;
  const { appSecret } = await getOrgWhatsAppConfig(supabase, signatureOrgId);

  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        // Each change carries its own phone_number_id - resolved per-change,
        // not once for the whole payload, since a single shared Meta App can
        // legitimately batch multiple orgs' numbers into one callback.
        const orgId = (await resolveOrgIdByPhoneNumberId(supabase, value.metadata?.phone_number_id)) || process.env.PILOT_ORG_ID;

        for (const msg of value.messages ?? []) {
          const from = normalizePhoneNumber(msg.from);
          const body = msg.text?.body ?? `[${msg.type} message]`;

          const result = await getActiveMembership(supabase, from, orgId);
          // Deliberately silent either way — no reply, no error. Logged
          // regardless, but only linked to a person when they're an active
          // member; a revoked/unknown sender should see nothing different.
          await logWhatsAppMessage(supabase, {
            orgId, personId: result?.person?.id ?? null, direction: "inbound",
            fromNumber: from, body, providerMessageId: msg.id,
          });

          // Foster check-in replies: any inbound message from someone with
          // an active foster_placements row updates the check-in fields on
          // it. "needs attention" (case-insensitive) also flags it — simple
          // keyword match, matching exactly what the check-in template
          // itself prompts the foster to reply with, per the task's own
          // "don't build a full triage system" instruction.
          if (result?.person?.id) {
            const needsAttention = /needs attention/i.test(body);
            await supabase.from("foster_placements")
              .update({ last_checkin_at: new Date().toISOString(), last_checkin_note: body, ...(needsAttention ? { needs_attention: true } : {}) })
              .eq("foster_person_id", result.person.id).eq("status", "active");
          }
        }

        // Delivery-status callbacks for messages we sent (sent/delivered/read/
        // failed) — updates the matching outbound row rather than logging a
        // new one, so a message's status is visible on its own row.
        // provider_message_id is globally unique to Meta, so this doesn't
        // need org scoping to find the right row.
        for (const status of value.statuses ?? []) {
          const statusDetail = status.errors?.length ? JSON.stringify(status.errors) : null;
          await supabase.from("whatsapp_messages")
            .update({ status: status.status, status_detail: statusDetail })
            .eq("provider_message_id", status.id);
        }
      }
    }
  } catch (err) {
    console.error("WhatsApp webhook error:", err.message);
    // Still 200 — don't let Meta retry-storm us over a logging failure.
  }

  return new Response("OK", { status: 200 });
}
