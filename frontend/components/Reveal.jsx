"use client";
import { motion } from "framer-motion";

// Scroll-triggered reveal for internal-app cards/sections — same
// fade+slide, re-triggering `once: false` style already established and
// approved on the public landing page's CaseJourney component, tuned
// faster (shorter distance, shorter duration) since this is a working
// staff tool, not a marketing site: data loads and interaction are never
// gated on this, it's a purely presentational wrapper around content
// that's already fetched by the time it renders.
export default function Reveal({ children, delay = 0, className }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.2 }}
      transition={{ duration: 0.25, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
