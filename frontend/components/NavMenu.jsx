"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { COLORS, FONTS } from "../lib/design-tokens";
import { supabase } from "../lib/supabase-client";

const WORKER_LINKS = [
  { href: "/case-intake", label: "Case Intake" },
  { href: "/vet-care", label: "Vet Care" },
  { href: "/fosters", label: "Fosters" },
  { href: "/cross-border", label: "Cross-Border" },
  { href: "/inventory", label: "Inventory" },
  { href: "/expenses", label: "Expenses" },
  { href: "/case-expenses", label: "Case Expenses" },
];

const ADMIN_STAFF_LINKS = [
  { href: "/donors", label: "Donors" },
  { href: "/prospects", label: "Prospects" },
];

const LEGAL_LINKS = [{ href: "/legal-review", label: "Legal Review" }];

const PUBLIC_LINKS = [
  { href: "/emergency", label: "Emergency Numbers" },
  { href: "/report-guide", label: "Report Guide" },
];

// Link visibility mirrors middleware.js's route gating exactly (worker /
// adminStaff / legal flags map 1:1 to is_active_worker / is_admin_or_staff
// / can_review_legal) so nobody ever sees a link to a page they'd just get
// redirected away from. Logged-out visitors (possible here since this
// component also renders on the public /emergency and /report-guide pages)
// see only the public links plus a sign-in link.
export default function NavMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [access, setAccess] = useState({
    loading: true,
    loggedIn: false,
    worker: false,
    adminStaff: false,
    legal: false,
  });

  useEffect(() => {
    let cancelled = false;
    async function loadAccess() {
      if (!supabase) {
        if (!cancelled) setAccess({ loading: false, loggedIn: false, worker: false, adminStaff: false, legal: false });
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setAccess({ loading: false, loggedIn: false, worker: false, adminStaff: false, legal: false });
        return;
      }
      const [{ data: worker }, { data: adminStaff }, { data: legal }] = await Promise.all([
        supabase.rpc("is_active_worker"),
        supabase.rpc("is_admin_or_staff"),
        supabase.rpc("can_review_legal"),
      ]);
      if (!cancelled) setAccess({ loading: false, loggedIn: true, worker: !!worker, adminStaff: !!adminStaff, legal: !!legal });
    }
    loadAccess();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const links = [
    ...PUBLIC_LINKS,
    ...(access.worker ? WORKER_LINKS : []),
    ...(access.adminStaff ? ADMIN_STAFF_LINKS : []),
    ...(access.legal ? LEGAL_LINKS : []),
  ];

  return (
    <>
      {/* Desktop/tablet: inline top bar */}
      <nav className="hidden md:flex items-center gap-5">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{ color: pathname === link.href ? COLORS.marigold : `${COLORS.paper}bb`, fontFamily: FONTS.body }}
            className="text-xs font-medium whitespace-nowrap hover:opacity-80"
          >
            {link.label}
          </Link>
        ))}
        {!access.loading && !access.loggedIn && (
          <Link
            href="/login"
            style={{ color: `${COLORS.paper}bb`, fontFamily: FONTS.body }}
            className="text-xs font-medium whitespace-nowrap hover:opacity-80"
          >
            Worker sign-in
          </Link>
        )}
      </nav>

      {/* Mobile: hamburger trigger */}
      <button onClick={() => setOpen(true)} aria-label="Open menu" style={{ color: COLORS.paper }} className="md:hidden p-1">
        <Menu size={20} />
      </button>

      {/* Mobile: slide-out drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              style={{ backgroundColor: "#00000066" }}
              className="fixed inset-0 z-40 md:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              style={{ backgroundColor: COLORS.night }}
              className="fixed top-0 right-0 bottom-0 w-72 z-50 px-6 py-5 md:hidden flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <span style={{ fontFamily: FONTS.display, color: COLORS.paper }} className="text-lg">
                  Menu
                </span>
                <button onClick={() => setOpen(false)} aria-label="Close menu" style={{ color: COLORS.paper }}>
                  <X size={20} />
                </button>
              </div>
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  style={{
                    color: pathname === link.href ? COLORS.marigold : COLORS.paper,
                    fontFamily: FONTS.body,
                    borderBottom: `1px solid ${COLORS.paper}1a`,
                  }}
                  className="text-sm py-3"
                >
                  {link.label}
                </Link>
              ))}
              {!access.loading && !access.loggedIn && (
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  style={{ color: COLORS.marigold, fontFamily: FONTS.body }}
                  className="text-sm py-3"
                >
                  Worker sign-in
                </Link>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
