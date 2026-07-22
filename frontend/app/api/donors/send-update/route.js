import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sendDonorUpdateNotice } from "../../../../lib/whatsapp";

// Server-side only — keeps the service-role key and Meta token out of
// the client bundle, same pattern as /api/vet-care/send-notice and
// /api/fosters/send-checkin. Donor updates use is_admin_or_staff, same
// access model as the /donors page itself (donor financial/contact data
// is admin/staff only).
export async function POST(request) {
  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { data: isAdminOrStaff } = await authClient.rpc("is_admin_or_staff");
  if (!isAdminOrStaff) return Response.json({ error: "Admin/staff only" }, { status: 403 });

  const { donorId, summary } = await request.json();
  if (!donorId) return Response.json({ error: "donorId required" }, { status: 400 });

  try {
    const { providerMessageId, donor } = await sendDonorUpdateNotice(donorId, summary);
    return Response.json({ sent: true, donor: donor.name, providerMessageId });
  } catch (err) {
    return Response.json({ sent: false, reason: err.message });
  }
}
