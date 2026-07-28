import { createClient } from "@supabase/supabase-js";
import { getTemplateStatuses } from "../../../../lib/whatsapp";

// Read-only diagnostic: confirms the deployed META_WHATSAPP_TOKEN is
// actually valid (not just present) and reports Meta's current review
// status for the three pending templates. No message send, no side
// effects — safe to call as often as needed.
//
// Auth is bearer-token based (Authorization: Bearer <supabase access
// token>) rather than the cookie-based pattern the send-notice routes
// use, since this is meant to be checked as a plain API call (e.g. from
// a script or curl), not only from the logged-in browser app. Same
// underlying check either way: a real active-worker RLS session, not a
// bypass — createClient with the token attached means .rpc() runs as
// that authenticated user, same as cookie-based auth would.
const TEMPLATE_NAMES = ["guarida_vet_care_notice", "guarida_foster_checkin", "guarida_donor_update_v2"];

export async function GET(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "Authorization: Bearer <token> required" }, { status: 401 });

  const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userErr } = await authClient.auth.getUser();
  if (userErr || !user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  // Multi-org (2026-07-28): this route is bearer-token based (per the
  // comment above, deliberately callable from a script/curl, not just the
  // browser), so it has no cookie to read a switcher choice from - an
  // explicit ?orgId= query param is the equivalent for a script caller.
  // is_active_worker(check_org_id) re-verifies it's a real active
  // membership, never trusted blindly. Falls back to my_org()'s own
  // arbitrary-first-org behavior if omitted, same as before, correct for
  // every single-org caller (100% of them today).
  const requestedOrgId = new URL(request.url).searchParams.get("orgId");
  const { data: isWorker } = await authClient.rpc("is_active_worker", requestedOrgId ? { check_org_id: requestedOrgId } : undefined);
  if (!isWorker) return Response.json({ error: "Not an active worker" }, { status: 403 });

  // The caller's own org, not a global default - see docs/multi-org-whatsapp-schema.md.
  const { data: callerOrg } = await authClient.rpc("my_org", { check_org_id: requestedOrgId }).maybeSingle();
  if (!callerOrg?.org_id) return Response.json({ error: "Could not resolve your org membership" }, { status: 403 });

  try {
    const result = await getTemplateStatuses(callerOrg.org_id, TEMPLATE_NAMES);
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
