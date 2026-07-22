"use client";
import { useState, useEffect, useCallback } from "react";
import { ChevronDown, Check, ScrollText } from "lucide-react";
import Nav from "../../components/Nav";
import { COLORS, FONTS, inputStyle } from "../../lib/design-tokens";
import { supabase } from "../../lib/supabase-client";

// Reachable by admin and legal_reviewer only (see middleware.js's
// can_review_legal() check) - a legal_reviewer is expected to be an
// outside lawyer the org brings in specifically for this, with no access
// to anything else in the app.

function EntryCard({ entry, onSave, onMarkReviewed }) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(entry);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(entry), [entry]);

  async function handleSave() {
    setSaving(true);
    await onSave(entry.id, {
      jurisdiction: draft.jurisdiction,
      statute_code: draft.statute_code,
      title: draft.title,
      summary: draft.summary,
      source_url: draft.source_url,
    });
    setSaving(false);
  }

  return (
    <div style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${entry.lawyer_reviewed ? COLORS.green : COLORS.line}` }} className="rounded-2xl overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full px-5 py-4 flex items-center gap-3 text-left">
        <div style={{ backgroundColor: entry.lawyer_reviewed ? `${COLORS.green}18` : `${COLORS.marigold}18` }} className="h-9 w-9 rounded-full flex items-center justify-center shrink-0">
          <ScrollText size={14} color={entry.lawyer_reviewed ? COLORS.green : COLORS.marigold} />
        </div>
        <div className="flex-1 min-w-0">
          <div style={{ color: COLORS.ink }} className="text-sm font-medium">{entry.statute_code}</div>
          <div style={{ color: `${COLORS.ink}77` }} className="text-xs">
            {entry.jurisdiction}
            {entry.lawyer_reviewed && <span style={{ color: COLORS.green }}> · reviewed by {entry.reviewed_by || "—"}</span>}
          </div>
        </div>
        <ChevronDown size={16} color={`${COLORS.ink}66`} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </button>

      {expanded && (
        <div style={{ borderTop: `1.5px solid ${COLORS.line}` }} className="px-5 py-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={draft.jurisdiction || ""} onChange={(e) => setDraft({ ...draft, jurisdiction: e.target.value })}
              placeholder="Jurisdiction" style={inputStyle} className="rounded-xl px-3 py-2 text-sm outline-none" />
            <input value={draft.statute_code || ""} onChange={(e) => setDraft({ ...draft, statute_code: e.target.value })}
              placeholder="Statute code" style={inputStyle} className="rounded-xl px-3 py-2 text-sm outline-none" />
          </div>
          <input value={draft.title || ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Title" style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none" />
          <textarea value={draft.summary || ""} onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
            placeholder="Summary" style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none min-h-24 resize-none" />
          <input value={draft.source_url || ""} onChange={(e) => setDraft({ ...draft, source_url: e.target.value })}
            placeholder="Source URL" style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none" />

          <div className="flex items-center gap-3 pt-1">
            <button onClick={handleSave} disabled={saving}
              style={{ backgroundColor: COLORS.teal, color: "#FFFFFF" }} className="rounded-full px-4 py-2 text-sm font-medium">
              {saving ? "Saving…" : "Save changes"}
            </button>
            {!entry.lawyer_reviewed ? (
              <button onClick={() => onMarkReviewed(entry.id)}
                style={{ backgroundColor: COLORS.green, color: "#FFFFFF" }} className="rounded-full px-4 py-2 text-sm font-medium flex items-center gap-1.5">
                <Check size={13} /> Mark reviewed
              </button>
            ) : (
              <span style={{ color: `${COLORS.ink}77` }} className="text-xs">
                Reviewed {entry.reviewed_at ? new Date(entry.reviewed_at).toLocaleDateString() : ""}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LegalReviewPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const loadEntries = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("legal_references")
      .select("id, jurisdiction, statute_code, title, summary, source_url, lawyer_reviewed, reviewed_by, reviewed_at")
      .order("jurisdiction").order("statute_code");
    if (err) { setError(err.message); return; }
    setEntries(data ?? []);
  }, []);

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Supabase isn't configured."); setLoading(false); return; }
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? "");
      await loadEntries();
      setLoading(false);
    }
    init();
  }, [loadEntries]);

  async function handleSave(id, fields) {
    setError("");
    const { error: err } = await supabase.from("legal_references").update(fields).eq("id", id);
    if (err) { setError(err.message); return; }
    loadEntries();
  }

  async function handleMarkReviewed(id) {
    setError("");
    const { error: err } = await supabase.from("legal_references").update({
      lawyer_reviewed: true,
      reviewed_by: userEmail || "unknown reviewer",
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (err) { setError(err.message); return; }
    loadEntries();
  }

  const reviewedCount = entries.filter((e) => e.lawyer_reviewed).length;

  return (
    <div style={{ backgroundColor: COLORS.paper, minHeight: "100vh", fontFamily: FONTS.body }}>
      <Nav crumb="Legal Review" />

      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-baseline justify-between mb-2">
          <h1 style={{ fontFamily: FONTS.display, color: COLORS.ink }} className="text-3xl">Legal reference review</h1>
          <span style={{ color: `${COLORS.ink}77`, fontFamily: FONTS.mono }} className="text-xs">
            {reviewedCount} / {entries.length} reviewed
          </span>
        </div>
        <p style={{ color: `${COLORS.ink}99` }} className="text-sm mb-8">
          Edit citation text and mark entries reviewed once verified.
        </p>

        {error && (
          <div style={{ backgroundColor: `${COLORS.coral}12`, border: `1px solid ${COLORS.coral}44`, color: COLORS.ink }} className="rounded-xl px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ color: `${COLORS.ink}77` }} className="text-sm">Loading…</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} onSave={handleSave} onMarkReviewed={handleMarkReviewed} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
