"use client";
import { useState, useEffect, useCallback } from "react";
import { Receipt, DollarSign } from "lucide-react";
import Nav from "../../components/Nav";
import Reveal from "../../components/Reveal";
import { COLORS, FONTS, inputStyle } from "../../lib/design-tokens";
import { supabase } from "../../lib/supabase-client";

// Internal admin-facing summary of a case's real costs — "the memory of
// every case and its expenses" the founder described, for reference when
// talking to donors/investors, not a donor-facing portal itself. No case
// detail page exists yet, so this uses its own case-selector pattern.
//
// Scope note: this shows case-level expense totals only. Whether a
// specific donor's contribution funded a specific case (donor earmarking)
// is a real, separate open question — donations.case_id already exists
// and could support that later, but that model isn't built here per the
// task's own instruction not to invent it in this pass.

export default function CaseExpensesPage() {
  const [cases, setCases] = useState([]);
  const [caseId, setCaseId] = useState("");
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingCase, setLoadingCase] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Supabase isn't configured."); setLoading(false); return; }
      const { data, error: err } = await supabase.from("cases").select("id, title, status").order("created_at", { ascending: false });
      if (err) { setError(err.message); setLoading(false); return; }
      setCases(data ?? []);
      setLoading(false);
    }
    init();
  }, []);

  const loadExpenses = useCallback(async (id) => {
    setLoadingCase(true);
    setError("");
    const { data, error: err } = await supabase
      .from("expenses").select("id, amount, currency, category, description, created_at")
      .eq("case_id", id).order("created_at", { ascending: false });
    if (err) { setError(err.message); setLoadingCase(false); return; }
    setExpenses(data ?? []);
    setLoadingCase(false);
  }, []);

  function selectCase(id) {
    setCaseId(id);
    if (id) loadExpenses(id); else setExpenses([]);
  }

  // Grouped by currency — this app doesn't do exchange-rate conversion
  // anywhere (same "store amount + currency code" convention as
  // /expenses itself), so a single blended total would be misleading.
  const totalsByCurrency = expenses.reduce((acc, e) => {
    acc[e.currency] = (acc[e.currency] ?? 0) + Number(e.amount);
    return acc;
  }, {});

  return (
    <div style={{ backgroundColor: COLORS.paper, minHeight: "100vh", fontFamily: FONTS.body }}>
      <Nav crumb="Case Expenses" />
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 style={{ fontFamily: FONTS.display, color: COLORS.ink }} className="text-3xl mb-2">Case expense ledger</h1>
        <p style={{ color: `${COLORS.ink}99` }} className="text-sm mb-8">
          Internal summary of real costs per case — for donor/investor reference, not a public-facing report.
        </p>

        {error && (
          <div style={{ backgroundColor: `${COLORS.coral}12`, border: `1px solid ${COLORS.coral}44`, color: COLORS.ink }} className="rounded-xl px-4 py-3 mb-6 text-sm">{error}</div>
        )}

        <div className="mb-6">
          <label style={{ color: COLORS.ink, fontFamily: FONTS.mono }} className="block text-xs tracking-wide uppercase mb-1.5 opacity-70">Case</label>
          <select value={caseId} onChange={(e) => selectCase(e.target.value)} style={inputStyle} className="w-full rounded-xl px-4 py-3 text-sm outline-none" disabled={loading}>
            <option value="">{loading ? "Loading cases…" : cases.length ? "Select a case…" : "No cases yet"}</option>
            {cases.map((c) => <option key={c.id} value={c.id}>{c.title || "(untitled)"} · {c.status}</option>)}
          </select>
        </div>

        {caseId && loadingCase && <p style={{ color: `${COLORS.ink}77` }} className="text-sm">Loading expenses…</p>}

        {caseId && !loadingCase && (
          <>
            <div style={{ backgroundColor: COLORS.nightDeep }} className="rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign size={15} color={COLORS.marigold} />
                <span style={{ color: COLORS.paper, fontFamily: FONTS.mono }} className="text-xs uppercase tracking-wide">Total expenses</span>
              </div>
              {Object.keys(totalsByCurrency).length === 0 ? (
                <span style={{ color: `${COLORS.paper}99` }} className="text-sm">No expenses logged for this case yet.</span>
              ) : (
                <div className="flex gap-4 flex-wrap">
                  {Object.entries(totalsByCurrency).map(([currency, total]) => (
                    <span key={currency} style={{ fontFamily: FONTS.display, color: COLORS.paper }} className="text-2xl">
                      {total.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-sm" style={{ fontFamily: FONTS.mono, color: `${COLORS.paper}88` }}>{currency}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ color: COLORS.ink, fontFamily: FONTS.mono }} className="text-xs uppercase tracking-wide mb-3">Line items</div>
            <div className="space-y-2">
              {expenses.map((e, i) => (
                <Reveal key={e.id} delay={Math.min(i, 5) * 0.03}>
                  <div style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${COLORS.line}` }} className="rounded-xl px-4 py-3 flex items-center gap-3">
                    <Receipt size={14} color={COLORS.teal} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div style={{ color: COLORS.ink }} className="text-sm">{e.description || e.category || "Expense"}</div>
                      <div style={{ color: `${COLORS.ink}77` }} className="text-xs">{e.category && e.description ? e.category + " · " : ""}{new Date(e.created_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{ fontFamily: FONTS.mono, color: COLORS.ink }} className="text-sm shrink-0">{Number(e.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {e.currency}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
