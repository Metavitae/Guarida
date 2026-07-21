import { FONT_IMPORT } from "../lib/landing-tokens";
import Hero from "../components/landing/Hero";
import StatsBand from "../components/landing/StatsBand";
import CaseJourney from "../components/landing/CaseJourney";
import Footer from "../components/landing/Footer";

// Public landing page - fully unauthenticated, deliberately outside the
// login-gate middleware (which only matches /case-intake, /donors,
// /vet-care). Uses its own design system (lib/landing-tokens.js), not the
// internal app's - see that file for why these stay separate.
export default function LandingPage() {
  return (
    <>
      <style>{FONT_IMPORT}</style>
      <Hero />
      <StatsBand />
      <CaseJourney />
      <Footer />
    </>
  );
}
