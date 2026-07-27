"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { PawPrint, MapPin, ScrollText, Stethoscope, DollarSign, Heart, Globe2 } from "lucide-react";
import Nav from "../../../components/Nav";
import { COLORS, FONTS } from "../../../lib/design-tokens";
import { supabase } from "../../../lib/supabase-client";

// One case's full picture, pulled live from the tables other screens
// already write to - nothing invented here. Gated the same way
// case-intake/vet-care/expenses/cross-border already are (is_active_worker,
// see middleware.js), since this shows the same case data those screens
// already expose to any active staff/admin/vet worker.
//
// Deliberately no Reveal.jsx/Framer Motion on this page yet - that's a
// separate later task per the founder's own scope decision.
//
// cross_border_transports links via animal_id, not case_id (see
// docs/cross-border-transport-schema.md) - so that section only renders
// when this case has an animal_id AND a transport row exists for it.

function Section({ icon: Icon, title, children }) {
  return (
    <div style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${COLORS.line}` }} className="rounded-2xl p-6 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} color={COLORS.teal} />
        <h2 style={{ fontFamily: FONTS.display, color: COLORS.ink }} className="text-lg">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function CaseDetailPage() {
  const { id } = useParams();
  const [caseRow, setCaseRow] = useState(null);
  const [legalMatches, setLegalMatches] = useState([]);
  const [vetNotifications, setVetNotifications] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [donations, setDonations] = useState([]);
  const [transports, setTransports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!supabase) { setError("Supabase isn't configured."); setLoading(false); return; }

    const { data: c, error: caseErr } = await supabase
      .from("cases")
      .select("id, title, description, species, location, jurisdiction, status, needs_vet_care, animal_id, created_at")
      .eq("id", id)
      .maybeSingle();
    if (caseErr) { setError(caseErr.message); setLoading(false); return; }
    if (!c) { setError("Case not found."); setLoading(false); return; }
    setCaseRow(c);

    const [{ data: matches }, { data: notifications }, { data: exp }, { data: dons }] = await Promise.all([
      supabase.from("case_legal_matches")
        .select("id, suggested_by, confirmed_by, confirmed_at, legal_references(statute_code, title, summary, lawyer_reviewed)")
        .eq("case_id", id),
      supabase.from("vet_notifications")
        .select("id, care_plan_text, notified_at, acknowledged_at")
        .eq("case_id", id).order("notified_at", { ascending: false }),
      supabase.from("expenses")
        .select("id, amount, currency, category, description, created_at")
        .eq("case_id", id).order("created_at", { ascending: false }),
      supabase.from("donations")
        .select("id, amount, currency, donated_at, donors(name)")
        .eq("case_id", id).order("donated_at", { ascending: false }),
    ]);
    setLegalMatches(matches ?? []);
    setVetNotifications(notifications ?? []);
    setExpenses(exp ?? []);
    setDonations(dons ?? []);

    if (c.animal_id) {
      const { data: t } = await supabase.from("cross_border_transports")
        .select("id, status, destination_country, destination_state, quarantine_start, quarantine_end, transport_date")
        .eq("animal_id", c.animal_id).order("created_at", { ascending: false });
      setTransports(t ?? []);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const totalsByCurrency = expenses.reduce((acc, e) => {
    acc[e.currency] = (acc[e.currency] ?? 0) + Number(e.amount);
    return acc;
  }, {});

  if (loading) {
    return (
      <div style={{ backgroundColor: COLORS.paper, minHeight: "100vh", fontFamily: FONTS.body }}>
        <Nav crumb="Case" />
        <div className="max-w-2xl mx-auto px-6 py-12">
          <p style={{ color: `${COLORS.ink}77` }} className="text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (error || !caseRow) {
    return (
      <div style={{ backgroundColor: COLORS.paper, minHeight: "100vh", fontFamily: FONTS.body }}>
        <Nav crumb="Case" />
        <div className="max-w-2xl mx-auto px-6 py-12">
          <div style={{ backgroundColor: `${COLORS.coral}12`, border: `1px solid ${COLORS.coral}44`, color: COLORS.ink }} className="rounded-xl px-4 py-3 text-sm">
            {error || "Case not found."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: COLORS.paper, minHeight: "100vh", fontFamily: FONTS.body }}>
      <Nav crumb="Case" />
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-baseline justify-between mb-1">
          <h1 style={{ fontFamily: FONTS.display, color: COLORS.ink }} className="text-3xl">{caseRow.title || "(untitled)"}</h1>
          <span style={{ color: COLORS.teal, fontFamily: FONTS.mono }} className="text-xs uppercase tracking-wide">{caseRow.status}</span>
        </div>
        <div style={{ color: `${COLORS.ink}77` }} className="text-xs mb-8">
          Opened {new Date(caseRow.created_at).toLocaleDateString()}
        </div>

        <Section icon={PawPrint} title="Case details">
          <div style={{ color: COLORS.ink }} className="text-sm space-y-2">
            <div><span style={{ color: `${COLORS.ink}77` }}>Species:</span> {caseRow.species || "—"}</div>
            {caseRow.location && (
              <div className="flex items-center gap-1.5"><MapPin size={13} color={`${COLORS.ink}77`} /> {caseRow.location}</div>
            )}
            <div><span style={{ color: `${COLORS.ink}77` }}>Jurisdiction:</span> {caseRow.jurisdiction}</div>
            {caseRow.description && (
              <p style={{ color: `${COLORS.ink}cc` }} className="pt-2 leading-relaxed">{caseRow.description}</p>
            )}
          </div>
        </Section>

        <Section icon={ScrollText} title="Legal references">
          {legalMatches.length === 0 ? (
            <p style={{ color: `${COLORS.ink}77` }} className="text-sm">No legal references matched to this case yet.</p>
          ) : (
            <div className="space-y-2">
              {legalMatches.map((m) => (
                <div key={m.id} style={{ border: `1px solid ${COLORS.line}` }} className="rounded-xl px-4 py-3">
                  <div style={{ color: COLORS.ink, fontFamily: FONTS.mono }} className="text-xs mb-0.5">{m.legal_references?.statute_code}</div>
                  <div style={{ color: COLORS.ink }} className="text-sm">{m.legal_references?.title}</div>
                  <div style={{ color: `${COLORS.ink}77` }} className="text-xs mt-1">
                    {m.confirmed_by ? "Confirmed" : "Suggested"} · {m.legal_references?.lawyer_reviewed ? "lawyer-reviewed" : "not yet lawyer-reviewed"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {caseRow.needs_vet_care && (
          <Section icon={Stethoscope} title="Vet care">
            {vetNotifications.length === 0 ? (
              <p style={{ color: `${COLORS.ink}77` }} className="text-sm">Flagged for vet care — not yet acknowledged by a vet.</p>
            ) : (
              <div className="space-y-2">
                {vetNotifications.map((n) => (
                  <div key={n.id} style={{ border: `1px solid ${COLORS.line}` }} className="rounded-xl px-4 py-3">
                    <div style={{ color: `${COLORS.ink}77` }} className="text-xs mb-1">
                      {new Date(n.notified_at).toLocaleDateString()}{n.acknowledged_at ? " · acknowledged" : ""}
                    </div>
                    <div style={{ color: COLORS.ink }} className="text-sm">{n.care_plan_text || "No care plan written yet."}</div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        <Section icon={DollarSign} title="Expenses">
          {Object.keys(totalsByCurrency).length > 0 && (
            <div className="flex gap-4 flex-wrap mb-4">
              {Object.entries(totalsByCurrency).map(([currency, total]) => (
                <span key={currency} style={{ fontFamily: FONTS.display, color: COLORS.ink }} className="text-xl">
                  {total.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-xs" style={{ fontFamily: FONTS.mono, color: `${COLORS.ink}77` }}>{currency}</span>
                </span>
              ))}
            </div>
          )}
          {expenses.length === 0 ? (
            <p style={{ color: `${COLORS.ink}77` }} className="text-sm">No expenses logged for this case yet.</p>
          ) : (
            <div className="space-y-2">
              {expenses.map((e) => (
                <div key={e.id} style={{ border: `1px solid ${COLORS.line}` }} className="rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div style={{ color: COLORS.ink }} className="text-sm">{e.description || e.category || "Expense"}</div>
                    <div style={{ color: `${COLORS.ink}77` }} className="text-xs">{new Date(e.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ fontFamily: FONTS.mono, color: COLORS.ink }} className="text-sm shrink-0">{Number(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {e.currency}</div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section icon={Heart} title="Donations">
          {donations.length === 0 ? (
            <p style={{ color: `${COLORS.ink}77` }} className="text-sm">No donations earmarked to this case yet.</p>
          ) : (
            <div className="space-y-2">
              {donations.map((d) => (
                <div key={d.id} style={{ border: `1px solid ${COLORS.line}` }} className="rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div style={{ color: COLORS.ink }} className="text-sm">{d.donors?.name || "Anonymous"}</div>
                    <div style={{ color: `${COLORS.ink}77` }} className="text-xs">{new Date(d.donated_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ fontFamily: FONTS.mono, color: COLORS.ink }} className="text-sm shrink-0">{Number(d.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {d.currency}</div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {caseRow.animal_id && transports.length > 0 && (
          <Section icon={Globe2} title="Cross-border transport">
            <div className="space-y-2">
              {transports.map((t) => (
                <div key={t.id} style={{ border: `1px solid ${COLORS.line}` }} className="rounded-xl px-4 py-3">
                  <div style={{ color: COLORS.ink, fontFamily: FONTS.mono }} className="text-xs uppercase tracking-wide mb-1">{t.status}</div>
                  <div style={{ color: `${COLORS.ink}cc` }} className="text-sm">
                    {t.destination_state ? `${t.destination_state}, ` : ""}{t.destination_country || "destination not set"}
                  </div>
                  {t.transport_date && (
                    <div style={{ color: `${COLORS.ink}77` }} className="text-xs mt-1">Transport date: {new Date(t.transport_date).toLocaleDateString()}</div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
