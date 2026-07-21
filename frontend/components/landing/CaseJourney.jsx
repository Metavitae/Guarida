"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { PawPrint, Check, ImageOff } from "lucide-react";
import { COLORS, FONTS } from "../../lib/landing-tokens";

// PLACEHOLDER case content - a real case's photos and details, once
// case_photos has real public_ok=true / sensitivity=normal rows, will
// come through the already-built public_case_photos() function. Not
// wired here; this pass is UI only, per task scope.
const STAGES = [
  {
    key: "found",
    label: "Found",
    tag: "CASE #0417 — DAY 1",
    title: "Found near the marina, underweight and alone",
    description:
      "A resident reported a stray dog sheltering under a boat trailer, no collar, visibly thin. Our team responded the same afternoon.",
  },
  {
    key: "vet",
    label: "Vet Care",
    tag: "CASE #0417 — DAY 3",
    title: "First real meal, first real checkup",
    description:
      "Cleared of anything urgent, started on a recovery feeding plan and basic bloodwork with our partner vet in Bucerías.",
  },
  {
    key: "foster",
    label: "Foster",
    tag: "CASE #0417 — DAY 12",
    title: "A foster home, and a name",
    description:
      "Strong enough to leave the clinic. A local foster family took her in — this is usually where a case starts to feel like a future.",
  },
  {
    key: "forever",
    label: "Forever Home",
    tag: "CASE #0417 — DAY 47",
    title: "Adopted",
    description:
      "47 days after being found under a boat trailer, she went home for good. This is the ending every case is working toward.",
  },
];

function ProgressPath({ activeIndex }) {
  return (
    <div className="flex items-center gap-1.5 mb-5">
      {STAGES.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1.5 flex-1 last:flex-none">
          <div
            style={{
              backgroundColor: i <= activeIndex ? COLORS.marigold : `${COLORS.charcoal}22`,
              color: i <= activeIndex ? COLORS.deepTide : "transparent",
            }}
            className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300"
          >
            {i < activeIndex && <Check size={11} />}
          </div>
          {i < STAGES.length - 1 && (
            <div
              style={{ backgroundColor: i < activeIndex ? COLORS.marigold : `${COLORS.charcoal}22` }}
              className="h-0.5 flex-1 transition-colors duration-300"
            />
          )}
        </div>
      ))}
    </div>
  );
}

function CaseSnapshot({ activeIndex, scale = true }) {
  const stage = STAGES[activeIndex];
  return (
    <motion.div
      animate={scale ? { scale: 1 + activeIndex * 0.015 } : undefined}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{ backgroundColor: COLORS.bone, border: `1px solid ${COLORS.charcoal}14` }}
      className="rounded-3xl overflow-hidden shadow-xl w-full max-w-sm"
    >
      {/* Placeholder photo - deliberately, not a broken image. Real photos
          come from public_case_photos() in a future task. */}
      <div
        style={{ backgroundColor: `${COLORS.deepTide}0d` }}
        className="aspect-[4/3] flex flex-col items-center justify-center gap-2"
      >
        <ImageOff size={22} color={`${COLORS.charcoal}44`} />
        <span
          style={{ color: `${COLORS.charcoal}66`, fontFamily: FONTS.mono }}
          className="text-[10px] uppercase tracking-wide"
        >
          Photo pending review
        </span>
      </div>

      <div className="p-6">
        <div
          style={{ color: COLORS.clayRose, fontFamily: FONTS.mono }}
          className="text-xs tracking-wide mb-3"
        >
          {stage.tag}
        </div>
        <ProgressPath activeIndex={activeIndex} />
        <h3 style={{ fontFamily: FONTS.display, color: COLORS.charcoal }} className="text-xl mb-2">
          {stage.title}
        </h3>
        <p style={{ color: `${COLORS.charcoal}99`, fontFamily: FONTS.body }} className="text-sm leading-relaxed">
          {stage.description}
        </p>
      </div>
    </motion.div>
  );
}

function Beat({ stage, index, onEnter }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ amount: 0.6, once: false }}
      onViewportEnter={() => onEnter(index)}
      transition={{ duration: 0.5 }}
      className="min-h-[60vh] flex flex-col justify-center"
    >
      <div
        style={{ color: COLORS.marigold, fontFamily: FONTS.mono }}
        className="text-xs uppercase tracking-widest mb-3"
      >
        Stage {index + 1} of {STAGES.length}
      </div>
      <h3 style={{ fontFamily: FONTS.display, color: COLORS.charcoal }} className="text-3xl mb-3">
        {stage.label}
      </h3>
      <p style={{ color: `${COLORS.charcoal}99`, fontFamily: FONTS.body }} className="text-base leading-relaxed max-w-sm">
        {stage.description}
      </p>

      {/* Mobile: each beat carries its own snapshot inline, since a
          shared sticky card doesn't make sense without real stickiness -
          "stack normally," not a broken sticky element on small screens. */}
      <div className="mt-6 md:hidden">
        <CaseSnapshot activeIndex={index} scale={false} />
      </div>
    </motion.div>
  );
}

export default function CaseJourney() {
  const [activeStage, setActiveStage] = useState(0);

  return (
    <section style={{ backgroundColor: COLORS.seaGlass }} className="px-6 py-24">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <div style={{ color: COLORS.clayRose, fontFamily: FONTS.mono }} className="text-xs tracking-widest uppercase mb-3">
            <PawPrint size={12} className="inline mr-1.5 -mt-0.5" />
            One case, followed
          </div>
          <h2 style={{ fontFamily: FONTS.display, color: COLORS.charcoal }} className="text-3xl md:text-4xl">
            Found → Vet Care → Foster → Forever Home
          </h2>
        </div>

        <div className="md:grid md:grid-cols-2 md:gap-16">
          {/* Desktop-only sticky card - hidden on mobile, where each Beat
              below renders its own inline snapshot instead. */}
          <div className="hidden md:block">
            <div className="sticky top-24 flex justify-center">
              <CaseSnapshot activeIndex={activeStage} />
            </div>
          </div>

          <div>
            {STAGES.map((stage, i) => (
              <Beat key={stage.key} stage={stage} index={i} onEnter={setActiveStage} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
