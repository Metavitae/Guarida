"use client";
import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PawPrint, Camera, MapPin, AlertTriangle, Check, X,
  Plus, Stethoscope, ScrollText,
} from "lucide-react";
import Nav from "../../components/Nav";
import Reveal from "../../components/Reveal";
import { COLORS, FONTS, inputStyle } from "../../lib/design-tokens";
import { supabase, suggestLegalMatches as suggestLegalMatchesReal } from "../../lib/supabase-client";

// Fallback sample, used ONLY when Supabase isn't configured yet — clearly
// labeled in the UI so nobody mistakes sample data for real matches.
const SAMPLE_LEGAL_REFS = [
  { id: "1", statute_code: "CPN Art. 422", title: "Maltrato o crueldad animal (Nayarit)",
    keywords: ["golpes", "golpe", "abandono", "agua", "alimento", "herida", "heridas", "crueldad", "maltrato",
      "tied up", "tied", "chained", "without food", "without water", "no food", "no water",
      "starving", "starved", "dehydrated", "abandoned", "neglect", "cruelty", "abuse"] },
  { id: "2", statute_code: "CPN Art. 423", title: "Agravantes — grabación o publicación del maltrato",
    keywords: ["video", "grabó", "grabaron", "publicó", "fotos", "foto",
      "recorded", "filmed", "published", "posted online"] },
  { id: "3", statute_code: "LGVS Art. 29-30", title: "Trato digno a fauna silvestre",
    keywords: ["silvestre", "salvaje", "iguana", "tortuga", "ave", "venado", "coyote",
      "wildlife", "wild animal", "iguana", "turtle", "coyote"] },
];

function sampleMatch(description) {
  const words = description.toLowerCase();
  return SAMPLE_LEGAL_REFS
    .map((ref) => ({ ...ref, score: ref.keywords.filter((k) => words.includes(k)).length }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

function Field({ label, children }) {
  return (
    <div className="mb-6">
      <label style={{ color: COLORS.ink, fontFamily: FONTS.mono }} className="block text-xs tracking-wide uppercase mb-2 opacity-70">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function CaseIntakePage() {
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [species, setSpecies] = useState("dog");
  const [location, setLocation] = useState("");
  const [requiresVet, setRequiresVet] = useState(false);
  const [witnesses, setWitnesses] = useState([{ name: "", contact: "" }]);
  const [confirmed, setConfirmed] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [matches, setMatches] = useState([]);
  const [usingSampleData, setUsingSampleData] = useState(!supabase);

  // Debounced-ish match lookup — real query if Supabase is configured,
  // otherwise the labeled sample so the screen is still demoable.
  useEffect(() => {
    if (!description.trim()) { setMatches([]); return; }
    let cancelled = false;

    if (supabase) {
      suggestLegalMatchesReal(description, "MX-Nayarit")
        .then((results) => { if (!cancelled) { setMatches(results); setUsingSampleData(false); } })
        .catch(() => { if (!cancelled) { setMatches(sampleMatch(description)); setUsingSampleData(true); } });
    } else {
      setMatches(sampleMatch(description));
      setUsingSampleData(true);
    }
    return () => { cancelled = true; };
  }, [description]);

  function addWitness() { setWitnesses([...witnesses, { name: "", contact: "" }]); }
  function updateWitness(i, field, value) {
    const next = [...witnesses]; next[i][field] = value; setWitnesses(next);
  }
  function toggleConfirm(id) {
    setConfirmed((c) => ({ ...c, [id]: c[id] === "confirmed" ? undefined : "confirmed" }));
  }
  function toggleDismiss(id) {
    setConfirmed((c) => ({ ...c, [id]: c[id] === "dismissed" ? undefined : "dismissed" }));
  }

  async function handleSubmit() {
    if (supabase) {
      // Real path: insert into `cases`, then `case_media`, then
      // `case_legal_matches` for anything the user confirmed above —
      // mirrors createCase() from case-intake.js exactly, just called
      // from the client instead of a server script.
      const { data: caseRow, error } = await supabase
        .from("cases")
        .insert({ title, description, species, location, jurisdiction: "MX-Nayarit", status: "open", needs_vet_care: requiresVet })
        .select()
        .single();
      if (error) { console.error(error); return; }

      const confirmedMatches = matches.filter((m) => confirmed[m.id] === "confirmed");
      if (confirmedMatches.length) {
        await supabase.from("case_legal_matches").insert(
          confirmedMatches.map((m) => ({ case_id: caseRow.id, legal_reference_id: m.id, suggested_by: "ai" }))
        );
      }
    }
    setSubmitted(true);
  }

  return (
    <div style={{ backgroundColor: COLORS.paper, minHeight: "100vh", fontFamily: FONTS.body }}>
      <Nav crumb="New case" />

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 style={{ fontFamily: FONTS.display, color: COLORS.ink }} className="text-3xl mb-2">Report a case</h1>
        <p style={{ color: `${COLORS.ink}99` }} className="text-sm mb-10">
          Everything here becomes part of the case's permanent record.
        </p>

        <Reveal>
          <Field label="Short title">
            <input style={inputStyle} className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              placeholder="e.g. Perro con golpes visibles, Punta de Mita"
              value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
        </Reveal>

        <Reveal delay={0.03}>
          <Field label="Species">
            <div className="flex gap-2">
              {["dog", "cat", "wildlife", "other"].map((s) => (
                <button key={s} onClick={() => setSpecies(s)}
                  style={{
                    backgroundColor: species === s ? COLORS.coral : "#FFFFFF",
                    color: species === s ? "#FFFFFF" : COLORS.ink,
                    border: `1.5px solid ${species === s ? COLORS.coral : COLORS.line}`,
                  }}
                  className="px-4 py-2 rounded-full text-sm capitalize transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </Field>
        </Reveal>

        <Reveal delay={0.06}>
          <Field label="Description">
            <textarea style={inputStyle} className="w-full rounded-xl px-4 py-3 text-sm outline-none min-h-32 resize-none"
              placeholder="Describe lo que se reportó — entre más detalle, mejor puede el sistema sugerir la ley aplicable."
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </Reveal>

        <Reveal delay={0.09}>
          <Field label="Location">
            <div style={inputStyle} className="w-full rounded-xl px-4 py-3 text-sm flex items-center gap-2">
              <MapPin size={16} color={COLORS.teal} />
              <input className="flex-1 outline-none bg-transparent" placeholder="Colonia, calle, punto de referencia"
                value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </Field>
        </Reveal>

        <Reveal delay={0.12}>
          <Field label="Evidence">
            <button style={{ border: `1.5px dashed ${COLORS.line}`, color: `${COLORS.ink}88` }}
              className="w-full rounded-xl px-4 py-6 text-sm flex flex-col items-center gap-2">
              <Camera size={20} color={COLORS.teal} /> Add photo or video
            </button>
          </Field>
        </Reveal>

        <Reveal delay={0.15}>
          <Field label="Witnesses">
            <div className="space-y-3">
              {witnesses.map((w, i) => (
                <div key={i} className="flex gap-2">
                  <input style={inputStyle} className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                    placeholder="Nombre (opcional)" value={w.name} onChange={(e) => updateWitness(i, "name", e.target.value)} />
                  <input style={inputStyle} className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                    placeholder="Teléfono o WhatsApp" value={w.contact} onChange={(e) => updateWitness(i, "contact", e.target.value)} />
                </div>
              ))}
              <button onClick={addWitness} style={{ color: COLORS.teal }} className="text-xs flex items-center gap-1 font-medium">
                <Plus size={14} /> Add another witness
              </button>
            </div>
          </Field>
        </Reveal>

        <Reveal delay={0.18}>
          <button onClick={() => setRequiresVet(!requiresVet)}
            style={{ backgroundColor: requiresVet ? `${COLORS.coral}18` : "#FFFFFF", border: `1.5px solid ${requiresVet ? COLORS.coral : COLORS.line}` }}
            className="w-full rounded-xl px-4 py-3 mb-8 flex items-center gap-3 text-left">
            <Stethoscope size={18} color={requiresVet ? COLORS.coral : `${COLORS.ink}66`} />
            <span style={{ color: COLORS.ink }} className="text-sm flex-1">This case needs veterinary attention</span>
            <div style={{ backgroundColor: requiresVet ? COLORS.coral : COLORS.line }} className="h-5 w-9 rounded-full relative transition-colors">
              <motion.div animate={{ x: requiresVet ? 16 : 2 }} className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow" />
            </div>
          </button>
        </Reveal>

        <AnimatePresence>
          {matches.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              style={{ backgroundColor: COLORS.nightDeep }} className="rounded-2xl p-6 mb-8 overflow-hidden">
              <div className="flex items-center gap-2 mb-1">
                <ScrollText size={16} color={COLORS.marigold} />
                <span style={{ color: COLORS.paper, fontFamily: FONTS.mono }} className="text-xs uppercase tracking-wide">
                  Suggested legal matches {usingSampleData && "(sample data — Supabase not connected)"}
                </span>
              </div>
              <p style={{ color: `${COLORS.paper}80` }} className="text-xs mb-4">
                Draft suggestions only — not yet reviewed by an attorney. Confirm only what you believe applies.
              </p>
              <div className="space-y-2">
                {matches.map((m) => (
                  <div key={m.id}
                    style={{ backgroundColor: confirmed[m.id] === "dismissed" ? "transparent" : `${COLORS.paper}0d`, opacity: confirmed[m.id] === "dismissed" ? 0.4 : 1 }}
                    className="rounded-xl px-4 py-3 flex items-center gap-3">
                    <div className="flex-1">
                      <div style={{ color: COLORS.paper, fontFamily: FONTS.mono }} className="text-xs mb-0.5">{m.statute_code}</div>
                      <div style={{ color: `${COLORS.paper}b3` }} className="text-sm">{m.title}</div>
                    </div>
                    <button onClick={() => toggleConfirm(m.id)}
                      style={{ backgroundColor: confirmed[m.id] === "confirmed" ? COLORS.marigold : "transparent", border: `1.5px solid ${COLORS.marigold}`, color: confirmed[m.id] === "confirmed" ? COLORS.nightDeep : COLORS.marigold }}
                      className="h-8 w-8 rounded-full flex items-center justify-center shrink-0">
                      <Check size={14} />
                    </button>
                    <button onClick={() => toggleDismiss(m.id)}
                      style={{ backgroundColor: "transparent", border: `1.5px solid ${COLORS.paper}33`, color: `${COLORS.paper}88` }}
                      className="h-8 w-8 rounded-full flex items-center justify-center shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {requiresVet && (
          <div style={{ backgroundColor: `${COLORS.coral}12`, border: `1px solid ${COLORS.coral}44` }} className="rounded-xl px-4 py-3 mb-8 flex items-center gap-2">
            <AlertTriangle size={16} color={COLORS.coral} />
            <span style={{ color: COLORS.ink }} className="text-xs">Active vets on this case will be notified the moment this is submitted.</span>
          </div>
        )}

        <button onClick={handleSubmit} style={{ backgroundColor: COLORS.coral, color: "#FFFFFF" }} className="w-full rounded-full py-4 font-medium text-sm">
          {submitted ? "Case submitted" : "Submit case"}
        </button>
      </div>
    </div>
  );
}
