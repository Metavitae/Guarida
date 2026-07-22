import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { sendWhatsAppTemplate } from "../../../../lib/whatsapp";

// Sends the vet-care notice template to whoever's actually responsible
// for the animal's day-to-day care — resolved from real assignment data
// (foster_placements, vet_notifications), never hardcoded. Runs
// server-side only: this is the one place the service-role key and the
// Meta token are used together, kept out of the client bundle entirely.
export async function POST(request) {
  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { data: isWorker } = await authClient.rpc("is_active_worker");
  if (!isWorker) return Response.json({ error: "Not an active worker" }, { status: 403 });

  const { caseId } = await request.json();
  if (!caseId) return Response.json({ error: "caseId required" }, { status: 400 });

  const admin = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const orgId = process.env.PILOT_ORG_ID;

  const { data: caseRow, error: caseErr } = await admin.from("cases").select("id, title, animal_id").eq("id", caseId).single();
  if (caseErr) return Response.json({ error: caseErr.message }, { status: 404 });

  const { data: notification, error: notifErr } = await admin.from("vet_notifications")
    .select("id, vet_person_id, care_plan_text").eq("case_id", caseId).order("notified_at", { ascending: false }).limit(1).maybeSingle();
  if (notifErr) return Response.json({ error: notifErr.message }, { status: 500 });
  if (!notification?.care_plan_text) return Response.json({ error: "No care plan to send yet" }, { status: 400 });

  let animalName = "the animal";
  if (caseRow.animal_id) {
    const { data: animal } = await admin.from("animals").select("name").eq("id", caseRow.animal_id).maybeSingle();
    if (animal?.name) animalName = animal.name;
  }

  // Recipient resolution — real assignment data, not hardcoded:
  // (1) the vet who acknowledged the case, (2) the animal's currently
  // active foster, if any. Same person showing up in both isn't possible
  // (different roles), but dedupe by person id defensively anyway.
  const recipientIds = new Set();
  if (notification.vet_person_id) recipientIds.add(notification.vet_person_id);
  if (caseRow.animal_id) {
    const { data: foster } = await admin.from("foster_placements")
      .select("foster_person_id").eq("animal_id", caseRow.animal_id).eq("status", "active").maybeSingle();
    if (foster?.foster_person_id) recipientIds.add(foster.foster_person_id);
  }

  if (!recipientIds.size) return Response.json({ error: "No vet or foster assigned to notify" }, { status: 400 });

  const { data: people } = await admin.from("people").select("id, full_name, whatsapp_number").in("id", [...recipientIds]);

  const careSummary = notification.care_plan_text.length > 300
    ? notification.care_plan_text.slice(0, 297) + "..." : notification.care_plan_text;

  const results = [];
  for (const person of people ?? []) {
    if (!person.whatsapp_number) { results.push({ person: person.full_name, sent: false, reason: "no whatsapp_number on file" }); continue; }
    try {
      const { providerMessageId } = await sendWhatsAppTemplate(
        person.whatsapp_number, "guarida_vet_care_notice", "en_US",
        [animalName, careSummary, caseRow.title], orgId, "vet_care_notice"
      );
      results.push({ person: person.full_name, sent: true, providerMessageId });
    } catch (err) {
      results.push({ person: person.full_name, sent: false, reason: err.message });
    }
  }

  return Response.json({ results });
}
