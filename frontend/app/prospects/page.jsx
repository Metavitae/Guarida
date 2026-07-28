"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { UserPlus, Circle, ChevronDown, Check, ArrowRight, Plus } from "lucide-react";
import Nav from "../../components/Nav";
import Reveal from "../../components/Reveal";
import { useAppTheme } from "../../lib/theme-context";
import { supabase } from "../../lib/supabase-client";

const STAGES = ["identified", "contacted", "engaged", "converted", "declined"];
// Was a module-level constant computed once from a static COLORS import;
// now takes COLORS as a param since it comes from useAppTheme() instead.
function getStageColor(COLORS) {
  return {
    identified: `${COLORS.ink}55`, contacted: COLORS.marigold, engaged: COLORS.teal,
    converted: COLORS.green, declined: COLORS.coral,
  };
}

function ProspectCard({ p, onSave, onConvert }) {
  const { COLORS, FONTS, inputStyle } = useAppTheme();
  const stageColor = getStageColor(COLORS);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(p);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);

  useEffect(() => setDraft(p), [p]);

  async function handleSave() {
    setSaving(true);
    await onSave(p.id, {
      name: draft.name, email: draft.email, whatsapp_number: draft.whatsapp_number,
      source: draft.source, stage: draft.stage, next_follow_up_date: draft.next_follow_up_date || null, notes: draft.notes,
    });
    setSaving(false);
  }

  async function handleConvert() {
    setConverting(true);
    await onConvert(p);
    setConverting(false);
  }

  return (
    <div style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${COLORS.line}` }} className="rounded-xl overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full px-5 py-4 flex items-center gap-4 text-left">
        <div style={{ backgroundColor: `${stageColor[p.stage]}18` }} className="h-9 w-9 rounded-full flex items-center justify-center shrink-0">
          <UserPlus size={14} color={stageColor[p.stage]} />
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ color: COLORS.ink }} className="text-sm font-medium">{p.name}</div>
          <div style={{ color: `${COLORS.ink}77` }} className="text-xs flex items-center gap-1.5">
            <Circle size={6} fill={stageColor[p.stage]} color={stageColor[p.stage]} />
            <span className="capitalize">{p.stage}</span>
            {p.next_follow_up_date && <span>· follow up {new Date(p.next_follow_up_date + "T00:00:00").toLocaleDateString()}</span>}
          </div>
        </div>
        <ChevronDown size={16} color={`${COLORS.ink}66`} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      {expanded && (
        <div style={{ borderTop: `1.5px solid ${COLORS.line}` }} className="px-5 py-5 space-y-3">
          <input value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name" style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none" />
          <div className="grid grid-cols-2 gap-3">
            <input value={draft.email || ""} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="Email" style={inputStyle} className="rounded-xl px-3 py-2 text-sm outline-none" />
            <input value={draft.whatsapp_number || ""} onChange={(e) => setDraft({ ...draft, whatsapp_number: e.target.value })} placeholder="WhatsApp / phone" style={inputStyle} className="rounded-xl px-3 py-2 text-sm outline-none" />
          </div>
          <input value={draft.source || ""} onChange={(e) => setDraft({ ...draft, source: e.target.value })} placeholder="Source (how this lead was found)" style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none" />
          <div className="grid grid-cols-2 gap-3">
            <select value={draft.stage || "identified"} onChange={(e) => setDraft({ ...draft, stage: e.target.value })}
              disabled={p.stage === "converted"} style={inputStyle} className="rounded-xl px-3 py-2 text-sm outline-none">
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="date" value={draft.next_follow_up_date || ""} onChange={(e) => setDraft({ ...draft, next_follow_up_date: e.target.value })}
              style={inputStyle} className="rounded-xl px-3 py-2 text-sm outline-none" />
          </div>
          <textarea value={draft.notes || ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Notes" style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none min-h-20 resize-none" />

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={handleSave} disabled={saving} style={{ backgroundColor: COLORS.teal, color: "#FFFFFF" }} className="rounded-full px-4 py-2 text-sm font-medium flex items-center gap-1.5">
              <Check size={13} /> {saving ? "Saving…" : "Save"}
            </button>
            {p.stage !== "converted" ? (
              <button onClick={handleConvert} disabled={converting} style={{ backgroundColor: COLORS.green, color: "#FFFFFF" }} className="rounded-full px-4 py-2 text-sm font-medium flex items-center gap-1.5">
                <ArrowRight size={13} /> {converting ? "Converting…" : "Convert to donor"}
              </button>
            ) : (
              <span style={{ color: COLORS.green }} className="text-xs flex items-center gap-1.5"><Check size={12} /> Converted to donor</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NewProspectForm({ onAdd, onCancel }) {
  const { COLORS, inputStyle } = useAppTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [source, setSource] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setAdding(true);
    await onAdd({ name: name.trim(), email, whatsapp_number: whatsapp, source });
    setAdding(false);
  }

  return (
    <div style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${COLORS.teal}` }} className="rounded-xl px-5 py-4 space-y-3 mb-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none" autoFocus />
      <div className="grid grid-cols-2 gap-3">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={inputStyle} className="rounded-xl px-3 py-2 text-sm outline-none" />
        <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp / phone" style={inputStyle} className="rounded-xl px-3 py-2 text-sm outline-none" />
      </div>
      <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source" style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none" />
      <div className="flex items-center gap-2">
        <button onClick={handleAdd} disabled={adding || !name.trim()} style={{ backgroundColor: COLORS.coral, color: "#FFFFFF" }} className="rounded-full px-4 py-2 text-sm font-medium">
          {adding ? "Adding…" : "Add prospect"}
        </button>
        <button onClick={onCancel} style={{ color: `${COLORS.ink}77` }} className="text-sm px-3 py-2">Cancel</button>
      </div>
    </div>
  );
}

export default function ProspectsPage() {
  const { COLORS, FONTS, inputStyle } = useAppTheme();
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [orgId, setOrgId] = useState(null);
  const [stageFilter, setStageFilter] = useState("all");
  const [sortBy, setSortBy] = useState("next_follow_up_date");

  const load = useCallback(async () => {
    if (!supabase) { setError("Supabase isn't configured."); setLoading(false); return; }
    const { data: memberships } = await supabase.from("memberships").select("org_id").eq("status", "active").limit(1);
    setOrgId(memberships?.[0]?.org_id ?? null);

    const { data, error: err } = await supabase.from("prospects").select("*");
    if (err) { setError(err.message); setLoading(false); return; }
    setProspects(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(fields) {
    setError("");
    const { error: err } = await supabase.from("prospects").insert({ ...fields, org_id: orgId });
    if (err) { setError(err.message); return; }
    setAdding(false);
    load();
  }

  async function handleSave(id, fields) {
    setError("");
    const { error: err } = await supabase.from("prospects").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id);
    if (err) { setError(err.message); return; }
    load();
  }

  async function handleConvert(prospect) {
    setError("");
    const contactParts = [prospect.email, prospect.whatsapp_number].filter(Boolean);
    const { data: donor, error: donorErr } = await supabase.from("donors").insert({
      org_id: orgId, name: prospect.name, contact: contactParts.join(" / ") || null,
      donor_type: "donor", stage: "active", notes: prospect.notes,
    }).select().single();
    if (donorErr) { setError(donorErr.message); return; }

    const { error: updErr } = await supabase.from("prospects")
      .update({ stage: "converted", converted_donor_id: donor.id, updated_at: new Date().toISOString() })
      .eq("id", prospect.id);
    if (updErr) { setError(updErr.message); return; }
    load();
  }

  const visible = useMemo(() => {
    let list = stageFilter === "all" ? prospects : prospects.filter((p) => p.stage === stageFilter);
    list = [...list].sort((a, b) => {
      if (sortBy === "next_follow_up_date") {
        if (!a.next_follow_up_date) return 1;
        if (!b.next_follow_up_date) return -1;
        return a.next_follow_up_date.localeCompare(b.next_follow_up_date);
      }
      return (a.name || "").localeCompare(b.name || "");
    });
    return list;
  }, [prospects, stageFilter, sortBy]);

  return (
    <div style={{ backgroundColor: COLORS.paper, minHeight: "100vh", fontFamily: FONTS.body }}>
      <Nav crumb="Prospects" />
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 style={{ fontFamily: FONTS.display, color: COLORS.ink }} className="text-3xl mb-2">Prospecting pipeline</h1>
        <p style={{ color: `${COLORS.ink}99` }} className="text-sm mb-8">Leads not yet confirmed donors — convert once they are.</p>

        {error && (
          <div style={{ backgroundColor: `${COLORS.coral}12`, border: `1px solid ${COLORS.coral}44`, color: COLORS.ink }} className="rounded-xl px-4 py-3 mb-6 text-sm">{error}</div>
        )}

        <div className="flex items-center gap-3 mb-6">
          <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} style={inputStyle} className="rounded-xl px-3 py-2 text-sm outline-none">
            <option value="all">All stages</option>
            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={inputStyle} className="rounded-xl px-3 py-2 text-sm outline-none">
            <option value="next_follow_up_date">Sort: next follow-up</option>
            <option value="name">Sort: name</option>
          </select>
          <span style={{ color: `${COLORS.ink}77`, fontFamily: FONTS.mono }} className="text-xs ml-auto">{visible.length} shown</span>
        </div>

        {!adding ? (
          <button onClick={() => setAdding(true)} style={{ border: `1.5px dashed ${COLORS.line}`, color: `${COLORS.ink}88` }} className="w-full rounded-xl px-4 py-3 text-sm flex items-center justify-center gap-2 mb-2">
            <Plus size={14} /> Add prospect
          </button>
        ) : (
          <NewProspectForm onAdd={handleAdd} onCancel={() => setAdding(false)} />
        )}

        <div className="space-y-2 mt-2">
          {loading ? (
            <p style={{ color: `${COLORS.ink}77` }} className="text-sm">Loading…</p>
          ) : visible.length === 0 ? (
            <p style={{ color: `${COLORS.ink}77` }} className="text-sm">No prospects match this filter.</p>
          ) : (
            visible.map((p, i) => <Reveal key={p.id} delay={Math.min(i, 5) * 0.03}><ProspectCard p={p} onSave={handleSave} onConvert={handleConvert} /></Reveal>)
          )}
        </div>
      </div>
    </div>
  );
}
