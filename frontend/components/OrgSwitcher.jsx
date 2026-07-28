"use client";
import { useState, useEffect } from "react";
import { supabase, getCurrentOrgId } from "../lib/supabase-client";
import { useAppTheme } from "../lib/theme-context";

// Only ever renders for someone active in 2+ orgs (see
// docs/multi-org-membership-schema.md) - for every single-org person,
// including 100% of Wet Noses' current workers, my_orgs() returns exactly
// one row and this renders nothing. Switching writes the gd_current_org_id
// cookie via /api/org/switch (which independently re-verifies the
// membership server-side, never trusts the client blindly) then reloads,
// so every RLS-backed query and role check on the page picks it up fresh.
export default function OrgSwitcher() {
  const { COLORS, FONTS } = useAppTheme();
  const [orgs, setOrgs] = useState(null);
  const [currentOrgId, setCurrentOrgId] = useState(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("my_orgs");
      const current = await getCurrentOrgId(supabase);
      if (!cancelled) {
        setOrgs(data || []);
        setCurrentOrgId(current);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleChange(e) {
    const orgId = e.target.value;
    setSwitching(true);
    const res = await fetch("/api/org/switch", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgId }),
    });
    if (res.ok) {
      window.location.reload();
    } else {
      setSwitching(false);
    }
  }

  if (!orgs || orgs.length < 2) return null;

  return (
    <select
      value={currentOrgId || ""}
      onChange={handleChange}
      disabled={switching}
      style={{ backgroundColor: "transparent", color: `${COLORS.paper}bb`, fontFamily: FONTS.body, border: `1px solid ${COLORS.paper}33` }}
      className="text-xs rounded-full px-2 py-1 outline-none"
    >
      {orgs.map((o) => (
        <option key={o.org_id} value={o.org_id} style={{ color: COLORS.ink }}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
