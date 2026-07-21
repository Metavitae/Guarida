import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Gates /case-intake, /donors, /vet-care to active admin/staff/vet workers
// only. Runs on every matched request, not just at sign-in - is_active_worker()
// is queried live from the DB each time (not a cached JWT claim), which is
// what makes revoking someone's membership take effect on their very next
// request instead of waiting for token expiry - the same kill-switch
// guarantee the RLS layer already gives data access.
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

  const { data: isWorker } = await supabase.rpc("is_active_worker");

  if (!isWorker) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "revoked");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/case-intake/:path*", "/donors/:path*", "/vet-care/:path*"],
};
