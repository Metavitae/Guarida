# Guarida — Project Plan (Phase 0)
*Working name. Rename anytime — nothing below depends on it.*
*Part of Project Retirement, under One Ring.*

---

## 1. What this is

A multi-tenant platform for animal rescues, shelters, and animal hotels to run their whole operation: people, communications, cases, money, and outreach — in one place, reachable from a phone, with WhatsApp as the communication layer people already use.

**Design north star:** the Mistral-style scroll interaction (elements grow/slide into view as you scroll) applied to a warm, humane visual identity — not Mistral's cool purple/sunset AI-brand look. Editorial confidence, but it should feel like it cares about animals, not like it's selling enterprise software.

---

## 2. Non-negotiable architecture decisions

These were locked in based on your answers — multi-org from day one, Mexico first, fastest-to-pilot:

- **Multi-tenant from the start.** Every org's data is isolated by row-level security, not by convention. Retrofitting this later is far more expensive than building it in now.
- **The kill switch is a database-level guarantee, not a UI toggle.** Revoking someone's membership must cut off *all* access — app, API, and WhatsApp bridge — within seconds, not at next token refresh. (Full mechanism in the data model doc.)
- **Legal information is advisory until a human confirms it.** The app suggests the applicable statute for a case; it never auto-asserts a legal conclusion or auto-files with an authority without a person clicking confirm. This isn't a hedge — misrouting an abuse case is a real liability and a real harm if wrong.
- **Mexico's authorities don't have a unified submission API.** Phase 2's "send to authorities" starts as *generate the correct report packet + evidence bundle*, and the human sends it. We automate the packaging, not (yet) the transmission.

---

## 3. Feature scope by phase

### Phase 0 — Planning (now)
- [x] Lock this scope doc
- [ ] Wireframe key screens (case intake, org dashboard, donor view)
- [ ] Build the Mexico legal-reference table (federal + relevant state law) — **flagged for lawyer sign-off before it's used on a real case**
- [ ] Set up this project's Feed/ and Log/ folders in Drive

### Phase 1 — MVP / working pilot
- Org + people directory, roles, one-tap kill switch
- WhatsApp bridge for internal comms (Meta Cloud API or Twilio)
- Case intake: description, photo/video, location, witness info, suggested (human-confirmed) applicable law
- Foster/volunteer/donor directory — basic CRM
- Inventory + per-case expense log

### Phase 2 — Depth
- Vet notification on medical-flagged cases + care-plan distribution to assigned caregivers
- Authority report-packet generator (per Mexican jurisdiction)
- Donor/investor case reports (full expense trail per case)
- Social content engine — Sapolsky-informed campaign copy (stress/empathy/in-group psychology translated into warm, funny, shareable material, never clinical-sounding)

### Phase 3 — Hardening
- Security + permissions audit
- Legal-accuracy audit (human legal reviewer, not just AI)
- Final QA pass — good moment for the Fable round you planned (note: Fable 5's free-inclusion window ends July 7; after that it's still usable, just metered — no need to rush this phase to beat a deadline)

---

## 4. Suggested agent/bot decomposition

Keeping each piece small and swappable, since you'll be moving between AI tools:

| Component | Job | Notes |
|---|---|---|
| Access-Control Core | Org roles, kill switch | Not AI — pure data/auth logic |
| WhatsApp Bridge | Routes internal chat ↔ WhatsApp threads | |
| Case Intake Bot | Structured intake, photo/video capture, witness info | |
| Legal-Match Agent | Suggests applicable statute | Always human-confirmed, never auto-files |
| Vet Notification Agent | Alerts org vet on medical cases, distributes care plans | |
| Donor/Inventory CRM Agent | Prospecting, donations, inventory, expenses | |
| Social Content Agent | Drafts + schedules campaign posts | Sapolsky-informed tone |
| Emergency Directory | Static, role-filtered contact list | Vet, police, animal control, poison control |

---

## 5. Stack (optimized for cheap + fast + multi-tenant)

- **Supabase** — Postgres + Auth + Row-Level Security + Storage. RLS is what makes the kill switch trivial and multi-tenancy safe by default.
- **WhatsApp Business Cloud API** (or Twilio as a faster-to-integrate alternative)
- **Next.js + Tailwind + Framer Motion** — for the scroll-reveal interactions
- **n8n** — cheap, low-code glue between bots/agents (donor sync, social scheduling, report generation)
- **Claude Sonnet 5** for most build/logic work; escalate to Opus only where reasoning is genuinely hard; reserve Fable for the final review pass

---

## 6. Open questions for you

- Confirm the working name (Guarida, or something else?)
- Do you have a specific first partner org in Mexico to pilot with, or are we designing for a hypothetical "typical" rescue?
- Any existing social media accounts to integrate, or all built from scratch?

---

*Log entry recommended once Phase 0 items are checked off — drop a note in this project's Log/ folder per the standing Faro protocol.*
