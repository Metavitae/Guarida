# Multi-org branding/theming — schema

Spec for "Guarida - Direct Instructions for CC (2026-07-28, v3)" item 3
(per-organization branding/theming). Written for the founder to run in
Supabase's SQL Editor — CC has no DDL access, same as every other schema
change here.

## `organization_theme`

```sql
create table organization_theme (
  org_id uuid primary key references organizations(id) on delete cascade,
  colors jsonb not null default '{}'::jsonb,
  fonts jsonb not null default '{}'::jsonb,
  copy jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table organization_theme enable row level security;

create policy "org members can view their org's theme"
  on organization_theme for select
  using (is_active_member(org_id));

create policy "admin can insert their org's theme"
  on organization_theme for insert
  with check (is_admin() and is_active_member(org_id));

create policy "admin can update their org's theme"
  on organization_theme for update
  using (is_admin() and is_active_member(org_id))
  with check (is_admin() and is_active_member(org_id));

create policy "legal_reviewer excluded from organization_theme"
  on organization_theme as restrictive for all
  using (not is_legal_reviewer())
  with check (not is_legal_reviewer());
```

Any active member can read a theme (everyone sees the app in their org's
colors); only admins can set one - a branding decision, same tier as
other admin-only writes elsewhere in this app.

## Why the CSS-variable approach the task suggested doesn't fit here

The founder's instruction offered two options: "Apply via CSS variables
or a theme provider." CSS custom properties were tried first and
rejected once the actual codebase was checked, not assumed: **187
places** across the app already write things like
`` `${COLORS.ink}77` `` - concatenating a hex alpha suffix directly onto
a color value inline. If `COLORS.ink` became a CSS var string like
`"var(--gd-ink, #1C2B2E)"`, that concatenation would produce
`"var(--gd-ink, #1C2B2E)77"` - not a valid CSS color, breaking all 187
call sites. Rewriting all of them to a `color-mix()`-based alpha helper
would be a much larger, separate, higher-risk refactor than this task
asked for.

Went with the second option instead: a React theme-provider
(`frontend/lib/theme-context.jsx`) that resolves `organization_theme` at
runtime and exposes `COLORS`/`FONTS` as plain hex-string objects, exactly
the same shape they've always been - every existing alpha-suffix call
site keeps working completely untouched, since only *where* the values
come from changed (a hook call instead of a static import), not their
type or shape.

## Shape of `colors` / `fonts` / `copy`

Two namespaces inside each - `app` (the internal worker screens' palette:
deep ocean-night teal / bougainvillea coral / marigold sand) and
`landing` (the public site's separate, deliberately different palette) -
since `design-tokens.js` and `landing-tokens.js` have always been kept
apart on purpose. Any key can be omitted; omitted keys fall back to Wet
Noses' current hardcoded values (see `theme-context.jsx`'s `deepMerge`).

```json
{
  "colors": {
    "app": { "night": "#10262E", "nightDeep": "#0A1B21", "teal": "#1F5C6B", "coral": "#E8577A", "marigold": "#E8B95C", "paper": "#F3EDE0", "ink": "#1C2B2E", "line": "#E4DCC9", "green": "#7A9E7E" },
    "landing": { "deepTide": "#16332B", "seaGlass": "#E4EDE6", "bone": "#FAF7F0", "marigold": "#E8A33D", "clayRose": "#C97B6D", "charcoal": "#1F2420" }
  },
  "fonts": {
    "app": { "display": "'Fraunces', serif", "body": "'Inter', sans-serif", "mono": "'IBM Plex Mono', monospace" },
    "landing": { "display": "'Fraunces', serif", "body": "'Sora', sans-serif", "mono": "'IBM Plex Mono', monospace" }
  },
  "copy": {
    "heroEyebrow": "Wet Noses Rescue — Punta de Mita, Nayarit",
    "heroTagline": "Every case is a story.",
    "heroSubtitle": "Yours can change how it ends.",
    "heroBody": "Every animal that comes through Wet Noses has a real, specific path — from the moment they're found to the moment they're safe. Follow one below, then help write the next one.",
    "footerOrgName": "Wet Noses Rescue",
    "footerLocation": "Punta de Mita, Bahía de Banderas, Nayarit, México",
    "loginSubtitle": "For Wet Noses staff, admins, and vets only."
  }
}
```

Font *family* names are themeable; the actual `@import` that loads fonts
from Google Fonts (`FONT_IMPORT` in both token files) is not - swapping
in an arbitrary font family a tenant wants would also need to load it,
which is real scope (a font-loading strategy per tenant), not just a
settings value. Out of scope for this pass; flagged, not built.

## Migrating Wet Noses' current look

Once this table exists, CC will insert Wet Noses' own values above as
their theme row (their current hardcoded look, made explicit and
swappable, not changed) via the service-role key - a normal insert once
the schema exists, no further SQL needed.
