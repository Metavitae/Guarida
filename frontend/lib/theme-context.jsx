"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase-client";
import { COLORS as DEFAULT_APP_COLORS, FONTS as DEFAULT_APP_FONTS, FONT_IMPORT as DEFAULT_APP_FONT_IMPORT, inputStyle as DEFAULT_INPUT_STYLE } from "./design-tokens";
import { COLORS as DEFAULT_LANDING_COLORS, FONTS as DEFAULT_LANDING_FONTS, FONT_IMPORT as DEFAULT_LANDING_FONT_IMPORT } from "./landing-tokens";

// Per-org theming (2026-07-28): design-tokens.js / landing-tokens.js used
// to be the only source of truth - Wet Noses' colors/fonts hardcoded as
// plain JS constants, imported statically by every screen. That's fine
// for exactly one tenant; it's not "structurally swappable" the way the
// founder asked for.
//
// This context resolves an org's own theme (see
// docs/multi-org-theming-schema.md's organization_theme table) at runtime
// and merges it over the defaults above - Wet Noses' current look IS the
// default, unchanged, until an organization_theme row exists for them (or
// for anyone else). COLORS/FONTS/inputStyle keep exactly the same shape
// (plain hex-string objects) they always were - every existing
// `${COLORS.ink}77`-style alpha-suffix usage across the app keeps working
// untouched, since only WHERE the values come from changes, not their
// type. CSS custom properties were considered and rejected: 200+ call
// sites already concatenate a hex alpha suffix directly onto COLORS.x,
// which a var(...) string can't support without a much larger rewrite of
// every one of those call sites.
//
// organization_theme's own RLS policy is `is_active_member(org_id)` (the
// same security-definer helper every other org-scoped table already uses
// safely) - not a raw join like the still-broken `people`/`organizations`
// policies - so this is a normal, safe direct client-side select, no
// my_org()-style sidestep needed. Because the policy filters by org_id
// implicitly, selecting with no explicit .eq("org_id", ...) naturally
// returns only the caller's own org's row (or none, for logged-out
// visitors on public pages - which correctly falls back to the defaults).

const ThemeContext = createContext(null);

function deepMerge(base, override) {
  if (!override) return base;
  const out = { ...base };
  for (const key of Object.keys(override)) {
    out[key] = override[key] ?? base[key];
  }
  return out;
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(null); // null until resolved (or confirmed absent)

  useEffect(() => {
    if (!supabase) { setTheme({}); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("organization_theme").select("colors, fonts, copy").maybeSingle();
      if (!cancelled) setTheme(data || {});
    })();
    return () => { cancelled = true; };
  }, []);

  const resolved = theme || {};
  const value = {
    app: {
      COLORS: deepMerge(DEFAULT_APP_COLORS, resolved.colors?.app),
      FONTS: deepMerge(DEFAULT_APP_FONTS, resolved.fonts?.app),
      FONT_IMPORT: DEFAULT_APP_FONT_IMPORT,
    },
    landing: {
      COLORS: deepMerge(DEFAULT_LANDING_COLORS, resolved.colors?.landing),
      FONTS: deepMerge(DEFAULT_LANDING_FONTS, resolved.fonts?.landing),
      FONT_IMPORT: DEFAULT_LANDING_FONT_IMPORT,
    },
    copy: resolved.copy || {},
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // No <ThemeProvider> ancestor (shouldn't happen - it's mounted once in
    // app/layout.jsx) - fall back to defaults rather than crash the page.
    return {
      app: { COLORS: DEFAULT_APP_COLORS, FONTS: DEFAULT_APP_FONTS, FONT_IMPORT: DEFAULT_APP_FONT_IMPORT },
      landing: { COLORS: DEFAULT_LANDING_COLORS, FONTS: DEFAULT_LANDING_FONTS, FONT_IMPORT: DEFAULT_LANDING_FONT_IMPORT },
      copy: {},
    };
  }
  return ctx;
}

// Used by the internal worker app (case-intake, donors, vet-care, etc).
export function useAppTheme() {
  const { app } = useThemeContext();
  return { COLORS: app.COLORS, FONTS: app.FONTS, FONT_IMPORT: app.FONT_IMPORT, inputStyle: { ...DEFAULT_INPUT_STYLE, border: `1.5px solid ${app.COLORS.line}`, color: app.COLORS.ink, fontFamily: app.FONTS.body } };
}

// Used by the public landing page (Hero, Footer, CaseJourney, StatsBand).
export function useLandingTheme() {
  const { landing } = useThemeContext();
  return landing;
}

// Org-specific copy (hero tagline, footer org name, login subtitle, etc) -
// see docs/multi-org-theming-schema.md for the known key list. Falls back
// to Wet Noses' current hardcoded copy per-key, not as an all-or-nothing
// block, so a theme row that only overrides some keys still works.
export function useOrgCopy(defaults) {
  const { copy } = useThemeContext();
  return { ...defaults, ...copy };
}
