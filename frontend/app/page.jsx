"use client";
import React, { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { PawPrint, HeartHandshake, Stethoscope, Users, ArrowDown } from "lucide-react";

const COLORS = {
  night: "#10262E",
  nightDeep: "#0A1B21",
  teal: "#1F5C6B",
  coral: "#E8577A",
  marigold: "#E8B95C",
  paper: "#F3EDE0",
};

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
`;

const modules = [
  {
    icon: PawPrint,
    label: "Casos",
    title: "Cases",
    desc: "From first report to closed file — description, evidence, and the law that applies, all in one place.",
    color: COLORS.coral,
  },
  {
    icon: Users,
    label: "Familias",
    title: "Fosters & volunteers",
    desc: "Every foster placement, every shift, every person who shows up — tracked, never lost in a spreadsheet.",
    color: COLORS.marigold,
  },
  {
    icon: Stethoscope,
    label: "Clínica",
    title: "Veterinary care",
    desc: "A case that needs medical attention reaches your vets the moment it's flagged. No relay, no delay.",
    color: COLORS.teal,
  },
  {
    icon: HeartHandshake,
    label: "Comunidad",
    title: "Donors & supporters",
    desc: "Every peso and every dollar, traceable back to the animal it helped. Trust, made visible.",
    color: "#7A9E7E",
  },
];

function NestingCard({ mod, index, scrollYProgress }) {
  const Icon = mod.icon;
  const start = index * 0.12;
  const settle = useTransform(
    scrollYProgress,
    [0.15 + start, 0.4 + start],
    [80, 0]
  );
  const rotate = useTransform(
    scrollYProgress,
    [0.15 + start, 0.4 + start],
    [index % 2 === 0 ? -6 : 6, index % 2 === 0 ? -2 : 2]
  );
  const opacity = useTransform(
    scrollYProgress,
    [0.1 + start, 0.32 + start],
    [0, 1]
  );

  return (
    <motion.div
      style={{
        y: settle,
        rotate,
        opacity,
        backgroundColor: COLORS.nightDeep,
        border: `1px solid ${mod.color}33`,
        marginLeft: index % 2 === 0 ? 0 : "auto",
        marginTop: index === 0 ? 0 : "-2.5rem",
      }}
      className="relative w-full max-w-md rounded-3xl p-8 shadow-2xl"
    >
      <div
        style={{ backgroundColor: `${mod.color}22`, color: mod.color }}
        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl mb-5"
      >
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <div
        style={{ color: mod.color, fontFamily: "'IBM Plex Mono', monospace" }}
        className="text-xs tracking-widest uppercase mb-2"
      >
        {mod.label}
      </div>
      <h3
        style={{ fontFamily: "'Fraunces', serif", color: COLORS.paper }}
        className="text-2xl mb-3"
      >
        {mod.title}
      </h3>
      <p style={{ color: `${COLORS.paper}b3` }} className="text-sm leading-relaxed">
        {mod.desc}
      </p>
    </motion.div>
  );
}

export default function GuaridaLanding() {
  const nestRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: nestRef,
    offset: ["start end", "end start"],
  });

  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{FONT_IMPORT}</style>

      {/* ============ HERO ============ */}
      <section
        style={{
          background: `radial-gradient(circle at 20% 20%, ${COLORS.teal}55, transparent 55%), linear-gradient(180deg, ${COLORS.night} 0%, ${COLORS.nightDeep} 100%)`,
        }}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden"
      >
        {/* ambient bougainvillea glow */}
        <div
          style={{ background: COLORS.coral, filter: "blur(120px)", opacity: 0.18 }}
          className="absolute -top-20 -right-20 h-96 w-96 rounded-full"
        />
        <div
          style={{ background: COLORS.marigold, filter: "blur(140px)", opacity: 0.12 }}
          className="absolute bottom-0 left-0 h-96 w-96 rounded-full"
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="relative text-center max-w-3xl"
        >
          <div
            style={{ color: COLORS.marigold, fontFamily: "'IBM Plex Mono', monospace" }}
            className="text-xs tracking-[0.3em] uppercase mb-6"
          >
            Punta de Mita · Bahía de Banderas · Nayarit
          </div>
          <h1
            style={{ fontFamily: "'Fraunces', serif", color: COLORS.paper }}
            className="text-6xl md:text-8xl leading-none mb-6"
          >
            Guarida
          </h1>
          <p
            style={{ color: `${COLORS.paper}cc` }}
            className="text-lg md:text-xl leading-relaxed max-w-xl mx-auto"
          >
            Every case, every foster home, every donor — held in one place,
            the way a den holds everything that matters.
          </p>
        </motion.div>

        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{ color: `${COLORS.paper}88` }}
          className="absolute bottom-10"
        >
          <ArrowDown size={20} />
        </motion.div>
      </section>

      {/* ============ NESTING SCROLL SECTION ============ */}
      <section
        ref={nestRef}
        style={{ backgroundColor: COLORS.nightDeep, minHeight: "220vh" }}
        className="relative px-6 py-32"
      >
        <div className="sticky top-24">
          <div className="max-w-md mx-auto md:mx-0 md:ml-12 mb-16">
            <div
              style={{ color: COLORS.coral, fontFamily: "'IBM Plex Mono', monospace" }}
              className="text-xs tracking-widest uppercase mb-3"
            >
              Everything, in one den
            </div>
            <h2
              style={{ fontFamily: "'Fraunces', serif", color: COLORS.paper }}
              className="text-4xl md:text-5xl leading-tight"
            >
              Four things that usually live in four different places.
            </h2>
          </div>

          <div className="max-w-md mx-auto md:ml-24 space-y-0">
            {modules.map((mod, i) => (
              <NestingCard key={mod.title} mod={mod} index={i} scrollYProgress={scrollYProgress} />
            ))}
          </div>
        </div>
      </section>

      {/* ============ CLOSING ============ */}
      <section
        style={{
          background: `linear-gradient(180deg, ${COLORS.nightDeep} 0%, ${COLORS.night} 100%)`,
        }}
        className="px-6 py-32 flex flex-col items-center text-center"
      >
        <h2
          style={{ fontFamily: "'Fraunces', serif", color: COLORS.paper }}
          className="text-3xl md:text-4xl max-w-lg mb-6"
        >
          Built for Wet Noses. Built for whoever's next.
        </h2>
        <p style={{ color: `${COLORS.paper}b3` }} className="max-w-md mb-10 leading-relaxed">
          Wet Noses is the first org running on Guarida — not the only one it
          was built for.
        </p>
        <Link
          href="/case-intake"
          style={{ backgroundColor: COLORS.coral, color: COLORS.nightDeep }}
          className="px-8 py-4 rounded-full font-medium text-sm tracking-wide"
        >
          See it in action
        </Link>
      </section>
    </div>
  );
}
