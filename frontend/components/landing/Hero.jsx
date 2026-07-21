"use client";
import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { COLORS, FONTS } from "../../lib/landing-tokens";

// CTA hrefs are placeholders - no donation or adoption-listing pages exist
// yet, per this task's scope (UI only, no real data/destinations wired).
export default function Hero() {
  return (
    <section
      style={{ backgroundColor: COLORS.deepTide }}
      className="relative min-h-screen flex flex-col items-center justify-center px-6 py-24 overflow-hidden text-center"
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        className="relative max-w-2xl"
      >
        <div
          style={{ color: COLORS.marigold, fontFamily: FONTS.mono }}
          className="text-xs tracking-[0.3em] uppercase mb-6"
        >
          Wet Noses Rescue — Punta de Mita, Nayarit
        </div>

        <h1
          style={{ fontFamily: FONTS.display, color: COLORS.bone }}
          className="text-5xl md:text-7xl leading-tight mb-6"
        >
          Every case is a story.
          <br />
          Yours can change how it ends.
        </h1>

        <p
          style={{ color: `${COLORS.seaGlass}cc`, fontFamily: FONTS.body }}
          className="text-base md:text-lg leading-relaxed max-w-lg mx-auto mb-10"
        >
          Every animal that comes through Wet Noses has a real, specific
          path — from the moment they're found to the moment they're safe.
          Follow one below, then help write the next one.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#"
            style={{ backgroundColor: COLORS.marigold, color: COLORS.deepTide, fontFamily: FONTS.body }}
            className="px-8 py-4 rounded-full font-medium text-sm tracking-wide"
          >
            Sponsor a case
          </a>
          <a
            href="#"
            style={{ border: `1.5px solid ${COLORS.seaGlass}55`, color: COLORS.bone, fontFamily: FONTS.body }}
            className="px-8 py-4 rounded-full font-medium text-sm tracking-wide"
          >
            See adoptable animals
          </a>
        </div>

        {/* Normal document flow, not absolutely positioned - stays below
            the CTAs on every viewport instead of overlapping them. */}
        <div
          style={{ color: `${COLORS.seaGlass}88`, fontFamily: FONTS.mono }}
          className="mt-12 flex items-center justify-center gap-2 text-xs uppercase tracking-wide"
        >
          <ArrowDown size={14} />
          Scroll to follow a case
        </div>
      </motion.div>
    </section>
  );
}
