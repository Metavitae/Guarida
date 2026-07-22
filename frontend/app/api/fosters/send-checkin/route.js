import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { sendWhatsAppTemplate } from "../../../../lib/whatsapp";

// Sends a check-in ping to the foster on an active placement. Server-side
// only — keeps the service-role key and Meta token out of the client
// bundle, same pattern as /api/vet-care/send-notice.
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

  const { placementId } = await request.json();
  if (!placementId) return Response.json({ error: "placementId required" }, { status: 400 });

  const admin = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const orgId = process.env.PILOT_ORG_ID;

  const { data: placement, error: placementErr } = await admin.from("foster_placements")
    .select("id, status, animal_id, foster_person_id").eq("id", placementId).single();
  if (placementErr) return Response.json({ error: placementErr.message }, { status: 404 });
  if (placement.status !== "active") return Response.json({ error: "Placement is not active" }, { status: 400 });

  const { data: foster } = await admin.from("people").select("id, full_name, whatsapp_number").eq("id", placement.foster_person_id).single();
  if (!foster?.whatsapp_number) return Response.json({ error: "Foster has no whatsapp_number on file" }, { status: 400 });

  let animalName = "your foster animal";
  if (placement.animal_id) {
    const { data: animal } = await admin.from("animals").select("name").eq("id", placement.animal_id).maybeSingle();
    if (animal?.name) animalName = animal.name;
  }

  try {
    const { providerMessageId } = await sendWhatsAppTemplate(
      foster.whatsapp_number, "guarida_foster_checkin", "en_US", [animalName], orgId, "foster_checkin"
    );
    return Response.json({ sent: true, person: foster.full_name, providerMessageId });
  } catch (err) {
    return Response.json({ sent: false, person: foster.full_name, reason: err.message });
  }
}
