// This is the one place the app talks to Supabase directly.
// Needs real values once a Supabase project exists — until then, every
// function here will throw clearly rather than silently fail, so it's
// obvious when something's running against a real backend vs. mock data.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
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

  return references
    .map((ref) => {
      const refWords = `${ref.title} ${ref.summary}`.toLowerCase().split(/\s+/);
      const overlap = refWords.filter((w) => words.has(w)).length;
      return { ...ref, score: overlap };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
