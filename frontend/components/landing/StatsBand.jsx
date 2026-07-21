import { COLORS, FONTS } from "../../lib/landing-tokens";

// PLACEHOLDER NUMBERS - these need to come from the founder/database
// before launch. Not wired to Supabase in this pass, per task scope.
const STATS = [
  { value: "214", label: "Animals rescued, 2025" },
  { value: "38", label: "Active foster homes" },
  { value: "100%", label: "Expenses tracked per case" },
];

export default function StatsBand() {
  return (
    <section style={{ backgroundColor: COLORS.seaGlass }} className="px-6 py-16">
      <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-10 text-center">
        {STATS.map((s) => (
          <div key={s.label}>
            <div
              style={{ fontFamily: FONTS.display, color: COLORS.deepTide }}
              className="text-4xl md:text-5xl mb-2"
            >
              {s.value}
            </div>
            <div
              style={{ fontFamily: FONTS.mono, color: `${COLORS.charcoal}99` }}
              className="text-xs uppercase tracking-wide"
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
