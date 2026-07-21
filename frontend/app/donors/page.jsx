"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Home, TrendingUp, DollarSign, Circle, PawPrint } from "lucide-react";
import Nav from "../../components/Nav";
import { COLORS, FONTS, FONT_IMPORT } from "../../lib/design-tokens";

// Still demo-only: local state + hardcoded sample data, not wired to
// Supabase. That's a separate future task (per the standing instruction
// not to wire this pass to the real database).
const donors = [
  { name: "Jane Whitfield", stage: "active", total: 4200, currency: "MXN", lastGift: "3 days ago" },
  { name: "Ricardo Almanza", stage: "active", total: 12500, currency: "MXN", lastGift: "1 week ago" },
  { name: "Coastal Paws Foundation", stage: "active", total: 38000, currency: "MXN", lastGift: "2 weeks ago" },
  { name: "Laura Kim", stage: "contacted", total: 0, currency: "MXN", lastGift: "—" },
  { name: "Marcos Villanueva", stage: "prospect", total: 0, currency: "MXN", lastGift: "—" },
];

const fosters = [
  { animal: "Luna", species: "dog", foster: "Ana Ruiz", since: "Jun 14", status: "active" },
  { animal: "Pinto", species: "dog", foster: "The Hendersons", since: "May 28", status: "active" },
  { animal: "Café", species: "cat", foster: "Maria Lopez", since: "Jun 2", status: "active" },
  { animal: "Sunny", species: "wildlife", foster: "—", since: "—", status: "needs placement" },
];

const stageColor = { active: COLORS.green, contacted: COLORS.marigold, prospect: `${COLORS.ink}55` };

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${COLORS.line}` }} className="rounded-2xl p-5 flex-1">
      <div style={{ backgroundColor: `${color}18`, color }} className="h-9 w-9 rounded-xl flex items-center justify-center mb-4">
        <Icon size={16} strokeWidth={2} />
      </div>
      <div style={{ fontFamily: FONTS.display, color: COLORS.ink }} className="text-2xl mb-1">
        {value}
      </div>
      <div style={{ color: `${COLORS.ink}88` }} className="text-xs">
        {label} {sub && <span style={{ color }}>· {sub}</span>}
      </div>
    </div>
  );
}

export default function DonorsPage() {
  const [tab, setTab] = useState("donors");

  return (
    <div style={{ backgroundColor: COLORS.paper, minHeight: "100vh", fontFamily: FONTS.body }}>
      <style>{FONT_IMPORT}</style>
      <Nav crumb="Community" />

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 style={{ fontFamily: FONTS.display, color: COLORS.ink }} className="text-3xl mb-8">
          Community
        </h1>

        <div className="flex gap-4 mb-10">
          <StatCard icon={DollarSign} label="raised this month" value="$54,700" sub="MXN" color={COLORS.coral} />
          <StatCard icon={Home} label="animals in foster care" value="3" sub="1 needs placement" color={COLORS.marigold} />
          <StatCard icon={TrendingUp} label="active donors" value="3" sub="+1 this week" color={COLORS.green} />
        </div>

        <div className="flex gap-1 mb-6" style={{ borderBottom: `1.5px solid ${COLORS.line}` }}>
          {["donors", "fosters"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                color: tab === t ? COLORS.coral : `${COLORS.ink}77`,
                borderBottom: tab === t ? `2px solid ${COLORS.coral}` : "2px solid transparent",
              }}
              className="px-4 py-3 text-sm font-medium capitalize -mb-px transition-colors"
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "donors" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {donors.map((d) => (
              <div
                key={d.name}
                style={{ backgroundColor: "#FFFFFF", border: `1.5px solid ${COLORS.line}` }}
                className="rounded-xl px-5 py-4 flex items-center gap-4"
              >
                <div style={{ backgroundColor: `${stageColor[d.stage]}18` }} className="h-9 w-9 rounded-full flex items-center justify-center shrink-0">
                  <Heart size={14} color={stageColor[d.stage]} />
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ color: COLORS.ink }} className="text-sm font-medium">{d.name}</div>
                  <div style={{ color: `${COLORS.ink}77` }} className="text-xs flex items-center gap-1.5">
                    <Circle size={6} fill={stageColor[d.stage]} color={stageColor[d.stage]} />
                    <span className="capitalize">{d.stage}</span>
                    {d.lastGift !== "—" && <span>· last gift {d.lastGift}</span>}
                  </div>
                </div>
                {d.total > 0 && (
                  <div style={{ fontFamily: FONTS.mono, color: COLORS.ink }} className="text-sm shrink-0">
                    ${d.total.toLocaleString()} {d.currency}
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        )}

        {tab === "fosters" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {fosters.map((f) => (
              <div
                key={f.animal}
                style={{
                  backgroundColor: "#FFFFFF",
                  border: `1.5px solid ${f.status === "needs placement" ? COLORS.coral : COLORS.line}`,
                }}
                className="rounded-xl px-5 py-4 flex items-center gap-4"
              >
                <div style={{ backgroundColor: `${COLORS.teal}18` }} className="h-9 w-9 rounded-full flex items-center justify-center shrink-0">
                  <PawPrint size={14} color={COLORS.teal} />
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ color: COLORS.ink }} className="text-sm font-medium">
                    {f.animal} <span style={{ color: `${COLORS.ink}66` }} className="font-normal capitalize">· {f.species}</span>
                  </div>
                  <div style={{ color: `${COLORS.ink}77` }} className="text-xs">
                    {f.status === "needs placement" ? (
                      <span style={{ color: COLORS.coral }}>Needs a foster placement</span>
                    ) : (
                      <>with {f.foster} · since {f.since}</>
                    )}
                  </div>
                </div>
                {f.status === "needs placement" && (
                  <button
                    style={{ backgroundColor: COLORS.coral, color: "#FFFFFF" }}
                    className="text-xs px-3 py-2 rounded-full shrink-0 font-medium"
                  >
                    Assign
                  </button>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
