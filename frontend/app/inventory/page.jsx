"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ArrowDownCircle, ArrowUpCircle, Package } from "lucide-react";
import Nav from "../../components/Nav";
import Reveal from "../../components/Reveal";
import { COLORS, FONTS, inputStyle } from "../../lib/design-tokens";
import { supabase } from "../../lib/supabase-client";

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

export default function InventoryPage() {
  const [orgId, setOrgId] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", category: "", unit: "", quantity: "0" });

  const [movementItemId, setMovementItemId] = useState("");
  const [movementDirection, setMovementDirection] = useState("in");
  const [movementQty, setMovementQty] = useState("");
  const [movementNote, setMovementNote] = useState("");

  const loadItems = useCallback(async (org) => {
    const { data, error: err } = await supabase
      .from("inventory_items")
      .select("id, name, category, quantity, unit, reorder_threshold")
      .eq("org_id", org)
      .order("name");
    if (err) { setError(err.message); return; }
    setItems(data ?? []);
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
      await loadItems(org);
      setLoading(false);
    }
    init();
  }, [loadItems]);

  async function handleAddItem(e) {
    e.preventDefault();
    setError("");
    const { error: err } = await supabase.from("inventory_items").insert({
      org_id: orgId,
      name: newItem.name,
      category: newItem.category || null,
      unit: newItem.unit || null,
      quantity: Number(newItem.quantity) || 0,
    });
    if (err) { setError(err.message); return; }
    setNewItem({ name: "", category: "", unit: "", quantity: "0" });
    setShowAddItem(false);
    loadItems(orgId);
  }

  async function handleLogMovement(e) {
    e.preventDefault();
    setError("");
    if (!movementItemId || !movementQty) return;
    const { error: err } = await supabase.rpc("log_inventory_movement", {
      p_item_id: movementItemId,
      p_direction: movementDirection,
      p_quantity: Number(movementQty),
      p_note: movementNote || null,
    });
    if (err) { setError(err.message); return; }
    setMovementQty("");
    setMovementNote("");
    loadItems(orgId);
  }

  return (
    <div style={{ backgroundColor: COLORS.paper, minHeight: "100vh", fontFamily: FONTS.body }}>
      <Nav crumb="Inventory" />

      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-baseline justify-between mb-2">
          <h1 style={{ fontFamily: FONTS.display, color: COLORS.ink }} className="text-3xl">Inventory</h1>
          <button
            onClick={() => setShowAddItem(!showAddItem)}
            style={{ color: COLORS.teal }}
            className="text-xs flex items-center gap-1 font-medium"
          >
            <Plus size={14} /> New item
          </button>
        </div>
        <p style={{ color: `${COLORS.ink}99` }} className="text-sm mb-8">
          Current stock, and a log of every addition and use.
        </p>

        {error && (
          <div style={{ backgroundColor: `${COLORS.coral}12`, border: `1px solid ${COLORS.coral}44`, color: COLORS.ink }} className="rounded-xl px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        <AnimatePresence>
          {showAddItem && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleAddItem}
              style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${COLORS.line}` }}
              className="rounded-2xl p-5 mb-8 overflow-hidden"
            >
              <Field label="Name">
                <input required style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Category">
                  <input style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    placeholder="medical, food..." value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} />
                </Field>
                <Field label="Unit">
                  <input style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    placeholder="bags, boxes..." value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} />
                </Field>
                <Field label="Starting qty">
                  <input type="number" step="any" style={inputStyle} className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} />
                </Field>
              </div>
              <button type="submit" style={{ backgroundColor: COLORS.teal, color: "#FFFFFF" }} className="rounded-full px-5 py-2 text-sm font-medium mt-2">
                Add item
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {loading ? (
          <p style={{ color: `${COLORS.ink}77` }} className="text-sm">Loading…</p>
        ) : items.length === 0 ? (
          <p style={{ color: `${COLORS.ink}77` }} className="text-sm mb-8">No items yet — add one above.</p>
        ) : (
          <div className="space-y-2 mb-10">
            {items.map((it, i) => (
              <Reveal key={it.id} delay={Math.min(i, 5) * 0.03}>
                <div style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${COLORS.line}` }} className="rounded-xl px-4 py-3 flex items-center gap-3">
                  <div style={{ backgroundColor: `${COLORS.teal}18` }} className="h-9 w-9 rounded-full flex items-center justify-center shrink-0">
                    <Package size={14} color={COLORS.teal} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ color: COLORS.ink }} className="text-sm font-medium">{it.name}</div>
                    <div style={{ color: `${COLORS.ink}77` }} className="text-xs">
                      {it.category && <span className="capitalize">{it.category} · </span>}
                      {it.quantity} {it.unit || ""}
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        )}

        <div style={{ backgroundColor: COLORS.nightDeep }} className="rounded-2xl p-6">
          <div style={{ color: COLORS.paper, fontFamily: FONTS.mono }} className="text-xs uppercase tracking-wide mb-4">
            Log a movement
          </div>
          <form onSubmit={handleLogMovement} className="space-y-3">
            <select
              required
              value={movementItemId}
              onChange={(e) => setMovementItemId(e.target.value)}
              style={{ backgroundColor: "#FFFFFF", color: COLORS.ink }}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            >
              <option value="">Select item…</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>{it.name} ({it.quantity} {it.unit || ""})</option>
              ))}
            </select>

            <div className="flex gap-2">
              <button type="button" onClick={() => setMovementDirection("in")}
                style={{
                  backgroundColor: movementDirection === "in" ? COLORS.teal : "transparent",
                  border: `1.5px solid ${COLORS.teal}`,
                  color: movementDirection === "in" ? "#FFFFFF" : COLORS.teal,
                }}
                className="flex-1 rounded-full py-2 text-sm flex items-center justify-center gap-1.5">
                <ArrowDownCircle size={14} /> Add stock
              </button>
              <button type="button" onClick={() => setMovementDirection("out")}
                style={{
                  backgroundColor: movementDirection === "out" ? COLORS.coral : "transparent",
                  border: `1.5px solid ${COLORS.coral}`,
                  color: movementDirection === "out" ? "#FFFFFF" : COLORS.coral,
                }}
                className="flex-1 rounded-full py-2 text-sm flex items-center justify-center gap-1.5">
                <ArrowUpCircle size={14} /> Use stock
              </button>
            </div>

            <input required type="number" step="any" min="0" placeholder="Quantity"
              value={movementQty} onChange={(e) => setMovementQty(e.target.value)}
              style={{ backgroundColor: "#FFFFFF", color: COLORS.ink }}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none" />

            <input placeholder="Note (optional)"
              value={movementNote} onChange={(e) => setMovementNote(e.target.value)}
              style={{ backgroundColor: "#FFFFFF", color: COLORS.ink }}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none" />

            <button type="submit" style={{ backgroundColor: COLORS.marigold, color: COLORS.nightDeep }} className="w-full rounded-full py-3 font-medium text-sm">
              Log movement
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
