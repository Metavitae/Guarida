"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PawPrint } from "lucide-react";
import { supabase } from "../../lib/supabase-client";
import { useAppTheme, useOrgCopy } from "../../lib/theme-context";

// Internal worker sign-in only - matches the existing app's design system
// (ocean-night/coral/marigold), not the public landing page's palette,
// since this page is never meant for donors/volunteers/the public.
const REASON_MESSAGES = {
  revoked: "Your access has been removed. If this seems wrong, contact your org admin.",
  "auth-error": "That link didn't work or has expired. Request a new one below.",
  "wrong-page": "You're signed in, but don't have access to that page. Sign in again to reach a page for your role.",
};

export default function LoginForm() {
  const { COLORS, FONTS, FONT_IMPORT, inputStyle } = useAppTheme();
  // "For Wet Noses staff..." used to be hardcoded here - now themeable per
  // org (see docs/multi-org-theming-schema.md's copy.loginSubtitle),
  // falling back to Wet Noses' own current line if no theme row exists.
  const { loginSubtitle } = useOrgCopy({ loginSubtitle: "For Wet Noses staff, admins, and vets only." });
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div style={{ backgroundColor: COLORS.paper, minHeight: "100vh", fontFamily: FONTS.body }}>
      <style>{FONT_IMPORT}</style>
      <div style={{ backgroundColor: COLORS.night }} className="px-6 md:px-12 py-5 flex items-center gap-3">
        <PawPrint size={18} color={COLORS.marigold} />
        <span style={{ fontFamily: FONTS.display, color: COLORS.paper }} className="text-lg">
          Guarida
        </span>
      </div>

      <div className="max-w-sm mx-auto px-6 py-20">
        <h1 style={{ fontFamily: FONTS.display, color: COLORS.ink }} className="text-2xl mb-2">
          Worker sign-in
        </h1>
        <p style={{ color: `${COLORS.ink}99` }} className="text-sm mb-8">
          {loginSubtitle}
        </p>

        {reason && REASON_MESSAGES[reason] && (
          <div
            style={{ backgroundColor: `${COLORS.coral}12`, border: `1px solid ${COLORS.coral}44`, color: COLORS.ink }}
            className="rounded-xl px-4 py-3 mb-6 text-sm"
          >
            {REASON_MESSAGES[reason]}
          </div>
        )}

        {sent ? (
          <div style={{ color: COLORS.ink }} className="text-sm">
            Check your email for a sign-in link.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@wetnoses.org"
              style={inputStyle}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none mb-4"
            />
            <button
              type="submit"
              style={{ backgroundColor: COLORS.coral, color: "#FFFFFF" }}
              className="w-full rounded-full py-3 font-medium text-sm"
            >
              Send magic link
            </button>
            {error && (
              <p style={{ color: COLORS.coral }} className="text-xs mt-3">
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
