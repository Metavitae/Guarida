"use client";
import { useState } from "react";
import { PawPrint, Home as HomeIcon, TreePine, Phone, Mail, ExternalLink, MapPin, AlertCircle } from "lucide-react";
import Nav from "../../components/Nav";
import Reveal from "../../components/Reveal";
import { COLORS, FONTS } from "../../lib/design-tokens";

// Reference content only - not a form/workflow. Every number/link here is
// verbatim from Wet Noses' own published protocol (wetnosesrescue.org/report/)
// plus verified Mexican federal/state sources - nothing invented. Two gaps
// are explicitly unverified and shown as such rather than guessed:
// no direct phone line found for Bahía de Banderas' Bienestar Animal office,
// and no public info on a separate after-hours line for Wet Noses' own clinic.

function SourceTag({ children, light = false }) {
  return (
    <span
      style={{
        color: light ? `${COLORS.paper}99` : `${COLORS.ink}77`,
        fontFamily: FONTS.mono,
        border: `1px solid ${light ? `${COLORS.paper}33` : COLORS.line}`,
      }}
      className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full"
    >
      {children}
    </span>
  );
}

function ContactCard({ title, source, children, accent = COLORS.teal }) {
  return (
    <div style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${COLORS.line}` }} className="rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 style={{ fontFamily: FONTS.display, color: COLORS.ink }} className="text-lg">{title}</h3>
        <SourceTag>{source}</SourceTag>
      </div>
      <div style={{ color: `${COLORS.ink}cc` }} className="text-sm leading-relaxed space-y-2">
        {children}
      </div>
    </div>
  );
}

function NotAvailable({ label }) {
  return (
    <div style={{ color: `${COLORS.ink}66` }} className="flex items-center gap-1.5 text-xs italic">
      <AlertCircle size={12} />
      {label}: not publicly available — not listed here rather than guessed.
    </div>
  );
}

const SITUATIONS = [
  { key: "street", label: "Public street animal", icon: PawPrint },
  { key: "private", label: "Private property", icon: HomeIcon },
  { key: "wildlife", label: "Wildlife", icon: TreePine },
];

export default function EmergencyPage() {
  const [situation, setSituation] = useState("street");
  const [location, setLocation] = useState("nayarit");

  return (
    <div style={{ backgroundColor: COLORS.paper, minHeight: "100vh", fontFamily: FONTS.body }}>
      <Nav crumb="Emergency Numbers" />

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 style={{ fontFamily: FONTS.display, color: COLORS.ink }} className="text-3xl mb-2">
          Report abuse or neglect
        </h1>
        <p style={{ color: `${COLORS.ink}99` }} className="text-sm mb-8">
          The right contact depends on the situation and where it's happening. This is a reference page, not a report form — it points you to the real authority's own channel. First time reporting?{" "}
          <a href="/report-guide" style={{ color: COLORS.teal }} className="underline">
            Read the step-by-step guide
          </a>.
        </p>

        {/* Situation picker */}
        <Reveal>
          <div className="flex gap-2 mb-4">
            {SITUATIONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSituation(key)}
                style={{
                  backgroundColor: situation === key ? COLORS.coral : "#FFFFFF",
                  color: situation === key ? "#FFFFFF" : COLORS.ink,
                  border: `1.5px solid ${situation === key ? COLORS.coral : COLORS.line}`,
                }}
                className="flex-1 rounded-xl py-3 text-xs font-medium flex flex-col items-center gap-1.5"
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </Reveal>

        {/* Location toggle - not applicable to wildlife, which is federal */}
        {situation !== "wildlife" && (
          <div className="flex items-center gap-2 mb-8">
            <MapPin size={13} color={`${COLORS.ink}77`} />
            <span style={{ color: `${COLORS.ink}77`, fontFamily: FONTS.mono }} className="text-xs uppercase tracking-wide mr-1">Location:</span>
            {["nayarit", "jalisco"].map((loc) => (
              <button
                key={loc}
                onClick={() => setLocation(loc)}
                style={{
                  backgroundColor: location === loc ? COLORS.teal : "transparent",
                  color: location === loc ? "#FFFFFF" : COLORS.teal,
                  border: `1.5px solid ${COLORS.teal}`,
                }}
                className="rounded-full px-3 py-1 text-xs font-medium capitalize"
              >
                {loc === "jalisco" ? "Jalisco (Puerto Vallarta)" : "Nayarit"}
              </button>
            ))}
          </div>
        )}
        {situation === "wildlife" && (
          <p style={{ color: `${COLORS.ink}77` }} className="text-xs mb-8 -mt-4">
            Wildlife cases go through a federal authority — location doesn't change who to contact.
          </p>
        )}

        {/* Primary routed result */}
        <Reveal delay={0.03} className="mb-4">
          {situation === "wildlife" && (
            <ContactCard title="PROFEPA — Federal wildlife authority" source="Federal · fauna silvestre only" accent={COLORS.marigold}>
              <p><strong>For wildlife (fauna silvestre) only — not domestic dogs/cats.</strong> Use one of the Nayarit/Jalisco channels above for domestic animals.</p>
              <a href="tel:8007763372" style={{ color: COLORS.teal }} className="flex items-center gap-2 font-medium">
                <Phone size={14} /> 800 776 3372 (toll-free)
              </a>
              <a href="mailto:denuncias@profepa.gob.mx" style={{ color: COLORS.teal }} className="flex items-center gap-2 font-medium">
                <Mail size={14} /> denuncias@profepa.gob.mx
              </a>
            </ContactCard>
          )}

          {situation === "street" && location === "nayarit" && (
            <ContactCard title="Bahía de Banderas — Bienestar Animal" source="Municipal · Nayarit">
              <p>Covers Punta de Mita and the rest of Bahía de Banderas.</p>
              <a href="https://bahiadebanderas.gob.mx/medioambiente/solicitud-y-denuncia/" target="_blank" rel="noopener noreferrer"
                style={{ color: COLORS.teal }} className="flex items-center gap-2 font-medium">
                <ExternalLink size={14} /> Report online — select "Fauna doméstica"
              </a>
              <p style={{ color: `${COLORS.ink}99` }} className="text-xs">
                In person: Centro Empresarial de Nuevo Vallarta, 2° piso, Paseo de los Cocoteros.
              </p>
              <NotAvailable label="Direct phone line" />
            </ContactCard>
          )}

          {situation === "private" && location === "nayarit" && (
            <ContactCard title="Bahía de Banderas — Bienestar Animal" source="Municipal · Nayarit">
              <p style={{ color: `${COLORS.ink}99` }} className="text-xs mb-1">
                Nayarit's published protocol doesn't separate public vs. private property cases — same channel either way.
              </p>
              <a href="https://bahiadebanderas.gob.mx/medioambiente/solicitud-y-denuncia/" target="_blank" rel="noopener noreferrer"
                style={{ color: COLORS.teal }} className="flex items-center gap-2 font-medium">
                <ExternalLink size={14} /> Report online — select "Fauna doméstica"
              </a>
              <p style={{ color: `${COLORS.ink}99` }} className="text-xs">
                In person: Centro Empresarial de Nuevo Vallarta, 2° piso, Paseo de los Cocoteros.
              </p>
              <NotAvailable label="Direct phone line" />
            </ContactCard>
          )}

          {situation === "street" && location === "jalisco" && (
            <ContactCard title="Puerto Vallarta — animal in a public area" source="Jalisco">
              <a href="tel:911" style={{ color: COLORS.teal }} className="flex items-center gap-2 font-medium">
                <Phone size={14} /> Call 911 — request "Patrulla Verde"
              </a>
            </ContactCard>
          )}

          {situation === "private" && location === "jalisco" && (
            <ContactCard title="Puerto Vallarta — animal on private property" source="Jalisco">
              <a href="tel:+523222933690" style={{ color: COLORS.teal }} className="flex items-center gap-2 font-medium">
                <Phone size={14} /> 322 293 3690
              </a>
              <p style={{ color: `${COLORS.ink}99` }} className="text-xs">Monday–Friday, 9:00 AM – 4:00 PM.</p>
            </ContactCard>
          )}
        </Reveal>

        {/* Nayarit state-level, distinct from the municipal channel above */}
        {situation !== "wildlife" && location === "nayarit" && (
          <Reveal delay={0.06} className="mb-4">
            <ContactCard title="Nayarit state hotline — general animal cruelty" source="State · Nayarit">
              <a href="tel:089" style={{ color: COLORS.teal }} className="flex items-center gap-2 font-medium">
                <Phone size={14} /> 089
              </a>
              <p style={{ color: `${COLORS.ink}99` }} className="text-xs">
                Or in person: Módulo de Atención Temprana de la Fiscalía del Estado.
              </p>
            </ContactCard>
          </Reveal>
        )}

        {/* Always-visible general emergency */}
        <Reveal delay={0.09} className="mb-4">
          <ContactCard title="Any immediate emergency" source="Nationwide">
            <a href="tel:911" style={{ color: COLORS.teal }} className="flex items-center gap-2 font-medium">
              <Phone size={14} /> 911 — works in Nayarit and Jalisco both
            </a>
          </ContactCard>
        </Reveal>

        {/* Always-visible Wet Noses fallback */}
        <Reveal delay={0.12}>
          <div style={{ backgroundColor: COLORS.nightDeep }} className="rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 style={{ fontFamily: FONTS.display, color: COLORS.paper }} className="text-lg">Not sure? Contact Wet Noses directly</h3>
              <SourceTag light>Wet Noses Rescue</SourceTag>
            </div>
            <div className="space-y-2 text-sm">
              <a href="tel:+12064137446" style={{ color: COLORS.marigold }} className="flex items-center gap-2 font-medium">
                <Phone size={14} /> +1 (206) 413-7446
              </a>
              <a href="mailto:info@wetnosesrescue.org" style={{ color: COLORS.marigold }} className="flex items-center gap-2 font-medium">
                <Mail size={14} /> info@wetnosesrescue.org
              </a>
              <div style={{ color: `${COLORS.paper}77` }} className="flex items-center gap-1.5 text-xs italic pt-1">
                <AlertCircle size={12} />
                A separate after-hours vet line: not publicly available — not listed here rather than guessed.
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
