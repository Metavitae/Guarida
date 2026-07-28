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

  // The caller's own org, not a global env default - see the identical fix
  // in /api/fosters/send-checkin and /api/vet-care/send-notice. Uses
  // my_org() (security-definer RPC) rather than a direct organizations
  // select, same recursive-RLS-on-`people` sidestep as case-intake.
  const { data: callerOrg } = await authClient.rpc("my_org").maybeSingle();
  if (!callerOrg?.org_id) return Response.json({ error: "Could not resolve your org membership" }, { status: 403 });

  const { donorId, summary } = await request.json();
  if (!donorId) return Response.json({ error: "donorId required" }, { status: 400 });

  try {
    const { providerMessageId, donor } = await sendDonorUpdateNotice(donorId, summary, callerOrg.org_id);
    return Response.json({ sent: true, donor: donor.name, providerMessageId });
  } catch (err) {
    return Response.json({ sent: false, reason: err.message });
  }
}
