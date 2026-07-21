import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PawPrint, ChevronRight, Stethoscope, Clock, Check,
  Send, Users, ChevronDown,
} from "lucide-react";

const COLORS = {
  night: "#10262E",
  nightDeep: "#0A1B21",
  teal: "#1F5C6B",
  coral: "#E8577A",
  marigold: "#E8B95C",
  paper: "#F3EDE0",
  ink: "#1C2B2E",
  line: "#E4DCC9",
  green: "#7A9E7E",
};

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
`;

const initialCases = [
  {
    id: "c1",
    animal: "Luna",
    title: "Perro encontrado con golpes visibles",
    flaggedAt: "2 hours ago",
    caregivers: ["Ana Ruiz (foster)", "Dra. Ruiz (vet)"],
    acknowledged: false,
    carePlan: "",
    sent: false,
  },
  {
    id: "c2",
    animal: "Sunny",
    title: "Iguana con posible fractura de pata",
    flaggedAt: "1 day ago",
    caregivers: ["Carlos (staff)"],
    acknowledged: true,
    carePlan: "",
    sent: false,
  },
];

function CaseCard({ c, onAcknowledge, onUpdatePlan, onSend }) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(c.carePlan);

  return (
    <div
      style={{
        backgroundColor: "#FFFFFF",
        border: `1.5px solid ${c.sent ? COLORS.green : COLORS.line}`,
      }}
      className="rounded-2xl overflow-hidden"
    >
      <button onClick={() => setExpanded(!expanded)} className="w-full px-5 py-4 flex items-center gap-4 text-left">
        <div
          style={{ backgroundColor: c.acknowledged ? `${COLORS.green}18` : `${COLORS.coral}18` }}
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
        >
          <Stethoscope size={16} color={c.acknowledged ? COLORS.green : COLORS.coral} />
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ color: COLORS.ink }} className="text-sm font-medium">
            {c.animal} <span style={{ color: `${COLORS.ink}66` }} className="font-normal">· {c.title}</span>
          </div>
          <div style={{ color: `${COLORS.ink}77` }} className="text-xs flex items-center gap-1.5 mt-0.5">
            <Clock size={11} />
            flagged {c.flaggedAt}
            {c.sent && (
              <span style={{ color: COLORS.green }} className="flex items-center gap-1 ml-2">
                <Check size={11} /> care plan sent
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          size={16}
          color={`${COLORS.ink}66`}
          style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ borderTop: `1.5px solid ${COLORS.line}` }}
          >
            <div className="px-5 py-5">
              {!c.acknowledged ? (
                <button
                  onClick={() => onAcknowledge(c.id)}
                  style={{ backgroundColor: COLORS.coral, color: "#FFFFFF" }}
                  className="text-sm px-4 py-2.5 rounded-full font-medium mb-4"
                >
                  Acknowledge — I'll take this case
                </button>
              ) : (
                <>
                  <div
                    style={{ color: COLORS.ink, fontFamily: "'IBM Plex Mono', monospace" }}
                    className="text-xs uppercase tracking-wide mb-3 flex items-center gap-1.5"
                  >
                    <Users size={12} /> Will notify
                  </div>
                  <div className="flex flex-wrap gap-2 mb-5">
                    {c.caregivers.map((name) => (
                      <span
                        key={name}
                        style={{ backgroundColor: `${COLORS.teal}15`, color: COLORS.teal }}
                        className="text-xs px-3 py-1.5 rounded-full"
                      >
                        {name}
                      </span>
                    ))}
                  </div>

                  <div
                    style={{ color: COLORS.ink, fontFamily: "'IBM Plex Mono', monospace" }}
                    className="text-xs uppercase tracking-wide mb-2"
                  >
                    Care plan
                  </div>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    disabled={c.sent}
                    placeholder="Medicación, dosis, horarios, señales de alerta a vigilar..."
                    style={{
                      border: `1.5px solid ${COLORS.line}`,
                      color: COLORS.ink,
                      backgroundColor: c.sent ? `${COLORS.line}22` : "#FFFFFF",
                    }}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none min-h-24 resize-none mb-3"
                  />
                  {!c.sent ? (
                    <button
                      onClick={() => onSend(c.id, draft)}
                      disabled={!draft.trim()}
                      style={{
                        backgroundColor: draft.trim() ? COLORS.teal : COLORS.line,
                        color: "#FFFFFF",
                      }}
                      className="text-sm px-4 py-2.5 rounded-full font-medium flex items-center gap-2"
                    >
                      <Send size={13} /> Send to caregivers
                    </button>
                  ) : (
                    <div style={{ color: COLORS.green }} className="text-xs flex items-center gap-1.5">
                      <Check size={13} /> Sent via WhatsApp to {c.caregivers.length} people
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function VetCare() {
  const [cases, setCases] = useState(initialCases);

  function acknowledge(id) {
    setCases((cs) => cs.map((c) => (c.id === id ? { ...c, acknowledged: true } : c)));
  }
  function send(id, plan) {
    setCases((cs) => cs.map((c) => (c.id === id ? { ...c, carePlan: plan, sent: true } : c)));
  }

  const pending = cases.filter((c) => !c.sent).length;

  return (
    <div style={{ backgroundColor: COLORS.paper, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <style>{FONT_IMPORT}</style>

      <div style={{ backgroundColor: COLORS.night }} className="px-6 md:px-12 py-5 flex items-center gap-3">
        <PawPrint size={18} color={COLORS.marigold} />
        <span style={{ fontFamily: "'Fraunces', serif", color: COLORS.paper }} className="text-lg">Guarida</span>
        <ChevronRight size={14} color={`${COLORS.paper}66`} />
        <span style={{ color: `${COLORS.paper}99`, fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs uppercase tracking-wide">
          Vet care · Wet Noses
        </span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-baseline justify-between mb-2">
          <h1 style={{ fontFamily: "'Fraunces', serif", color: COLORS.ink }} className="text-3xl">
            Vet care
          </h1>
          {pending > 0 && (
            <span style={{ color: COLORS.coral, fontFamily: "'IBM Plex Mono', monospace" }} className="text-xs">
              {pending} awaiting a plan
            </span>
          )}
        </div>
        <p style={{ color: `${COLORS.ink}99` }} className="text-sm mb-8">
          Cases flagged during intake land here the moment they're submitted.
        </p>

        <div className="space-y-3">
          {cases.map((c) => (
            <CaseCard key={c.id} c={c} onAcknowledge={acknowledge} onSend={send} />
          ))}
        </div>
      </div>
    </div>
  );
}
