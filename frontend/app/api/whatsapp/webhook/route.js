import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";
import { getActiveMembership, logWhatsAppMessage, normalizePhoneNumber } from "../../../../lib/whatsapp";

// Meta's webhook verification handshake — hit once when you register the
// webhook URL in the App Dashboard. Must echo hub.challenge back verbatim
// if hub.verify_token matches what you configured there.
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

function verifySignature(rawBody, signatureHeader) {
  const secret = process.env.META_WHATSAPP_APP_SECRET;
  if (!secret || !signatureHeader) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Inbound — Meta POSTs here whenever someone messages the connected
// number. Logs every message to whatsapp_messages regardless of whether
// the sender is recognized; an unrecognized/inactive number is logged
// with person_id = null and never treated as an active member.
export async function POST(request) {
  const rawBody = await request.text();

  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const orgId = process.env.PILOT_ORG_ID;
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const messages = payload.entry?.flatMap((e) => e.changes?.flatMap((c) => c.value?.messages || []) || []) || [];
    const statuses = payload.entry?.flatMap((e) => e.changes?.flatMap((c) => c.value?.statuses || []) || []) || [];

    for (const msg of messages) {
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
    for (const status of statuses) {
      const statusDetail = status.errors?.length ? JSON.stringify(status.errors) : null;
      await supabase.from("whatsapp_messages")
        .update({ status: status.status, status_detail: statusDetail })
        .eq("provider_message_id", status.id);
    }
  } catch (err) {
    console.error("WhatsApp webhook error:", err.message);
    // Still 200 — don't let Meta retry-storm us over a logging failure.
  }

  return new Response("OK", { status: 200 });
}
