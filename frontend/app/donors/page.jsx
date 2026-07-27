"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Heart, Home, PawPrint, Circle, Plus, ChevronDown, Check, Send, AlertCircle, DollarSign } from "lucide-react";
import Nav from "../../components/Nav";
import Reveal from "../../components/Reveal";
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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function DonorCard({ donor, donations, cases, onSave, onAddDonation, onUpdateDonationCase }) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(donor);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  const [donationForm, setDonationForm] = useState({ amount: "", currency: "MXN", donatedAt: todayISO(), caseId: "" });
  const [addingDonation, setAddingDonation] = useState(false);

  useEffect(() => setDraft(donor), [donor]);

  async function handleAddDonation() {
    if (!donationForm.amount) return;
    setAddingDonation(true);
    await onAddDonation(donor.id, {
      amount: Number(donationForm.amount),
      currency: donationForm.currency,
      donated_at: donationForm.donatedAt,
      case_id: donationForm.caseId || null,
    });
    setDonationForm({ amount: "", currency: donationForm.currency, donatedAt: todayISO(), caseId: "" });
    setAddingDonation(false);
  }

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

          <div style={{ borderTop: `1.5px solid ${COLORS.line}` }} className="pt-3 mt-1 space-y-2">
            <div style={{ color: COLORS.ink, fontFamily: FONTS.mono }} className="text-xs uppercase tracking-wide opacity-70 flex items-center gap-1.5">
              <DollarSign size={12} /> Donations
            </div>

            {donations.length === 0 ? (
              <p style={{ color: `${COLORS.ink}66` }} className="text-xs">No donations logged yet.</p>
            ) : (
              <div className="space-y-1.5">
                {donations.map((d) => (
                  <div key={d.id} style={{ backgroundColor: `${COLORS.teal}0a` }} className="rounded-lg px-3 py-2 flex items-center gap-2">
                    <div style={{ color: COLORS.ink, fontFamily: FONTS.mono }} className="text-xs shrink-0">
                      {Number(d.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {d.currency}
                    </div>
                    <div style={{ color: `${COLORS.ink}77` }} className="text-xs shrink-0">{d.donated_at}</div>
                    <select value={d.case_id || ""} onChange={(e) => onUpdateDonationCase(d.id, e.target.value || null)}
                      style={inputStyle} className="flex-1 min-w-0 rounded-lg px-2 py-1 text-xs outline-none">
                      <option value="">No case earmarked</option>
                      {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <input type="number" step="0.01" min="0" placeholder="Amount" value={donationForm.amount}
                onChange={(e) => setDonationForm({ ...donationForm, amount: e.target.value })}
                style={inputStyle} className="rounded-xl px-3 py-2 text-sm outline-none" />
              <select value={donationForm.currency} onChange={(e) => setDonationForm({ ...donationForm, currency: e.target.value })}
                style={inputStyle} className="rounded-xl px-3 py-2 text-sm outline-none">
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
              <input type="date" value={donationForm.donatedAt}
                onChange={(e) => setDonationForm({ ...donationForm, donatedAt: e.target.value })}
                style={inputStyle} className="rounded-xl px-3 py-2 text-sm outline-none" />
              <select value={donationForm.caseId} onChange={(e) => setDonationForm({ ...donationForm, caseId: e.target.value })}
                style={inputStyle} className="rounded-xl px-3 py-2 text-sm outline-none">
                <option value="">No case (earmark later)</option>
                {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <button onClick={handleAddDonation} disabled={addingDonation || !donationForm.amount}
              style={{ backgroundColor: donationForm.amount ? COLORS.marigold : COLORS.line, color: "#FFFFFF" }}
              className="rounded-full px-4 py-2 text-sm font-medium flex items-center gap-1.5">
              <Plus size={13} /> {addingDonation ? "Logging…" : "Log donation"}
            </button>
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
  const [donations, setDonations] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [orgId, setOrgId] = useState(null);

  const load = useCallback(async () => {
    if (!supabase) { setError("Supabase isn't configured."); setLoading(false); return; }
    const { data: memberships } = await supabase.from("memberships").select("org_id").eq("status", "active").limit(1);
    const org = memberships?.[0]?.org_id ?? null;
    setOrgId(org);

    const { data, error: err } = await supabase.from("donors").select("*").order("name");
    if (err) { setError(err.message); setLoading(false); return; }
    setDonors(data ?? []);

    const { data: donationRows, error: donErr } = await supabase
      .from("donations").select("id, donor_id, case_id, amount, currency, donated_at")
      .order("donated_at", { ascending: false });
    if (donErr) { setError(donErr.message); setLoading(false); return; }
    setDonations(donationRows ?? []);

    if (org) {
      const { data: caseRows } = await supabase.from("cases").select("id, title").eq("org_id", org).order("title");
      setCases(caseRows ?? []);
    }

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

  async function handleAddDonation(donorId, fields) {
    setError("");
    const { error: err } = await supabase.from("donations").insert({ ...fields, donor_id: donorId, org_id: orgId });
    if (err) { setError(err.message); return; }
    load();
  }

  async function handleUpdateDonationCase(donationId, caseId) {
    setError("");
    const { error: err } = await supabase.from("donations").update({ case_id: caseId }).eq("id", donationId);
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
              donors.map((d, i) => (
                <Reveal key={d.id} delay={Math.min(i, 5) * 0.03}>
                  <DonorCard
                    donor={d}
                    donations={donations.filter((don) => don.donor_id === d.id)}
                    cases={cases}
                    onSave={handleSave}
                    onAddDonation={handleAddDonation}
                    onUpdateDonationCase={handleUpdateDonationCase}
                  />
                </Reveal>
              ))
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
