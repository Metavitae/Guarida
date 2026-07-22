"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Globe2, ArrowRight } from "lucide-react";
import Nav from "../../components/Nav";
import { COLORS, FONTS, inputStyle } from "../../lib/design-tokens";
import { supabase } from "../../lib/supabase-client";

// "cross_border_transports" is a PLACEHOLDER table name pending Wet Noses'
// own internal term for this stage - see docs/cross-border-transport-schema.md.

const ANIMAL_STATUSES = ["in_care", "fostered", "quarantine", "in_transit", "adopted", "transferred", "returned_to_owner", "deceased"];
const TRANSPORT_STATUSES = ["quarantine", "in_transit", "completed", "cancelled"];

function Field({ label, children }) {
  return (
    <div className="mb-4">
      <label style={{ color: COLORS.ink, fontFamily: FONTS.mono }} className="block text-xs tracking-wide uppercase mb-2 opacity-70">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function CrossBorderPage() {
  const [orgId, setOrgId] = useState(null);
  const [animals, setAnimals] = useState([]);
  const [transports, setTransports] = useState([]);
  const [selectedAnimalId, setSelectedAnimalId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAddAnimal, setShowAddAnimal] = useState(false);
  const [newAnimal, setNewAnimal] = useState({ name: "", species: "dog" });

  const [form, setForm] = useState({
    status: "quarantine", destinationCountry: "", destinationState: "",
    quarantineStart: "", quarantineEnd: "", transportDate: "", notes: "",
  });

  const loadAll = useCallback(async (org) => {
    const { data: animalRows, error: aErr } = await supabase
      .from("animals").select("id, name, species, status").eq("org_id", org).order("created_at", { ascending: false });
    if (aErr) { setError(aErr.message); return; }
    setAnimals(animalRows ?? []);

    const { data: transportRows, error: tErr } = await supabase
      .from("cross_border_transports")
      .select("id, animal_id, status, destination_country, destination_state, quarantine_start, quarantine_end, transport_date, notes")
      .eq("org_id", org).order("created_at", { ascending: false });
    if (tErr) { setError(tErr.message); return; }
    setTransports(transportRows ?? []);
  }, []);

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Supabase isn't configured."); setLoading(false); return; }
      const { data: memberships, error: memErr } = await supabase
        .from("memberships").select("org_id").eq("status", "active").limit(1);
      if (memErr || !memberships?.length) {
        setError("Couldn't find an active org membership for this account.");
        setLoading(false);
        return;
      }
      const org = memberships[0].org_id;
      setOrgId(org);
      await loadAll(org);
      setLoading(false);
    }
    init();
  }, [loadAll]);

  async function handleAddAnimal(e) {
    e.preventDefault();
    setError("");
    const { data, error: err } = await supabase.from("animals")
      .insert({ org_id: orgId, name: newAnimal.name || null, species: newAnimal.species, status: "in_care" })
      .select().single();
    if (err) { setError(err.message); return; }
    setNewAnimal({ name: "", species: "dog" });
    setShowAddAnimal(false);
    await loadAll(orgId);
    setSelectedAnimalId(data.id);
  }

  async function handleAnimalStatusChange(animalId, status) {
    setError("");
    const { error: err } = await supabase.from("animals").update({ status, updated_at: new Date().toISOString() }).eq("id", animalId);
    if (err) { setError(err.message); return; }
    loadAll(orgId);
  }

  async function handleLogTransport(e) {
    e.preventDefault();
    setError("");
    if (!selectedAnimalId) { setError("Pick an animal first."); return; }

    const { data: personId, error: personErr } = await supabase.rpc("my_person_id");
    if (personErr) { setError(personErr.message); return; }

    const { error: err } = await supabase.from("cross_border_transports").insert({
      org_id: orgId,
      animal_id: selectedAnimalId,
      status: form.status,
      destination_country: form.destinationCountry || null,
      destination_state: form.destinationState || null,
      quarantine_start: form.quarantineStart || null,
      quarantine_end: form.quarantineEnd || null,
      transport_date: form.transportDate || null,
      notes: form.notes || null,
      responsible_person_id: personId,
    });
    if (err) { setError(err.message); return; }

    setForm({ status: "quarantine", destinationCountry: "", destinationState: "", quarantineStart: "", quarantineEnd: "", transportDate: "", notes: "" });
    loadAll(orgId);
  }

  async function handleTransportStatusChange(transportId, status) {
    setError("");
    const { error: err } = await supabase.from("cross_border_transports").update({ status, updated_at: new Date().toISOString() }).eq("id", transportId);
    if (err) { setError(err.message); return; }
    loadAll(orgId);
  }

  const selectedAnimal = animals.find((a) => a.id === selectedAnimalId);
  const selectedTransports = transports.filter((t) => t.animal_id === selectedAnimalId);

  return (
    <div style={{ backgroundColor: COLORS.paper, minHeight: "100vh", fontFamily: FONTS.body }}>
      <Nav crumb="Cross-Border" />

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 style={{ fontFamily: FONTS.display, color: COLORS.ink }} className="text-3xl mb-2">Cross-border transport</h1>
        <p style={{ color: `${COLORS.ink}99` }} className="text-sm mb-8">
          Quarantine and cross-border transport, tracked per animal. Manually logged by staff — nothing here moves automatically.
        </p>

        {error && (
          <div style={{ backgroundColor: `${COLORS.coral}12`, border: `1px solid ${COLORS.coral}44`, color: COLORS.ink }} className="rounded-xl px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ color: `${COLORS.ink}77` }} className="text-sm">Loading…</p>
        ) : (
          <>
            <Field label="Animal">
              <div className="flex gap-2">
                <select
                  value={selectedAnimalId}
                  onChange={(e) => setSelectedAnimalId(e.target.value)}
                  style={{ ...inputStyle }}
                  className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                >
                  <option value="">Select an animal…</option>
                  {animals.map((a) => (
                    <option key={a.id} value={a.id}>{a.name || "(unnamed)"} · {a.species} · {a.status}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setShowAddAnimal(!showAddAnimal)}
                  style={{ color: COLORS.teal }} className="text-xs flex items-center gap-1 font-medium shrink-0">
                  <Plus size={14} /> New
                </button>
              </div>
            </Field>

            {showAddAnimal && (
              <form onSubmit={handleAddAnimal} style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${COLORS.line}` }} className="rounded-xl p-4 mb-6 flex gap-2 items-end">
                <div className="flex-1">
                  <input placeholder="Name (optional)" value={newAnimal.name} onChange={(e) => setNewAnimal({ ...newAnimal, name: e.target.value })}
                    style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none" />
                </div>
                <select value={newAnimal.species} onChange={(e) => setNewAnimal({ ...newAnimal, species: e.target.value })}
                  style={{ ...inputStyle }} className="rounded-xl px-3 py-2 text-sm outline-none">
                  <option value="dog">Dog</option>
                  <option value="cat">Cat</option>
                  <option value="other">Other</option>
                </select>
                <button type="submit" style={{ backgroundColor: COLORS.teal, color: "#FFFFFF" }} className="rounded-full px-4 py-2 text-sm font-medium shrink-0">
                  Add
                </button>
              </form>
            )}

            {selectedAnimal && (
              <>
                <div style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${COLORS.line}` }} className="rounded-2xl p-5 mb-6 flex items-center gap-4">
                  <div style={{ backgroundColor: `${COLORS.marigold}18` }} className="h-10 w-10 rounded-full flex items-center justify-center shrink-0">
                    <Globe2 size={16} color={COLORS.marigold} />
                  </div>
                  <div className="flex-1">
                    <div style={{ color: COLORS.ink }} className="text-sm font-medium">{selectedAnimal.name || "(unnamed)"}</div>
                    <div style={{ color: `${COLORS.ink}77` }} className="text-xs">Top-level status</div>
                  </div>
                  <select
                    value={selectedAnimal.status}
                    onChange={(e) => handleAnimalStatusChange(selectedAnimal.id, e.target.value)}
                    style={{ backgroundColor: COLORS.paper, color: COLORS.ink }}
                    className="rounded-xl px-3 py-2 text-sm outline-none"
                  >
                    {ANIMAL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div style={{ backgroundColor: COLORS.nightDeep }} className="rounded-2xl p-6 mb-6">
                  <div style={{ color: COLORS.paper, fontFamily: FONTS.mono }} className="text-xs uppercase tracking-wide mb-4">
                    Log a transport record
                  </div>
                  <form onSubmit={handleLogTransport} className="space-y-3">
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                      style={{ backgroundColor: "#FFFFFF", color: COLORS.ink }} className="w-full rounded-xl px-3 py-2 text-sm outline-none">
                      {TRANSPORT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-3">
                      <input placeholder="Destination country" value={form.destinationCountry} onChange={(e) => setForm({ ...form, destinationCountry: e.target.value })}
                        style={{ backgroundColor: "#FFFFFF", color: COLORS.ink }} className="rounded-xl px-3 py-2 text-sm outline-none" />
                      <input placeholder="Destination state" value={form.destinationState} onChange={(e) => setForm({ ...form, destinationState: e.target.value })}
                        style={{ backgroundColor: "#FFFFFF", color: COLORS.ink }} className="rounded-xl px-3 py-2 text-sm outline-none" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label style={{ color: `${COLORS.paper}99`, fontFamily: FONTS.mono }} className="block text-[10px] uppercase mb-1">Quarantine start</label>
                        <input type="date" value={form.quarantineStart} onChange={(e) => setForm({ ...form, quarantineStart: e.target.value })}
                          style={{ backgroundColor: "#FFFFFF", color: COLORS.ink }} className="w-full rounded-xl px-3 py-2 text-sm outline-none" />
                      </div>
                      <div>
                        <label style={{ color: `${COLORS.paper}99`, fontFamily: FONTS.mono }} className="block text-[10px] uppercase mb-1">Quarantine end</label>
                        <input type="date" value={form.quarantineEnd} onChange={(e) => setForm({ ...form, quarantineEnd: e.target.value })}
                          style={{ backgroundColor: "#FFFFFF", color: COLORS.ink }} className="w-full rounded-xl px-3 py-2 text-sm outline-none" />
                      </div>
                      <div>
                        <label style={{ color: `${COLORS.paper}99`, fontFamily: FONTS.mono }} className="block text-[10px] uppercase mb-1">Transport date</label>
                        <input type="date" value={form.transportDate} onChange={(e) => setForm({ ...form, transportDate: e.target.value })}
                          style={{ backgroundColor: "#FFFFFF", color: COLORS.ink }} className="w-full rounded-xl px-3 py-2 text-sm outline-none" />
                      </div>
                    </div>
                    <input placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      style={{ backgroundColor: "#FFFFFF", color: COLORS.ink }} className="w-full rounded-xl px-3 py-2 text-sm outline-none" />
                    <button type="submit" style={{ backgroundColor: COLORS.marigold, color: COLORS.nightDeep }} className="w-full rounded-full py-3 font-medium text-sm">
                      Log record
                    </button>
                  </form>
                </div>

                {selectedTransports.length > 0 && (
                  <div className="space-y-2">
                    {selectedTransports.map((t) => (
                      <div key={t.id} style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${COLORS.line}` }} className="rounded-xl px-4 py-3 flex items-center gap-3">
                        <ArrowRight size={14} color={COLORS.teal} className="shrink-0" />
                        <div className="flex-1 min-w-0 text-sm" style={{ color: COLORS.ink }}>
                          {[t.destination_state, t.destination_country].filter(Boolean).join(", ") || "(no destination set)"}
                          {t.notes && <span style={{ color: `${COLORS.ink}77` }}> — {t.notes}</span>}
                        </div>
                        <select
                          value={t.status}
                          onChange={(e) => handleTransportStatusChange(t.id, e.target.value)}
                          style={{ backgroundColor: COLORS.paper, color: COLORS.ink }}
                          className="rounded-full px-3 py-1 text-xs outline-none shrink-0"
                        >
                          {TRANSPORT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
