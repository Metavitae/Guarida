import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase-server";

// Magic-link redirect target: exchanges the one-time code for a real
// session (written to cookies), then sends the worker on to whatever page
// they were trying to reach.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/case-intake";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?reason=auth-error`);
}
