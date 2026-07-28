# Tenant-scoping audit — 2026-07-28

CC Report — response to "Guarida - Direct Instructions for CC (2026-07-28,
v2 — supersedes the WhatsApp-only version)."

**STATUS:** Audit complete across all 6 areas. Fixed what was safe to fix
without a schema change the founder hadn't yet approved; flagged the rest
with a concrete recommendation rather than deciding unilaterally. The one
schema change needed (`my_org()`) has been run by the founder and verified
live against a real authenticated session. All code changes committed and
pushed to `main` (`6bb3821`, `1d01f9b`).

`npx next build`: compiled clean after every change below.

---

## 1. WhatsApp — partially hardcoded, fixed what's safe, flagged the rest

**Found and fixed:**
- `WABA_ID` was a bare JS constant in `lib/whatsapp.js`, the one Meta
  credential NOT already env-configured (token and phone-number-id
  already were). Moved to `process.env.META_WHATSAPP_WABA_ID` with a
  fallback to Wet Noses' known value, so nothing breaks today but a new
  deployment can now override it without editing code.
- `orgId` in `/api/fosters/send-checkin`, `/api/vet-care/send-notice`, and
  `/api/donors/send-update` all defaulted to a single global env var
  (`PILOT_ORG_ID`) instead of the actual entity's own org. Real bug, not
  just a tenant-scoping gap: a second tenant's foster placement or case
  would have been checked against Wet Noses' org id, not its own — sends
  would have silently failed (wrong-org membership check) or, worse in a
  differently-shaped future policy, leaked. Fixed all three to derive
  `orgId` from the placement/case/caller's own org, verified via a live
  build.

**Flagged, not fixed** (genuine architecture decision, not mine to make
unilaterally):
- The WhatsApp webhook (`/api/whatsapp/webhook`) still hardcodes
  `PILOT_ORG_ID`. Meta's webhook payload includes which `phone_number_id`
  received the message, but there's no `phone_number_id` → `org_id`
  mapping table, and building one is a real design decision: does a
  second tenant's WhatsApp run through this SAME shared deployment (needs
  that mapping table + per-org token/secret storage), or does each tenant
  get their own deployment (simpler, matches how Meta Apps naturally
  work, but breaks from the shared-deployment model every other feature
  uses)? Recommend deciding this before building either way.
- Template names (`guarida_vet_care_notice`, `guarida_foster_checkin`,
  `guarida_donor_update_v2`) are still hardcoded per API route. A new
  tenant would need their own Meta template approval under their own
  WABA — confirmed this is how Meta's template system works (templates
  belong to a WABA, not portable across accounts). Not parameterized in
  code yet since there's no second tenant's template names to actually
  feed in — premature to build the plumbing for values that don't exist.
- `sendDonorUpdateNotice()` still hardcodes its template name/language
  inline (unlike `sendWhatsAppTemplate`, which takes them as params) —
  same reasoning, left alone pending real second-tenant data.

## 2. legal_references / jurisdiction — real bug found and fixed

The schema was already right: `organizations` has had `country` and
`jurisdiction_state` columns since the original design, specifically for
this. The bug was that `case-intake/page.jsx` never used them — it
hardcoded the literal string `"MX-Nayarit"` in two places (the
legal-match query AND the case insert itself).

Bigger find, not just a hardcode: the case insert didn't include `org_id`
at all, and `cases.org_id` is `NOT NULL` with no default. Verified
directly (not assumed) with a real REST call: submitting a case via the
current live code path failed outright with a Postgres not-null
violation. Case-intake's "submit case" button had been broken in
production, unrelated to any tenant question — this audit just happened
to be the thing that surfaced it.

Fixed: case-intake now resolves the current user's real org (id, country,
jurisdiction_state) via `my_org()` and uses that for both `org_id` and
`jurisdiction` on insert, and for the legal-match query, instead of the
hardcoded string. Verified the insert actually succeeds now with a real
throwaway row (created and deleted via service role, zero left behind).

`legal_references` itself has no `org_id`, which is correct as-is, not a
gap — it's shared reference law data, filtered by jurisdiction string,
not owned by any one tenant.

## 3. Case fields / vet care — mostly clean, two real finds

`vet-care/page.jsx` and `cases/[id]/page.jsx`: no hardcoded org specifics
found — recipient resolution, care plans, expense/donation totals are all
already pulled from real per-case/per-org data.

Two real finds:
- `Nav.jsx`'s breadcrumb defaulted `orgName` to the literal `"Wet
  Noses"` — all 14 pages that use it omit the prop, so every screen in
  the app had been showing Wet Noses' name regardless of who's logged
  in. Fixed: Nav now resolves the real org name live per session via
  `my_org()`. Falls back to no org suffix on public/logged-out pages,
  which is correct.
- `LoginForm.jsx`'s copy reads "For Wet Noses staff, admins, and vets
  only." — flagged, not changed. This is login-screen copy, arguably
  closer to "site copy" than "structure," and rewriting it needs a
  decision about what a generic version should say — didn't want to
  guess at copy the founder hasn't approved.

## 4. Donor/foster/inventory — no hardcoded branding found, one UX flag

Currency is already stored per-record (`donations.currency`,
`expenses.currency`), not assumed — correctly structured. The only gap:
the currency dropdown in both `donors/page.jsx` and `expenses/page.jsx`
only offers MXN/USD as options. Not a structural problem (adding a
currency is a one-line UI change whenever it's needed), flagged rather
than fixed since guessing which currencies a hypothetical future tenant
needs felt like scope creep.

Donor/foster/inventory field labels themselves are generic ("amount,"
"category," "quantity") — no Wet-Noses-specific labeling found.

## 5. Design system / branding — structurally single-theme, as expected

`design-tokens.js` (internal app) and `landing-tokens.js` (public site)
are each a single shared constants module — no per-org override point, no
theming abstraction. This means yes, the code structurally assumes one
theme only, exactly the thing the task asked to flag even with nothing to
compare against yet. Deliberately did not build a theming system — that's
real UI work for a tenant that doesn't exist, which is explicitly out of
scope this round.

The public landing page (`Hero.jsx`, `Footer.jsx`) and `/emergency` +
`/report-guide` reference pages are heavily, deliberately Wet-Noses-
specific (real phone numbers, real Bahía de Banderas municipal detail,
"Wet Noses Rescue" by name) — this is "site-only marketing" content,
explicitly called out as already-decided scope, not part of the data
model. Flagging its existence for completeness, not touching it.

## 6. RLS policies — one already-known gap confirmed still open, one new bug found

**Already-known, still open:** the role-check functions every route/UI
gate uses (`is_active_worker`, `is_admin_or_staff`, `is_admin`,
`is_legal_reviewer`, `can_review_legal`) check ROLE ONLY, not which org
that role applies to — explicitly documented this way when
`legal_reviewer` was added ("this app has no per-org routing yet").
Confirmed this is still exactly the current state by reading
`middleware.js` directly. This means a person active in two different
orgs (explicitly a supported case per the schema's own design) would pass
a role check based on ANY org they belong to, not necessarily the one
they're currently acting in. The actual data tables still separately
filter by `org_id` via `is_active_member(org_id)`, so this isn't a data
leak today, but it is a real gap for whenever a second tenant/multi-org-
membership scenario becomes real. Flagging plainly rather than
re-solving it now — "add real per-org routing" is a bigger feature than
this audit's scope.

**New find**, needed for the fixes above to actually work: `organizations`
(and `people` directly) were unreadable to ANY real authenticated
account, not just anon — confirmed with a disposable real staff session,
not assumed. This is the same standing recursion bug on `people`'s RLS
policy flagged in `docs/inventory-accounting-schema.md` during an earlier
session (never fixed, only ever sidestepped). It hadn't mattered before
because nothing queried `organizations` directly — two of this audit's
fixes needed to. Followed the same established sidestep: a narrow
`security definer` RPC, `my_org()` (see
`docs/multi-tenant-audit-schema.md`), mirroring the existing
`my_person_id()`, rather than touching the broken policy itself.

**Resolved 2026-07-28:** founder ran the `my_org()` migration in
Supabase's SQL Editor. Verified live with a real disposable staff account
(created, tested, deleted — zero rows left behind): `my_org()` resolves
correctly, and the same session's direct `organizations` select still
hits the old recursion error, confirming this is a genuine sidestep, not
a coincidental fix of the underlying bug.

## Not done / out of scope, per the task's own boundaries

- WhatsApp webhook multi-tenant routing (needs a deployment-model
  decision first)
- Per-tenant WhatsApp template name storage (no second tenant's templates
  exist to store)
- Any theming/second-brand UI work
- Rewriting login-screen or marketing copy
- Fixing the underlying `people` RLS recursion itself (only sidestepped,
  as this codebase has done twice before)
- Building real per-org routing for multi-org members
