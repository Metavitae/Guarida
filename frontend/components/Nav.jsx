"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { PawPrint, ChevronRight } from "lucide-react";
import { useAppTheme } from "../lib/theme-context";
import { supabase } from "../lib/supabase-client";
import LogoutButton from "./LogoutButton";
import NavMenu from "./NavMenu";

// Every screen had its own slightly-different copy of this nav bar.
// One real bug that copy-paste caused: the Vet Care screen's breadcrumb
// said "Vet care · Wet Noses" while Case Intake said "New case · Wet Noses"
// — fine individually, but as soon as there's real navigation between
// screens, four independent copies drift out of sync. This is the fix.
//
// `orgName` used to default to the literal "Wet Noses" - every one of the
// 14 call sites across the app omitted the prop, so every tenant would
// have seen Wet Noses' name in their own breadcrumb. Now resolved live
// per logged-in user via my_org() (see docs/multi-tenant-audit-schema.md),
// same recursive-RLS-on-`people` sidestep case-intake uses. On public
// pages (no session) this just falls back to no org suffix, which is
// correct - there's no tenant to attribute the crumb to.

export default function Nav({ crumb, orgName }) {
  const { COLORS, FONTS } = useAppTheme();
  const [resolvedOrgName, setResolvedOrgName] = useState(orgName || null);

  useEffect(() => {
    if (orgName || !supabase) return;
    let cancelled = false;
    (async () => {
      const { data: orgRow } = await supabase.rpc("my_org").maybeSingle();
      if (!cancelled && orgRow?.name) setResolvedOrgName(orgRow.name);
    })();
    return () => { cancelled = true; };
  }, [orgName]);

  return (
    <div style={{ backgroundColor: COLORS.night }} className="px-6 md:px-12 py-5 flex items-center gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <PawPrint size={18} color={COLORS.marigold} />
          <span style={{ fontFamily: FONTS.display, color: COLORS.paper }} className="text-lg">
            Guarida
          </span>
        </Link>
        <ChevronRight size={14} color={`${COLORS.paper}66`} className="shrink-0" />
        <span
          style={{ color: `${COLORS.paper}99`, fontFamily: FONTS.mono }}
          className="text-xs uppercase tracking-wide truncate"
        >
          {crumb}{resolvedOrgName ? ` · ${resolvedOrgName}` : ""}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-4 shrink-0">
        <NavMenu />
        <LogoutButton />
      </div>
    </div>
  );
}
