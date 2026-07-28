"use client";
import { useState, useEffect, useCallback } from "react";
import { DollarSign } from "lucide-react";
import Nav from "../../components/Nav";
import Reveal from "../../components/Reveal";
import { useAppTheme } from "../../lib/theme-context";
import { supabase } from "../../lib/supabase-client";

function Field({ label, children }) {
  const { COLORS, FONTS } = useAppTheme();
  return (
    <div className="mb-4">
      <label style={{ color: COLORS.ink, fontFamily: FONTS.mono }} className="block text-xs tracking-wide uppercase mb-2 opacity-70">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function ExpensesPage() {
  const { COLORS, FONTS, inputStyle } = useAppTheme();
  const [orgId, setOrgId] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    amount: "", currency: "MXN", category: "", caseId: "", description: "",
  });

  const loadExpenses = useCallback(async (org) => {
    const { data, error: err } = await supabase
      .from("expenses")
      .select("id, amount, currency, category, description, case_id, created_at")
      .eq("org_id", org)
      .order("created_at", { ascending: false });
    if (err) { setError(err.message); return; }
    setExpenses(data ?? []);
  }, []);

  useEffect(() => {
    async function init() {
      if (!supabase) { setError("Supabase isn't configured."); setLoading(false); return; }
      const { data: memberships, error: memErr } = await supabase
        .from("memberships")
        .select("org_id")
        .eq("status", "active")
        .limit(1);
      if (memErr || !memberships?.length) {
        setError("Couldn't find an active org membership for this account.");
        setLoading(false);
        return;
      }
      const org = memberships[0].org_id;
      setOrgId(org);
      await loadExpenses(org);
      const { data: caseRows } = await supabase.from("cases").select("id, title").eq("org_id", org).order("title");
      setCases(caseRows ?? []);
      setLoading(false);
    }
    init();
  }, [loadExpenses]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.amount) return;

    const { data: personId, error: personErr } = await supabase.rpc("my_person_id");
    if (personErr) { setError(personErr.message); return; }

    const { error: err } = await supabase.from("expenses").insert({
      org_id: orgId,
      amount: Number(form.amount),
      currency: form.currency,
      category: form.category || null,
      case_id: form.caseId || null,
      description: form.description || null,
      logged_by: personId,
    });
    if (err) { setError(err.message); return; }

    setForm({ amount: "", currency: "MXN", category: "", caseId: "", description: "" });
    loadExpenses(orgId);
  }

  return (
    <div style={{ backgroundColor: COLORS.paper, minHeight: "100vh", fontFamily: FONTS.body }}>
      <Nav crumb="Expenses" />

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 style={{ fontFamily: FONTS.display, color: COLORS.ink }} className="text-3xl mb-2">Expenses</h1>
        <p style={{ color: `${COLORS.ink}99` }} className="text-sm mb-8">
          Categorized expense logging, optionally linked to a case.
        </p>

        {error && (
          <div style={{ backgroundColor: `${COLORS.coral}12`, border: `1px solid ${COLORS.coral}44`, color: COLORS.ink }} className="rounded-xl px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${COLORS.line}` }} className="rounded-2xl p-5 mb-10">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Amount">
              <input required type="number" step="0.01" min="0" style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Field label="Currency">
              <select style={{ ...inputStyle }} className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </Field>
            <Field label="Category">
              <input style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                placeholder="medical, food..." value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </Field>
          </div>

          <Field label="Linked case (optional)">
            <select style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              value={form.caseId} onChange={(e) => setForm({ ...form, caseId: e.target.value })}>
              <option value="">No specific case</option>
              {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </Field>

          <Field label="Note">
            <input style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>

          <button type="submit" style={{ backgroundColor: COLORS.coral, color: "#FFFFFF" }} className="rounded-full px-6 py-2.5 text-sm font-medium">
            Log expense
          </button>
        </form>

        {loading ? (
          <p style={{ color: `${COLORS.ink}77` }} className="text-sm">Loading…</p>
        ) : expenses.length === 0 ? (
          <p style={{ color: `${COLORS.ink}77` }} className="text-sm">No expenses logged yet.</p>
        ) : (
          <div className="space-y-2">
            {expenses.map((ex, i) => (
              <Reveal key={ex.id} delay={Math.min(i, 5) * 0.03}>
                <div style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${COLORS.line}` }} className="rounded-xl px-4 py-3 flex items-center gap-3">
                  <div style={{ backgroundColor: `${COLORS.coral}18` }} className="h-9 w-9 rounded-full flex items-center justify-center shrink-0">
                    <DollarSign size={14} color={COLORS.coral} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ color: COLORS.ink }} className="text-sm font-medium">
                      {ex.description || "(no note)"}
                      {ex.category && <span style={{ color: `${COLORS.ink}66` }} className="font-normal capitalize"> · {ex.category}</span>}
                    </div>
                    <div style={{ color: `${COLORS.ink}77` }} className="text-xs">
                      {new Date(ex.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ fontFamily: FONTS.mono, color: COLORS.ink }} className="text-sm shrink-0">
                    {ex.amount.toLocaleString()} {ex.currency}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
