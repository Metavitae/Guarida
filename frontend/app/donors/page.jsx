"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Heart, Home, PawPrint, Circle, Plus, ChevronDown, Check, Send, AlertCircle } from "lucide-react";
import Nav from "../../components/Nav";
import { COLORS, FONTS, FONT_IMPORT, inputStyle } from "../../lib/design-tokens";
import { supabase } from "../../lib/supabase-client";

// "fosters" tab is still demo-only, unrelated to this task (real foster
// data now lives at /fosters, built separately). "donors" tab below is
// real, wired to Supabase — admin/staff only, per middleware.js.
const fosters = [
  { animal: "Luna", species: "dog", foster: "Ana Ruiz", since: "Jun 14", status: "active" },
  { animal: "Pinto", species: "dog", foster: "The Hendersons", since: "May 28", status: "active" },
  { animal: "Café", species: "cat", foster: "Maria Lopez", since: "Jun 2", status: "active" },
  { animal: "Sunny", species: "wildlife", foster: "—", since: "—", status: "needs placement" },
];

const stageColor = { prospect: `${COLORS.ink}55`, contacted: COLORS.marigold, active: COLORS.green, lapsed: COLORS.coral };

function DonorCard({ donor, onSave }) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(donor);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  useEffect(() => setDraft(donor), [donor]);

  async function handleSave() {
    setSaving(true);
    await onSave(donor.id, { name: draft.name, contact: draft.contact, whatsapp_number: draft.whatsapp_number, donor_type: draft.donor_type, stage: draft.stage, notes: draft.notes });
    setSaving(false);
  }

  async function handleSendUpdate() {
    setSending(true);
    const res = await fetch("/api/donors/send-update", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ donorId: donor.id, summary }),
    });
    setSendResult(await res.json());
    setSending(false);
  }

  return (
    <div style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${COLORS.line}` }} className="rounded-xl overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full px-5 py-4 flex items-center gap-4 text-left">
        <div style={{ backgroundColor: `${stageColor[donor.stage]}18` }} className="h-9 w-9 rounded-full flex items-center justify-center shrink-0">
          <Heart size={14} color={stageColor[donor.stage]} />
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ color: COLORS.ink }} className="text-sm font-medium">{donor.name}</div>
          <div style={{ color: `${COLORS.ink}77` }} className="text-xs flex items-center gap-1.5">
            <Circle size={6} fill={stageColor[donor.stage]} color={stageColor[donor.stage]} />
            <span className="capitalize">{donor.stage}</span> · <span className="capitalize">{donor.donor_type}</span>
          </div>
        </div>
        <ChevronDown size={16} color={`${COLORS.ink}66`} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      {expanded && (
        <div style={{ borderTop: `1.5px solid ${COLORS.line}` }} className="px-5 py-5 space-y-3">
          <input value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name" style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none" />
          <input value={draft.contact || ""} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} placeholder="Contact (email / phone)" style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none" />
          <input value={draft.whatsapp_number || ""} onChange={(e) => setDraft({ ...draft, whatsapp_number: e.target.value })} placeholder="WhatsApp number (for donor updates)" style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none" />
          <div className="grid grid-cols-2 gap-3">
            <select value={draft.donor_type || "prospect"} onChange={(e) => setDraft({ ...draft, donor_type: e.target.value })} style={inputStyle} className="rounded-xl px-3 py-2 text-sm outline-none">
              {["prospect", "donor", "investor"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={draft.stage || "prospect"} onChange={(e) => setDraft({ ...draft, stage: e.target.value })} style={inputStyle} className="rounded-xl px-3 py-2 text-sm outline-none">
              {["prospect", "contacted", "active", "lapsed"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <textarea value={draft.notes || ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Notes" style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none min-h-20 resize-none" />
          <button onClick={handleSave} disabled={saving} style={{ backgroundColor: COLORS.teal, color: "#FFFFFF" }} className="rounded-full px-4 py-2 text-sm font-medium flex items-center gap-1.5">
            <Check size={13} /> {saving ? "Saving…" : "Save"}
          </button>

          <div style={{ borderTop: `1.5px solid ${COLORS.line}` }} className="pt-3 mt-1 space-y-2">
            <div style={{ color: COLORS.ink, fontFamily: FONTS.mono }} className="text-xs uppercase tracking-wide opacity-70">Send donor update</div>
            <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={'e.g. "your gift is helping fund Luna\'s vet care"'}
              style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none" />
            <button onClick={handleSendUpdate} disabled={sending || !donor.whatsapp_number} style={{ backgroundColor: donor.whatsapp_number ? COLORS.marigold : COLORS.line, color: "#FFFFFF" }} className="rounded-full px-4 py-2 text-sm font-medium flex items-center gap-1.5">
              <Send size={13} /> {sending ? "Sending…" : "Send update (WhatsApp template)"}
            </button>
            {!donor.whatsapp_number && <div style={{ color: `${COLORS.ink}66` }} className="text-xs">Add a WhatsApp number above to enable this.</div>}
            {sendResult && (
              <div style={{ color: sendResult.sent ? COLORS.green : COLORS.coral }} className="text-xs flex items-center gap-1.5">
                {sendResult.sent ? <Check size={12} /> : <AlertCircle size={12} />} {sendResult.sent ? "Sent" : (sendResult.error || sendResult.reason)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NewDonorForm({ onAdd, onCancel }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [donorType, setDonorType] = useState("prospect");
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setAdding(true);
    await onAdd({ name: name.trim(), contact, donor_type: donorType, stage: "prospect" });
    setAdding(false);
  }

  return (
    <div style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${COLORS.teal}` }} className="rounded-xl px-5 py-4 space-y-3 mb-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none" autoFocus />
      <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact (email / phone / WhatsApp)" style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none" />
      <select value={donorType} onChange={(e) => setDonorType(e.target.value)} style={inputStyle} className="rounded-xl px-3 py-2 text-sm outline-none">
        {["prospect", "donor", "investor"].map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <div className="flex items-center gap-2">
        <button onClick={handleAdd} disabled={adding || !name.trim()} style={{ backgroundColor: COLORS.coral, color: "#FFFFFF" }} className="rounded-full px-4 py-2 text-sm font-medium">
          {adding ? "Adding…" : "Add donor"}
        </button>
        <button onClick={onCancel} style={{ color: `${COLORS.ink}77` }} className="text-sm px-3 py-2">Cancel</button>
      </div>
    </div>
  );
}

export default function DonorsPage() {
  const [tab, setTab] = useState("donors");
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [orgId, setOrgId] = useState(null);

  const load = useCallback(async () => {
    if (!supabase) { setError("Supabase isn't configured."); setLoading(false); return; }
    const { data: memberships } = await supabase.from("memberships").select("org_id").eq("status", "active").limit(1);
    setOrgId(memberships?.[0]?.org_id ?? null);

    const { data, error: err } = await supabase.from("donors").select("*").order("name");
    if (err) { setError(err.message); setLoading(false); return; }
    setDonors(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(fields) {
    setError("");
    const { error: err } = await supabase.from("donors").insert({ ...fields, org_id: orgId });
    if (err) { setError(err.message); return; }
    setAdding(false);
    load();
  }

  async function handleSave(id, fields) {
    setError("");
    const { error: err } = await supabase.from("donors").update(fields).eq("id", id);
    if (err) { setError(err.message); return; }
    load();
  }

  const activeCount = donors.filter((d) => d.stage === "active").length;

  return (
    <div style={{ backgroundColor: COLORS.paper, minHeight: "100vh", fontFamily: FONTS.body }}>
      <style>{FONT_IMPORT}</style>
      <Nav crumb="Community" />

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-baseline justify-between mb-8">
          <h1 style={{ fontFamily: FONTS.display, color: COLORS.ink }} className="text-3xl">Community</h1>
          {tab === "donors" && (
            <span style={{ color: `${COLORS.ink}77`, fontFamily: FONTS.mono }} className="text-xs">{activeCount} active · {donors.length} total</span>
          )}
        </div>

        <div className="flex gap-1 mb-6" style={{ borderBottom: `1.5px solid ${COLORS.line}` }}>
          {["donors", "fosters"].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ color: tab === t ? COLORS.coral : `${COLORS.ink}77`, borderBottom: tab === t ? `2px solid ${COLORS.coral}` : "2px solid transparent" }}
              className="px-4 py-3 text-sm font-medium capitalize -mb-px transition-colors">
              {t}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ backgroundColor: `${COLORS.coral}12`, border: `1px solid ${COLORS.coral}44`, color: COLORS.ink }} className="rounded-xl px-4 py-3 mb-6 text-sm">{error}</div>
        )}

        {tab === "donors" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {!adding ? (
              <button onClick={() => setAdding(true)} style={{ border: `1.5px dashed ${COLORS.line}`, color: `${COLORS.ink}88` }} className="w-full rounded-xl px-4 py-3 text-sm flex items-center justify-center gap-2 mb-2">
                <Plus size={14} /> Add donor
              </button>
            ) : (
              <NewDonorForm onAdd={handleAdd} onCancel={() => setAdding(false)} />
            )}

            {loading ? (
              <p style={{ color: `${COLORS.ink}77` }} className="text-sm">Loading…</p>
            ) : donors.length === 0 ? (
              <p style={{ color: `${COLORS.ink}77` }} className="text-sm">No donors yet.</p>
            ) : (
              donors.map((d) => <DonorCard key={d.id} donor={d} onSave={handleSave} />)
            )}
          </motion.div>
        )}

        {tab === "fosters" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {fosters.map((f) => (
              <div key={f.animal} style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${f.status === "needs placement" ? COLORS.coral : COLORS.line}` }} className="rounded-xl px-5 py-4 flex items-center gap-4">
                <div style={{ backgroundColor: `${COLORS.teal}18` }} className="h-9 w-9 rounded-full flex items-center justify-center shrink-0">
                  <PawPrint size={14} color={COLORS.teal} />
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ color: COLORS.ink }} className="text-sm font-medium">
                    {f.animal} <span style={{ color: `${COLORS.ink}66` }} className="font-normal capitalize">· {f.species}</span>
                  </div>
                  <div style={{ color: `${COLORS.ink}77` }} className="text-xs">
                    {f.status === "needs placement" ? <span style={{ color: COLORS.coral }}>Needs a foster placement</span> : <>with {f.foster} · since {f.since}</>}
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
