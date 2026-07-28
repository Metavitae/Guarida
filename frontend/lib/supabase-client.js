// This is the one place the app talks to Supabase directly.
// Needs real values once a Supabase project exists — until then, every
// function here will throw clearly rather than silently fail, so it's
// obvious when something's running against a real backend vs. mock data.

import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Cookie-based client (via @supabase/ssr) instead of the plain JS SDK's
// localStorage-based one - this is what lets the login/logout flow and
// middleware.js's server-side auth checks share the same session as any
// data query made from this file.
export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase isn't configured yet — set NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY once the project exists. Until then " +
      "screens fall back to sample data, clearly labeled as such."
    );
  }
  return supabase;
}

// Multi-org membership (2026-07-28, see docs/multi-org-membership-schema.md):
// most people belong to exactly one active org, so this returns it with no
// ambiguity. For someone active in more than one, this honors their real
// choice from the org-switcher (the gd_current_org_id cookie) if that
// choice is still one of their actual active memberships - falls back to
// the first active membership otherwise, which covers single-org people
// (who never see the switcher and never set this cookie - zero behavior
// change for them) and a stale cookie left over from a since-revoked
// membership.
export const CURRENT_ORG_COOKIE = "gd_current_org_id";

function readCookie(name) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function getCurrentOrgId(client = supabase) {
  if (!client) return null;
  const { data: memberships } = await client.from("memberships").select("org_id").eq("status", "active");
  if (!memberships?.length) return null;
  const cookieOrg = readCookie(CURRENT_ORG_COOKIE);
  if (cookieOrg && memberships.some((m) => m.org_id === cookieOrg)) return cookieOrg;
  return memberships[0].org_id;
}

// English-language coverage, additive to the Spanish literal-text matching
// below. Wet Noses' foster network reaches the US/Canada, so an English
// description needs to match too — the legal_references table itself is
// Spanish-only (real Mexican statute text), so word-overlap against
// title+summary alone can never catch English input. Hand-picked per
// statute_code so each keyword/phrase actually corresponds to what that
// specific law covers, not a blind word-for-word translation.
const EN_KEYWORDS_BY_STATUTE = {
  "CPN Art. 422 (also cited as Art. 384 in one source — needs lawyer verification)": [
    "tied up", "tied", "chained", "without food", "without water", "no food",
    "no water", "starving", "starved", "dehydrated", "dehydration",
    "abandoned", "abandonment", "neglect", "torture", "mutilation",
    "deprived", "deprivation", "shelter", "veterinary care", "cruelty", "abuse",
  ],
  "CPN Art. 423": [
    "recorded", "filmed", "video", "published", "posted online", "veterinarian",
  ],
  "Ley de Protección a la Fauna para el Estado de Nayarit, Art. 71": [
    "duty to report", "obligation to report", "witness", "report to authorities",
  ],
  "Reglamento de Tenencia Responsable y Protección de Animales Domésticos y de Compañía del Municipio de Bahía de Banderas": [
    "municipal", "municipality", "complaint", "report", "hotline", "animal control",
    "seizure", "arrest", "fine", "community service", "Bahia de Banderas", "Punta de Mita",
  ],
};

// Real version of the suggestLegalMatches logic from case-intake.js,
// adapted to run client-side against the actual legal_references table
// instead of the hardcoded 3-entry sample the first mockup used.
export async function suggestLegalMatches(description, jurisdiction) {
  const client = requireSupabase();

  const { data: references, error } = await client
    .from("legal_references")
    .select("id, title, summary, statute_code, jurisdiction, lawyer_reviewed")
    .eq("jurisdiction", jurisdiction);

  if (error) throw error;
  if (!references || !references.length) return [];

  const words = new Set(
    description.toLowerCase().replace(/[^\w\sáéíóúñ]/gi, "").split(/\s+/).filter(Boolean)
  );
  const lowerDescription = description.toLowerCase();

  return references
    .map((ref) => {
      const refWords = `${ref.title} ${ref.summary}`.toLowerCase().split(/\s+/);
      const spanishScore = refWords.filter((w) => words.has(w)).length;
      const enKeywords = EN_KEYWORDS_BY_STATUTE[ref.statute_code] || [];
      const englishScore = enKeywords.filter((kw) => lowerDescription.includes(kw)).length;
      return { ...ref, score: spanishScore + englishScore };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

