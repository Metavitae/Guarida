"use client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { supabase } from "../lib/supabase-client";
import { COLORS } from "../lib/design-tokens";

// Small client component so Nav.jsx itself can stay a server component
// except for this one interactive piece.
export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      style={{ color: `${COLORS.paper}99` }}
      className="ml-auto text-xs flex items-center gap-1.5 hover:opacity-80"
    >
      <LogOut size={13} /> Log out
    </button>
  );
}
