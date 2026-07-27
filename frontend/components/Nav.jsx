import React from "react";
import Link from "next/link";
import { PawPrint, ChevronRight } from "lucide-react";
import { COLORS, FONTS } from "../lib/design-tokens";
import LogoutButton from "./LogoutButton";
import NavMenu from "./NavMenu";

// Every screen had its own slightly-different copy of this nav bar.
// One real bug that copy-paste caused: the Vet Care screen's breadcrumb
// said "Vet care · Wet Noses" while Case Intake said "New case · Wet Noses"
// — fine individually, but as soon as there's real navigation between
// screens, four independent copies drift out of sync. This is the fix.

export default function Nav({ crumb, orgName = "Wet Noses" }) {
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
          {crumb} · {orgName}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-4 shrink-0">
        <NavMenu />
        <LogoutButton />
      </div>
    </div>
  );
}
