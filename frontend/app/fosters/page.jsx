"use client";
import { useState, useEffect, useCallback } from "react";
import { Home, Send, AlertCircle, Check, Clock } from "lucide-react";
import Nav from "../../components/Nav";
import Reveal from "../../components/Reveal";
import { useAppTheme } from "../../lib/theme-context";
import { supabase } from "../../lib/supabase-client";

// Active foster placements, with a manual "send check-in" action per
// placement. Periodic/automatic check-ins are a real future task — this
// app has no scheduling infrastructure today, and building that wasn't
// what this pass was about (see docs/foster-checkin-schema.md).

function PlacementCard({ p, onSend, onResolve }) {
  const { COLORS, FONTS } = useAppTheme();
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [resolving, setResolving] = useState(false);

  async function handleSend() {
    setSending(true);
    setResult(await onSend(p.id));
    setSending(false);
  }

  async function handleResolve() {
    setResolving(true);
    await onResolve(p.id);
    setResolving(false);
  }

  return (
    <div style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${p.needs_attention ? COLORS.coral : COLORS.line}` }} className="rounded-2xl px-5 py-4">
      <div className="flex items-center gap-4">
        <div style={{ backgroundColor: p.needs_attention ? `${COLORS.coral}18` : `${COLORS.teal}18` }} className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0">
          <Home size={16} color={p.needs_attention ? COLORS.coral : COLORS.teal} />
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ color: COLORS.ink }} className="text-sm font-medium">
            {p.animalName} <span style={{ color: `${COLORS.ink}66` }} className="font-normal">· foster: {p.fosterName}</span>
          </div>
          <div style={{ color: `${COLORS.ink}77` }} className="text-xs mt-0.5">
            {p.last_checkin_at
              ? <span className="flex items-center gap-1"><Clock size={11} /> last check-in {new Date(p.last_checkin_at).toLocaleDateString()}: "{p.last_checkin_note}"</span>
              : "no check-in yet"}
          </div>
          {p.needs_attention && (
            <div style={{ color: COLORS.coral }} className="text-xs flex items-center gap-1.5 mt-1 font-medium"><AlertCircle size={12} /> Needs attention</div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          {p.needs_attention && (
            <button onClick={handleResolve} disabled={resolving}
              style={{ backgroundColor: COLORS.green, color: "#FFFFFF" }} className="text-xs px-3 py-2 rounded-full font-medium flex items-center gap-1.5">
              <Check size={12} /> {resolving ? "…" : "Mark resolved"}
            </button>
          )}
          <button onClick={handleSend} disabled={sending}
            style={{ backgroundColor: COLORS.marigold, color: "#FFFFFF" }} className="text-xs px-3 py-2 rounded-full font-medium flex items-center gap-1.5">
            <Send size={12} /> {sending ? "Sending…" : "Send check-in"}
          </button>
        </div>
      </div>
      {result && (
        <div className="mt-2 text-xs flex items-center gap-1.5" style={{ color: result.sent ? COLORS.green : COLORS.coral }}>
          {result.sent ? <Check size={12} /> : <AlertCircle size={12} />} {result.sent ? "sent" : (result.error || result.reason)}
        </div>
      )}
    </div>
  );
}

export default function FostersPage() {
  const { COLORS, FONTS } = useAppTheme();
  const [placements, setPlacements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!supabase) { setError("Supabase isn't configured."); setLoading(false); return; }
    const { data, error: err } = await supabase
      .from("foster_placements")
      .select("id, animal_id, foster_person_id, needs_attention, last_checkin_at, last_checkin_note")
      .eq("status", "active");
    if (err) { setError(err.message); setLoading(false); return; }

    const enriched = await Promise.all((data ?? []).map(async (p) => {
      const [{ data: animal }, { data: foster }] = await Promise.all([
        supabase.from("animals").select("name").eq("id", p.animal_id).maybeSingle(),
        supabase.from("people").select("full_name").eq("id", p.foster_person_id).maybeSingle(),
      ]);
      return { ...p, animalName: animal?.name ?? "animal", fosterName: foster?.full_name ?? "foster" };
    }));
    setPlacements(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function sendCheckin(placementId) {
    const res = await fetch("/api/fosters/send-checkin", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ placementId }),
    });
    return res.json();
  }

  async function resolveAttention(placementId) {
    await supabase.from("foster_placements").update({ needs_attention: false }).eq("id", placementId);
    load();
  }

  return (
    <div style={{ backgroundColor: COLORS.paper, minHeight: "100vh", fontFamily: FONTS.body }}>
      <Nav crumb="Fosters" />
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 style={{ fontFamily: FONTS.display, color: COLORS.ink }} className="text-3xl mb-2">Foster check-ins</h1>
        <p style={{ color: `${COLORS.ink}99` }} className="text-sm mb-8">Active placements — send a check-in ping any time.</p>

        {error && (
          <div style={{ backgroundColor: `${COLORS.coral}12`, border: `1px solid ${COLORS.coral}44`, color: COLORS.ink }} className="rounded-xl px-4 py-3 mb-6 text-sm">{error}</div>
        )}

        {loading ? (
          <p style={{ color: `${COLORS.ink}77` }} className="text-sm">Loading…</p>
        ) : placements.length === 0 ? (
          <p style={{ color: `${COLORS.ink}77` }} className="text-sm">No active foster placements.</p>
        ) : (
          <div className="space-y-3">
            {placements.map((p, i) => <Reveal key={p.id} delay={Math.min(i, 5) * 0.03}><PlacementCard p={p} onSend={sendCheckin} onResolve={resolveAttention} /></Reveal>)}
          </div>
        )}
      </div>
    </div>
  );
}
