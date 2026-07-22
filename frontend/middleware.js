import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Gates /case-intake, /donors, /vet-care, /inventory, /expenses,
// /cross-border, /authority-report to active admin/staff/vet workers, and /legal-review to
// admin/legal_reviewer specifically (a narrower, separate role - a
// legal_reviewer should never pass the general worker check, and general
// workers who aren't admin should never pass the legal-review check).
// Both checks run live from the DB on every matched request, not just at
// sign-in - not a cached JWT claim, which is what makes revoking someone's
// membership take effect on their very next request instead of waiting for
// token expiry - the same kill-switch guarantee the RLS layer already
// gives data access.
export async function middleware(request) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() (not getSession()) deliberately - it revalidates the JWT
  // against Supabase's Auth server instead of trusting a possibly-stale
  // cookie, which matters for a page-level guard like this one.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const isLegalReviewRoute = request.nextUrl.pathname.startsWith("/legal-review");
  const routeRpc = isLegalReviewRoute ? "can_review_legal" : "is_active_worker";
  const { data: hasRouteAccess } = await supabase.rpc(routeRpc);

  if (!hasRouteAccess) {
    // Before treating this as a revoked/invalid account, check whether they
    // have ANY recognized active role at all. A legal_reviewer hitting
    // /inventory (or an admin/staff/vet hitting /legal-review without being
    // admin) is just the wrong page for their role, not an account problem
    // - don't force them to re-login over that. Only sign out when neither
    // check passes, i.e. their account genuinely has no active role.
    const [{ data: isWorker }, { data: isReviewer }] = await Promise.all([
      supabase.rpc("is_active_worker"),
      supabase.rpc("can_review_legal"),
    ]);
    const hasAnyRole = isWorker || isReviewer;

    if (!hasAnyRole) {
      await supabase.auth.signOut();
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", hasAnyRole ? "wrong-page" : "revoked");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/case-intake/:path*", "/donors/:path*", "/vet-care/:path*",
    "/inventory/:path*", "/expenses/:path*", "/cross-border/:path*",
    "/legal-review/:path*", "/authority-report/:path*",
  ],
};
