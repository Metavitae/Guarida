"use client";
import { Eye, Camera, Landmark, FileCheck2, ShieldAlert, ExternalLink, MapPin } from "lucide-react";
import Nav from "../../components/Nav";
import Reveal from "../../components/Reveal";
import { COLORS, FONTS } from "../../lib/design-tokens";

// Public, unauthenticated page (deliberately not in middleware.js's
// matcher, same as /emergency) - a step-by-step explainer for someone who
// has never filed an animal-cruelty report before. /emergency stays the
// fast lookup-by-situation reference; this is the slower walkthrough for
// someone who needs the "why" and "what happens next" first.
//
// Every legal/process claim below is paraphrased from legal_references
// rows already in the live DB (CPN Art. 422/423, Ley de Protección a la
// Fauna Art. 71, and the Bahía de Banderas municipal reglamento) - no
// direct statute quotation, per task scope. Nothing here is invented:
// the "center not built yet" caveat in Step 3 is carried over verbatim
// in substance from that reglamento row's own source note.

function StepCard({ number, icon: Icon, title, children }) {
  return (
    <div style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${COLORS.line}` }} className="rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div style={{ backgroundColor: `${COLORS.teal}18` }} className="h-9 w-9 rounded-full flex items-center justify-center shrink-0">
          <Icon size={16} color={COLORS.teal} />
        </div>
        <div style={{ color: `${COLORS.ink}66`, fontFamily: FONTS.mono }} className="text-xs uppercase tracking-wide">
          Step {number}
        </div>
      </div>
      <h2 style={{ fontFamily: FONTS.display, color: COLORS.ink }} className="text-xl mb-3">
        {title}
      </h2>
      <div style={{ color: `${COLORS.ink}cc` }} className="text-sm leading-relaxed space-y-3">
        {children}
      </div>
    </div>
  );
}

export default function ReportGuidePage() {
  return (
    <div style={{ backgroundColor: COLORS.paper, minHeight: "100vh", fontFamily: FONTS.body }}>
      <Nav crumb="Reporting Guide" />

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 style={{ fontFamily: FONTS.display, color: COLORS.ink }} className="text-3xl mb-2">
          How to report animal abuse or neglect
        </h1>
        <p style={{ color: `${COLORS.ink}99` }} className="text-sm mb-6">
          A plain-language walkthrough for anyone reporting for the first time — what counts, what to do, who to contact, and what happens after. In a hurry?{" "}
          <a href="/emergency" style={{ color: COLORS.teal }} className="underline">
            Jump straight to phone numbers and links
          </a>.
        </p>

        {/* Mandatory disclaimer - more prominent here than elsewhere in the
            app since this page is public and unauthenticated. */}
        <Reveal>
          <div style={{ backgroundColor: `${COLORS.coral}12`, border: `1.5px solid ${COLORS.coral}55` }} className="rounded-2xl p-5 mb-8 flex gap-3">
            <ShieldAlert size={18} color={COLORS.coral} className="shrink-0 mt-0.5" />
            <p style={{ color: COLORS.ink }} className="text-sm leading-relaxed">
              <strong>This is general information, not legal advice.</strong> It is advisory only and has not been reviewed by a licensed attorney. Laws and reporting channels can change — when in doubt, contact the authority directly or consult a lawyer.
            </p>
          </div>
        </Reveal>

        <div className="space-y-4">
          <Reveal delay={0.03}>
            <StepCard number={1} icon={Eye} title="Recognize what counts">
              <p>
                Nayarit's animal-cruelty law covers more than physical violence. Broadly, it treats these as abuse or neglect:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Killing an animal by a method that isn't an accepted humane one, or that prolongs its suffering</li>
                <li>Torture, sadism, or mutilation with no legitimate medical reason</li>
                <li>Denying an animal air, light, food, water, shelter, or veterinary care</li>
                <li>Abandoning an animal in a way that puts its life at risk</li>
              </ul>
              <p style={{ color: `${COLORS.ink}77` }} className="text-xs">
                This is a plain-language summary, not the statute text — a lawyer hasn't reviewed the exact legal boundaries yet.
              </p>
            </StepCard>
          </Reveal>

          <Reveal delay={0.06}>
            <StepCard number={2} icon={Camera} title="Document what you can">
              <p>If it's safe to do so:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Take photos or video</li>
                <li>Note the date, time, and exact location</li>
                <li>Write down anything else you noticed while it's fresh</li>
              </ul>
              <p style={{ color: `${COLORS.ink}77` }} className="text-xs">
                Don't intervene or put yourself at risk to get evidence. This is general, practical guidance — not instructions for legally binding evidence handling.
              </p>
            </StepCard>
          </Reveal>

          <Reveal delay={0.09}>
            <StepCard number={3} icon={Landmark} title="Know who to contact">
              <p>
                In Bahía de Banderas (including Punta de Mita), the formal authority is the municipality's own animal-welfare unit — the <em>Unidad de Protección Animal</em>, backed by a <em>Centro de Control y Bienestar Animal</em> the local regulation calls for.
              </p>
              <p>
                <strong>Worth knowing:</strong> as of the most recent local reporting (2024), that dedicated center hasn't actually been built yet. In practice, reports commonly also go through municipal Public Security, Protección Civil, Medio Ambiente, or a civil association like Wet Noses — not just the one formal channel on paper.
              </p>
              <div className="pt-1 space-y-2">
                <a href="https://bahiadebanderas.gob.mx/medioambiente/solicitud-y-denuncia/" target="_blank" rel="noopener noreferrer"
                  style={{ color: COLORS.teal }} className="flex items-center gap-2 font-medium">
                  <ExternalLink size={14} /> Report online — select "Fauna doméstica"
                </a>
                <p style={{ color: `${COLORS.ink}99` }} className="text-xs flex items-center gap-1.5">
                  <MapPin size={12} /> In person: Centro Empresarial de Nuevo Vallarta, 2° piso, Paseo de los Cocoteros
                </p>
              </div>
              <p style={{ color: `${COLORS.ink}77` }} className="text-xs">
                Not in Bahía de Banderas, or need a phone number right now? See the{" "}
                <a href="/emergency" style={{ color: COLORS.teal }} className="underline">full contact reference</a>.
              </p>
            </StepCard>
          </Reveal>

          <Reveal delay={0.12}>
            <StepCard number={4} icon={FileCheck2} title="What happens after you report">
              <p>A report (<em>denuncia</em>) can be filed in writing, in person, by phone, or electronically. From there:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>The authority is required to investigate</li>
                <li>In abuse cases, a veterinarian produces an official medical report (<em>parte médico veterinario</em>)</li>
                <li>If the facts support it, the case can be referred as a criminal matter under Nayarit's animal-cruelty statutes</li>
              </ul>
            </StepCard>
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          <div style={{ borderTop: `1px solid ${COLORS.line}` }} className="mt-10 pt-6">
            <p style={{ color: `${COLORS.ink}77` }} className="text-xs leading-relaxed">
              This page is general information, advisory only, and has not been reviewed by a licensed attorney. It is not a substitute for legal advice.
            </p>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
