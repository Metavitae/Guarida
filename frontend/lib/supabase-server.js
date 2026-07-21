// Server-side Supabase client for Route Handlers / Server Components,
// using cookie-based session storage so it shares auth state with
// middleware.js and the browser client in supabase-client.js.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render, not a Route Handler -
            // middleware.js refreshes the session on the next request
            // either way, safe to ignore here.
          }
        },
      },
    }
  );
}
