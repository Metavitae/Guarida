"use client";
import { useState, useEffect, useCallback } from "react";
import { Stethoscope, Clock, Check, Send, Users, ChevronDown, AlertCircle } from "lucide-react";
import Nav from "../../components/Nav";
import Reveal from "../../components/Reveal";
import { COLORS, FONTS, inputStyle } from "../../lib/design-tokens";
import { supabase } from "../../lib/supabase-client";

// Cases land here the moment case-intake flags needs_vet_care = true.
// A vet acknowledges (claims it, creating the vet_notifications row),
// writes a care plan, then sends a real WhatsApp notice — via a
// pre-approved template, not free text, since this is a business-
// initiated message and may land outside any open messaging window.

function CaseCard({ c, onAcknowledge, onSavePlan, onSend }) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(c.notification?.care_plan_text ?? "");
  const [saving, setSaving] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [sending, setSending] = useState(false);

  const acknowledged = !!c.notification;

  async function handleSave() {
    setSaving(true);
    await onSavePlan(c.notification.id, draft);
    setSaving(false);
  }

  async function handleSend() {
    setSending(true);
    const result = await onSend(c.id);
    setSendResult(result);
    setSending(false);
  }

  return (
    <div style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${sendResult?.results?.some((r) => r.sent) ? COLORS.green : COLORS.line}` }} className="rounded-2xl overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full px-5 py-4 flex items-center gap-4 text-left">
        <div style={{ backgroundColor: acknowledged ? `${COLORS.green}18` : `${COLORS.coral}18` }} className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0">
          <Stethoscope size={16} color={acknowledged ? COLORS.green : COLORS.coral} />
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ color: COLORS.ink }} className="text-sm font-medium">
            {c.animalName} <span style={{ color: `${COLORS.ink}66` }} className="font-normal">· {c.title}</span>
          </div>
          <div style={{ color: `${COLORS.ink}77` }} className="text-xs flex items-center gap-1.5 mt-0.5">
            <Clock size={11} /> flagged {new Date(c.created_at).toLocaleDateString()}
          </div>
        </div>
        <ChevronDown size={16} color={`${COLORS.ink}66`} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      {expanded && (
        <div style={{ borderTop: `1.5px solid ${COLORS.line}` }} className="px-5 py-5">
          {!acknowledged ? (
            <button onClick={() => onAcknowledge(c.id)} style={{ backgroundColor: COLORS.coral, color: "#FFFFFF" }} className="text-sm px-4 py-2.5 rounded-full font-medium">
              Acknowledge — I'll take this case
            </button>
          ) : (
            <>
              <div style={{ color: COLORS.ink, fontFamily: FONTS.mono }} className="text-xs uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Users size={12} /> Recipients resolved from real assignment data (foster + vet), not hardcoded
              </div>
              <div style={{ color: COLORS.ink, fontFamily: FONTS.mono }} className="text-xs uppercase tracking-wide mb-2 mt-4">Care plan</div>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                placeholder="Medicación, dosis, horarios, señales de alerta a vigilar..."
                style={inputStyle} className="w-full rounded-xl px-4 py-3 text-sm outline-none min-h-24 resize-none mb-3" />
              <div className="flex items-center gap-3">
                <button onClick={handleSave} disabled={saving || !draft.trim()}
                  style={{ backgroundColor: COLORS.teal, color: "#FFFFFF" }} className="text-sm px-4 py-2.5 rounded-full font-medium">
                  {saving ? "Saving…" : "Save care plan"}
                </button>
                <button onClick={handleSend} disabled={sending || !c.notification?.care_plan_text}
                  style={{ backgroundColor: c.notification?.care_plan_text ? COLORS.marigold : COLORS.line, color: "#FFFFFF" }}
                  className="text-sm px-4 py-2.5 rounded-full font-medium flex items-center gap-2">
                  <Send size={13} /> {sending ? "Sending…" : "Send notice (WhatsApp template)"}
                </button>
              </div>
              {sendResult && (
                <div className="mt-3 space-y-1">
                  {sendResult.error && (
                    <div style={{ color: COLORS.coral }} className="text-xs flex items-center gap-1.5"><AlertCircle size={12} /> {sendResult.error}</div>
                  )}
                  {sendResult.results?.map((r, i) => (
                    <div key={i} style={{ color: r.sent ? COLORS.green : COLORS.coral }} className="text-xs flex items-center gap-1.5">
                      {r.sent ? <Check size={12} /> : <AlertCircle size={12} />} {r.person}: {r.sent ? "sent" : r.reason}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function VetCarePage() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!supabase) { setError("Supabase isn't configured."); setLoading(false); return; }

    const { data: caseRows, error: caseErr } = await supabase
      .from("cases").select("id, title, species, location, animal_id, created_at")
      .eq("needs_vet_care", true).order("created_at", { ascending: false });
    if (caseErr) { setError(caseErr.message); setLoading(false); return; }

    const enriched = await Promise.all((caseRows ?? []).map(async (c) => {
      const { data: notification } = await supabase.from("vet_notifications")
        .select("id, care_plan_text, notified_at").eq("case_id", c.id).order("notified_at", { ascending: false }).limit(1).maybeSingle();
      let animalName = c.species || "animal";
      if (c.animal_id) {
        const { data: animal } = await supabase.from("animals").select("name").eq("id", c.animal_id).maybeSingle();
        if (animal?.name) animalName = animal.name;
      }
      return { ...c, notification, animalName };
    }));

    setCases(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function acknowledge(caseId) {
    setError("");
    const { data: personId, error: personErr } = await supabase.rpc("my_person_id");
    if (personErr) { setError(personErr.message); return; }
    const { error: err } = await supabase.from("vet_notifications").insert({ case_id: caseId, vet_person_id: personId });
    if (err) { setError(err.message); return; }
    load();
  }

  async function savePlan(notificationId, text) {
    setError("");
    const { error: err } = await supabase.from("vet_notifications").update({ care_plan_text: text }).eq("id", notificationId);
    if (err) { setError(err.message); return; }
    load();
  }

  async function sendNotice(caseId) {
    const res = await fetch("/api/vet-care/send-notice", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId }),
    });
    return res.json();
  }

  const pending = cases.filter((c) => !c.notification?.care_plan_text).length;

  return (
    <div style={{ backgroundColor: COLORS.paper, minHeight: "100vh", fontFamily: FONTS.body }}>
      <Nav crumb="Vet care" />
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-baseline justify-between mb-2">
          <h1 style={{ fontFamily: FONTS.display, color: COLORS.ink }} className="text-3xl">Vet care</h1>
          {pending > 0 && <span style={{ color: COLORS.coral, fontFamily: FONTS.mono }} className="text-xs">{pending} awaiting a plan</span>}
        </div>
        <p style={{ color: `${COLORS.ink}99` }} className="text-sm mb-8">Cases flagged during intake land here the moment they're submitted.</p>

        {error && (
          <div style={{ backgroundColor: `${COLORS.coral}12`, border: `1px solid ${COLORS.coral}44`, color: COLORS.ink }} className="rounded-xl px-4 py-3 mb-6 text-sm">{error}</div>
        )}

        {loading ? (
          <p style={{ color: `${COLORS.ink}77` }} className="text-sm">Loading…</p>
        ) : cases.length === 0 ? (
          <p style={{ color: `${COLORS.ink}77` }} className="text-sm">No cases currently flagged for vet care.</p>
        ) : (
          <div className="space-y-3">
            {cases.map((c, i) => (
              <Reveal key={c.id} delay={Math.min(i, 5) * 0.03}>
                <CaseCard c={c} onAcknowledge={acknowledge} onSavePlan={savePlan} onSend={sendNotice} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
