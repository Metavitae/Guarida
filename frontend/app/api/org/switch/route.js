import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { CURRENT_ORG_COOKIE } from "../../../../lib/supabase-client";

// Sets which org a multi-org person is currently acting as (see
// docs/multi-org-membership-schema.md). Verifies the requested org is a
// REAL active membership of theirs before setting anything - never trusts
// the org_id blindly, since this cookie is what every role check and page
// query keys off afterward.
export async function POST(request) {
  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { orgId } = await request.json();
  if (!orgId) return Response.json({ error: "orgId required" }, { status: 400 });

  const { data: myOrgs, error } = await authClient.rpc("my_orgs");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!myOrgs?.some((o) => o.org_id === orgId)) {
    return Response.json({ error: "Not an active member of that org" }, { status: 403 });
  }

  const response = Response.json({ ok: true, orgId });
  response.headers.append(
    "Set-Cookie",
    `${CURRENT_ORG_COOKIE}=${orgId}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`
  );
  return response;
}
