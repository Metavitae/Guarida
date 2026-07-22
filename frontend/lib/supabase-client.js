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

