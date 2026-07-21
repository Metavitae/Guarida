import { Instagram, Facebook, MessageCircle, Music2 } from "lucide-react";
import { COLORS, FONTS } from "../../lib/landing-tokens";

// Social hrefs are placeholders - real accounts don't exist yet, per task scope.
const SOCIALS = [
  { icon: Instagram, label: "Instagram", href: "#" },
  { icon: Facebook, label: "Facebook", href: "#" },
  { icon: MessageCircle, label: "WhatsApp", href: "#" },
  { icon: Music2, label: "TikTok", href: "#" },
];

export default function Footer() {
  return (
    <footer style={{ backgroundColor: COLORS.deepTide }} className="px-6 pt-20 pb-10">
      <div className="max-w-3xl mx-auto text-center mb-16">
        <h2 style={{ fontFamily: FONTS.display, color: COLORS.bone }} className="text-3xl md:text-4xl mb-8">
          Help write the next ending.
        </h2>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#"
            style={{ backgroundColor: COLORS.marigold, color: COLORS.deepTide, fontFamily: FONTS.body }}
            className="px-8 py-4 rounded-full font-medium text-sm tracking-wide"
          >
            Donate to an open case
          </a>
          <a
            href="#"
            style={{ border: `1.5px solid ${COLORS.seaGlass}55`, color: COLORS.bone, fontFamily: FONTS.body }}
            className="px-8 py-4 rounded-full font-medium text-sm tracking-wide"
          >
            Become a foster
          </a>
        </div>
      </div>

      <div
        style={{ borderTop: `1px solid ${COLORS.seaGlass}22` }}
        className="max-w-4xl mx-auto pt-10 grid grid-cols-1 md:grid-cols-3 gap-10 text-center md:text-left"
      >
        <div>
          <div style={{ fontFamily: FONTS.display, color: COLORS.bone }} className="text-lg mb-2">
            Wet Noses Rescue
          </div>
          <p style={{ color: `${COLORS.seaGlass}99`, fontFamily: FONTS.body }} className="text-sm leading-relaxed">
            Punta de Mita, Bahía de Banderas, Nayarit, México
            <br />
            Nonprofit animal rescue
          </p>
        </div>

        <div className="flex flex-col items-center md:items-start">
          <div
            style={{ color: `${COLORS.seaGlass}99`, fontFamily: FONTS.mono }}
            className="text-xs uppercase tracking-wide mb-3"
          >
            Follow along
          </div>
          <div className="flex gap-3">
            {SOCIALS.map(({ icon: Icon, label, href }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                style={{ backgroundColor: `${COLORS.seaGlass}14`, color: COLORS.bone }}
                className="h-9 w-9 rounded-full flex items-center justify-center"
              >
                <Icon size={15} />
              </a>
            ))}
          </div>
        </div>

        <div>
          <p style={{ color: `${COLORS.seaGlass}77`, fontFamily: FONTS.body }} className="text-xs leading-relaxed">
            Legal information shown on this site is advisory and pending
            attorney review. Case details are shared with foster/adopter
            consent.
          </p>
        </div>
      </div>
    </footer>
  );
}
