"use client";
import { useState, useEffect, useCallback } from "react";
import {
  FileText, User, ScrollText, Paperclip, Check, Send, Copy, PawPrint,
} from "lucide-react";
import Nav from "../../components/Nav";
import { COLORS, FONTS, inputStyle } from "../../lib/design-tokens";
import { supabase, myPersonProfile, uploadAuthorityReportEvidence } from "../../lib/supabase-client";

// Compiles a case into a general-purpose report Guarida can hand to
// whatever authority/process staff actually use — NOT built to mirror any
// one government site's form. Staff decide the channel (a web form, email,
// phone call, in person) and record what they actually did afterward.

const EVIDENCE_LIMIT = 6; // Guarida's own storage/UX limit, not copied from anywhere.

function draftDescription(caseRow, animal) {
  const when = caseRow.created_at
    ? new Date(caseRow.created_at).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })
    : "[fecha]";
  const who = animal?.name ? `Animal: ${animal.name}` : "[quién — nombre del animal o persona involucrada, si se conoce]";
  return `¿Quién? ${who}\n\n¿Qué? ${caseRow.description || "[completar]"}\n\n¿Cuándo? ${when}\n\n¿Dónde? ${caseRow.location || "[completar]"}\n\n¿Por qué? [completar — motivo o contexto, si se conoce]`;
}

function defaultCategory(caseRow, animal) {
  const species = (animal?.species || caseRow.species || "").toLowerCase();
  return species === "wildlife" ? "wildlife" : "domestic";
}

function emptyDraft() {
  return {
    id: null,
    animal_id: null,
    category: "domestic",
    description: "",
    reporter_name: "", reporter_phone: "", reporter_email: "",
    evidence_photo_ids: [],
    reported_at: null, reported_by: null, reported_via: "",
  };
}

function Field({ label, children }) {
  return (
    <div className="mb-4">
      <label style={{ color: COLORS.ink, fontFamily: FONTS.mono }} className="block text-xs tracking-wide uppercase mb-1.5 opacity-70">
        {label}
      </label>
      {children}
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, children }) {
  return (
    <div style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${COLORS.line}` }} className="rounded-2xl px-5 py-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={15} color={COLORS.teal} />
        <span style={{ color: COLORS.ink, fontFamily: FONTS.mono }} className="text-xs uppercase tracking-wide">{title}</span>
      </div>
      {subtitle && <p style={{ color: `${COLORS.ink}77` }} className="text-xs mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-1" />}
      {children}
    </div>
  );
}

function compiledText(draft, caseRow, animal) {
  return [
    `CASE: ${caseRow?.title || "(untitled)"}`,
    animal ? `ANIMAL: ${animal.name} (${animal.species})` : null,
    `CATEGORY: ${draft.category === "wildlife" ? "Wildlife" : "Domestic animal"}`,
    "",
    draft.description,
    "",
    `REPORTED BY: ${draft.reporter_name} — ${draft.reporter_phone} — ${draft.reporter_email}`,
    draft.reported_at ? `REPORTED: ${new Date(draft.reported_at).toLocaleString()} — ${draft.reported_via}` : "NOT YET REPORTED",
  ].filter(Boolean).join("\n");
}

export default function AuthorityReportPage() {
  const [orgId, setOrgId] = useState(null);
  const [cases, setCases] = useState([]);
  const [caseId, setCaseId] = useState("");
  const [caseRow, setCaseRow] = useState(null);
  const [animal, setAnimal] = useState(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [evidencePhotos, setEvidencePhotos] = useState([]);
  const [legalMatch, setLegalMatch] = useState(null);
  const [reportedViaInput, setReportedViaInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingCase, setLoadingCase] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Supabase isn't configured."); setLoading(false); return; }
      const { data: memberships } = await supabase.from("memberships").select("org_id").eq("status", "active").limit(1);
      setOrgId(memberships?.[0]?.org_id ?? null);

      const { data: caseRows, error: caseErr } = await supabase
        .from("cases").select("id, title, species, status, created_at").order("created_at", { ascending: false });
      if (caseErr) { setError(caseErr.message); setLoading(false); return; }
      setCases(caseRows ?? []);
      setLoading(false);
    }
    init();
  }, []);

  const loadCase = useCallback(async (id) => {
    setLoadingCase(true);
    setError("");

    const { data: cRow, error: caseErr } = await supabase
      .from("cases").select("id, title, description, species, location, animal_id, created_at").eq("id", id).single();
    if (caseErr) { setError(caseErr.message); setLoadingCase(false); return; }
    setCaseRow(cRow);

    let animalRow = null;
    if (cRow.animal_id) {
      const { data: a } = await supabase.from("animals").select("id, name, species").eq("id", cRow.animal_id).single();
      animalRow = a ?? null;
    }
    setAnimal(animalRow);

    const { data: matches } = await supabase
      .from("case_legal_matches")
      .select("id, confirmed_at, legal_references(statute_code, title, jurisdiction)")
      .eq("case_id", id)
      .not("confirmed_by", "is", null)
      .order("confirmed_at", { ascending: false })
      .limit(1);
    setLegalMatch(matches?.[0]?.legal_references ?? null);

    const { data: existing } = await supabase
      .from("case_authority_reports").select("*").eq("case_id", id).maybeSingle();

    if (existing) {
      setDraft(existing);
      if (existing.evidence_photo_ids?.length) {
        const { data: photos } = await supabase.from("case_photos").select("id, storage_path").in("id", existing.evidence_photo_ids);
        setEvidencePhotos(photos ?? []);
      } else {
        setEvidencePhotos([]);
      }
    } else {
      const profile = await myPersonProfile().catch(() => null);
      setDraft({
        ...emptyDraft(),
        animal_id: cRow.animal_id ?? null,
        category: defaultCategory(cRow, animalRow),
        description: draftDescription(cRow, animalRow),
        reporter_name: profile?.full_name ?? "",
        reporter_phone: profile?.whatsapp_number ?? "",
        reporter_email: profile?.email ?? "",
      });
      setEvidencePhotos([]);
    }
    setReportedViaInput("");
    setLoadingCase(false);
  }, []);

  function selectCase(id) {
    setCaseId(id);
    if (id) loadCase(id);
    else { setDraft(emptyDraft()); setEvidencePhotos([]); setLegalMatch(null); setCaseRow(null); setAnimal(null); }
  }

  function set(field) {
    return (e) => setDraft((d) => ({ ...d, [field]: e.target.value }));
  }

  async function handleFileSelect(e) {
    const files = Array.from(e.target.files || []).slice(0, EVIDENCE_LIMIT - evidencePhotos.length);
    if (!files.length) return;
    setUploading(true);
    setError("");
    try {
      for (const file of files) {
        const row = await uploadAuthorityReportEvidence(file, { orgId, caseId });
        setEvidencePhotos((p) => [...p, row]);
        setDraft((d) => ({ ...d, evidence_photo_ids: [...d.evidence_photo_ids, row.id] }));
      }
    } catch (err) {
      setError(err.message);
    }
    setUploading(false);
    e.target.value = "";
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const payload = {
      animal_id: draft.animal_id, category: draft.category, description: draft.description,
      reporter_name: draft.reporter_name, reporter_phone: draft.reporter_phone, reporter_email: draft.reporter_email,
      evidence_photo_ids: draft.evidence_photo_ids,
      updated_at: new Date().toISOString(),
    };

    if (draft.id) {
      const { error: err } = await supabase.from("case_authority_reports").update(payload).eq("id", draft.id);
      if (err) setError(err.message);
    } else {
      const { data: personId, error: personErr } = await supabase.rpc("my_person_id");
      if (personErr) { setError(personErr.message); setSaving(false); return; }
      const { data, error: err } = await supabase
        .from("case_authority_reports")
        .insert({ ...payload, org_id: orgId, case_id: caseId, created_by: personId })
        .select().single();
      if (err) setError(err.message);
      else setDraft((d) => ({ ...d, id: data.id }));
    }
    setSaving(false);
  }

  async function handleMarkReported() {
    if (!draft.id || !reportedViaInput.trim()) return;
    setError("");
    const { data: personId, error: personErr } = await supabase.rpc("my_person_id");
    if (personErr) { setError(personErr.message); return; }
    const fields = { reported_at: new Date().toISOString(), reported_by: personId, reported_via: reportedViaInput.trim() };
    const { error: err } = await supabase.from("case_authority_reports").update(fields).eq("id", draft.id);
    if (err) { setError(err.message); return; }
    setDraft((d) => ({ ...d, ...fields }));
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(compiledText(draft, caseRow, animal));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div style={{ backgroundColor: COLORS.paper, minHeight: "100vh", fontFamily: FONTS.body }}>
      <Nav crumb="Authority Report" />

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 style={{ fontFamily: FONTS.display, color: COLORS.ink }} className="text-3xl mb-2">Authority report</h1>
        <p style={{ color: `${COLORS.ink}99` }} className="text-sm mb-8">
          Guarida's own compiled summary of a case — <strong>not a submission to any authority</strong>.
          Staff take it wherever the situation actually requires (a web form, email, phone call, in person)
          and record what they did afterward.
        </p>

        {error && (
          <div style={{ backgroundColor: `${COLORS.coral}12`, border: `1px solid ${COLORS.coral}44`, color: COLORS.ink }} className="rounded-xl px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        <Field label="Case">
          <select value={caseId} onChange={(e) => selectCase(e.target.value)}
            style={inputStyle} className="w-full rounded-xl px-4 py-3 text-sm outline-none" disabled={loading}>
            <option value="">{loading ? "Loading cases…" : cases.length ? "Select a case…" : "No cases yet"}</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>{c.title || "(untitled)"} — {c.species} · {c.status}</option>
            ))}
          </select>
        </Field>

        {caseId && loadingCase && <p style={{ color: `${COLORS.ink}77` }} className="text-sm">Loading case…</p>}

        {caseId && !loadingCase && (
          <>
            <div style={{ backgroundColor: draft.reported_at ? `${COLORS.green}18` : `${COLORS.marigold}18`, border: `1.5px solid ${draft.reported_at ? COLORS.green : COLORS.marigold}` }}
              className="rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
              <FileText size={15} color={draft.reported_at ? COLORS.green : COLORS.marigold} />
              <span style={{ color: COLORS.ink }} className="text-xs font-medium">
                {draft.reported_at
                  ? `Marked reported ${new Date(draft.reported_at).toLocaleDateString()} — ${draft.reported_via}`
                  : "Compiled summary — not yet reported anywhere"}
              </span>
            </div>

            {animal && (
              <div className="flex items-center gap-2 mb-4">
                <PawPrint size={14} color={COLORS.teal} />
                <span style={{ color: `${COLORS.ink}99` }} className="text-xs">Linked animal: {animal.name} ({animal.species})</span>
              </div>
            )}

            {legalMatch && (
              <div style={{ backgroundColor: COLORS.nightDeep }} className="rounded-xl px-4 py-3 mb-6 flex items-start gap-2">
                <ScrollText size={15} color={COLORS.marigold} className="mt-0.5 shrink-0" />
                <div>
                  <div style={{ color: COLORS.paper, fontFamily: FONTS.mono }} className="text-xs mb-0.5">{legalMatch.statute_code} · {legalMatch.jurisdiction}</div>
                  <div style={{ color: `${COLORS.paper}b3` }} className="text-xs">{legalMatch.title} — context for staff only, not inserted into the report text.</div>
                </div>
              </div>
            )}

            <Section icon={FileText} title="Category" subtitle="Pre-selected from the case's animal type, adjust if wrong.">
              <div className="flex gap-2">
                {[["domestic", "Domestic animal"], ["wildlife", "Wildlife"]].map(([val, label]) => (
                  <button key={val} onClick={() => setDraft((d) => ({ ...d, category: val }))}
                    style={{
                      backgroundColor: draft.category === val ? COLORS.coral : "#FFFFFF",
                      color: draft.category === val ? "#FFFFFF" : COLORS.ink,
                      border: `1.5px solid ${draft.category === val ? COLORS.coral : COLORS.line}`,
                    }}
                    className="px-4 py-2 rounded-full text-sm transition-colors">
                    {label}
                  </button>
                ))}
              </div>
            </Section>

            <Section icon={ScrollText} title="Compiled description" subtitle="Who/what/when/where/why, auto-drafted from case notes — always edit before using.">
              <textarea style={inputStyle} className="w-full rounded-xl px-4 py-3 text-sm outline-none min-h-40 resize-none"
                value={draft.description} onChange={set("description")} />
            </Section>

            <Section icon={User} title="Reporter / staff contact" subtitle="Defaults to your own profile — edit as needed.">
              <Field label="Name">
                <input style={inputStyle} className="w-full rounded-xl px-4 py-3 text-sm outline-none" value={draft.reporter_name} onChange={set("reporter_name")} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone"><input style={inputStyle} className="w-full rounded-xl px-4 py-3 text-sm outline-none" value={draft.reporter_phone} onChange={set("reporter_phone")} /></Field>
                <Field label="Email"><input style={inputStyle} className="w-full rounded-xl px-4 py-3 text-sm outline-none" value={draft.reporter_email} onChange={set("reporter_email")} /></Field>
              </div>
            </Section>

            <Section icon={Paperclip} title="Evidence" subtitle={`Photos, video, or documents. Up to ${EVIDENCE_LIMIT} files.`}>
              <div className="flex flex-wrap gap-2 mb-3">
                {evidencePhotos.map((p) => (
                  <div key={p.id} style={{ border: `1.5px solid ${COLORS.line}`, color: COLORS.ink }} className="rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                    <Check size={12} color={COLORS.green} /> {p.storage_path.split("/").pop()}
                  </div>
                ))}
              </div>
              {evidencePhotos.length < EVIDENCE_LIMIT && (
                <label style={{ border: `1.5px dashed ${COLORS.line}`, color: `${COLORS.ink}88` }}
                  className="w-full rounded-xl px-4 py-6 text-sm flex flex-col items-center gap-2 cursor-pointer">
                  <Paperclip size={20} color={COLORS.teal} />
                  {uploading ? "Uploading…" : `Add file (${EVIDENCE_LIMIT - evidencePhotos.length} remaining)`}
                  <input type="file" multiple className="hidden" onChange={handleFileSelect} disabled={uploading || !orgId} />
                </label>
              )}
            </Section>

            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <button onClick={handleSave} disabled={saving}
                style={{ backgroundColor: COLORS.teal, color: "#FFFFFF" }} className="rounded-full px-6 py-3 text-sm font-medium">
                {saving ? "Saving…" : draft.id ? "Save changes" : "Save draft"}
              </button>
              {draft.id && (
                <button onClick={handleCopy}
                  style={{ backgroundColor: "#FFFFFF", color: COLORS.ink, border: `1.5px solid ${COLORS.line}` }} className="rounded-full px-6 py-3 text-sm font-medium flex items-center gap-2">
                  <Copy size={14} /> {copied ? "Copied" : "Copy compiled report"}
                </button>
              )}
              {!draft.id && (
                <span style={{ color: `${COLORS.ink}77` }} className="text-xs">Save a draft first.</span>
              )}
            </div>

            {draft.id && !draft.reported_at && (
              <Section icon={Send} title="Mark as reported" subtitle="Record what actually happened — no automation, this is just the case's own record.">
                <Field label="Where / how was this reported?">
                  <input style={inputStyle} className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                    placeholder='e.g. "filed via Bahía de Banderas site", "called 089", "emailed PROFEPA"'
                    value={reportedViaInput} onChange={(e) => setReportedViaInput(e.target.value)} />
                </Field>
                <button onClick={handleMarkReported} disabled={!reportedViaInput.trim()}
                  style={{ backgroundColor: COLORS.green, color: "#FFFFFF", opacity: reportedViaInput.trim() ? 1 : 0.5 }}
                  className="rounded-full px-6 py-3 text-sm font-medium flex items-center gap-2">
                  <Check size={14} /> Mark as reported
                </button>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
