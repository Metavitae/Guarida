# Guarida

Multi-tenant animal rescue / shelter / hotel operations platform.
Pilot org: Wet Noses Rescue (Punta de Mita, Nayarit, Mexico).

**This repo did not exist until now.** Everything in here was generated
across a single long chat session and delivered as separate downloadable
files each time — never assembled into one project or pushed anywhere.
This structure is that assembly, done properly, so it can become a real
GitHub repo instead of living only as chat attachments.

## What's actually real vs. demo-only

- **`backend/`** — tested logic (import connector, WhatsApp bridge, case
  intake, donor/foster/inventory). Every module has passing tests, but
  **only against hand-written mock Supabase clients** — none of this has
  touched a real database yet. That's the current top priority (see below).
- **`frontend/app/`, `frontend/components/`, `frontend/lib/`** — the real,
  wired frontend. `case-intake-page.jsx` actually queries Supabase (via
  `lib/supabase-client.js`) when it's configured, falling back to visibly-
  labeled sample data when it isn't.
- **`frontend/preview-screens/`** — four standalone demo files (landing,
  case intake, donor/foster, vet care). These render as live interactive
  previews in Claude's chat interface but are **not wired to any backend**
  — they use local React state and hardcoded sample data. Useful for
  showing the visual/interaction direction, not for running as the real app.
- **`docs/`** — project plan, the full database schema (`access-model.md`),
  and the legal reference dataset (15 entries, all flagged
  `lawyer_reviewed: false` — none of this is verified legal advice yet).

## What's NOT done yet
- No real Supabase project exists. This is the actual blocking step —
  everything above is untested against reality.
- Donor/Foster and Vet Care screens haven't been wired the way Case Intake
  has (still on local mock state).
- Legal reference dataset needs an actual attorney's review before
  `lawyer_reviewed` flips to true on any entry.
- Wet Noses' existing system (Shelter Manager/ASM) isn't connected — the
  import connector in `backend/import-connector/` is the manual-bridge
  workaround for this in the meantime.

## Recommended next steps, in order
1. Create a real Supabase project (supabase.com — a few minutes)
2. Run `docs/access-model.md`'s SQL against it
3. Seed `docs/legal-references-draft.md`'s SQL into the `legal_references` table
4. Push this whole folder to a private GitHub repo
5. Connect that repo to Vercel or Netlify for deployment (not GitHub Pages —
   this app has real secrets/API keys, which Pages can't hold safely)
6. Re-run the existing tests against the real Supabase project instead of mocks
