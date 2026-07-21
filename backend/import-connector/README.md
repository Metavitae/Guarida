# Guarida — Import Connector + What's Next for WhatsApp

Two things in here: the import connector (built, tested, ready), and a clear
list of what needs *you* specifically for the WhatsApp piece — steps I
genuinely cannot do on your behalf.

---

## Part 1 — Import connector (done, tested)

**What it does:** takes any CSV export from Wet Noses (or any future org),
and brings it into Guarida — without needing to know in advance what their
spreadsheet looks like. You point it at the file and tell it which column
means what, once.

**Tested it myself** against a deliberately messy sample (missing names,
inconsistent phone formats like `+52 322 123 4567` vs `322-987-6543`, blank
cells) — it correctly skipped the one row with no name, normalized the phone
numbers, and left a clear report of what happened. Output was:

```
Parsed 4 rows from ./sample_people.csv
  Would import: 3
  Skipped: 1
    - row 4: missing full_name
```

**How you'll use it once Wet Noses tells you what they have:**

1. They export their contacts/donors/inventory to CSV (every spreadsheet
   tool — Excel, Google Sheets, Airtable — can do this).
2. You copy `configs/example-people-config.json`, and edit the `mapping`
   section so it points at *their* column names instead of the example ones.
3. Run it in dry-run mode first — nothing gets written, you just see what
   *would* happen:
   ```
   node import.js --config ./configs/your-config.json --dry-run
   ```
4. Once it looks right, drop the `--dry-run` flag to actually write the data
   (requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment
   variables, once the Supabase project from the access-model doc exists).

**Supports:** people (staff/volunteers/fosters/vets), donors, inventory.
**Deliberately does not support:** case records — case history should start
clean in Guarida, not get bulk-imported from a spreadsheet that was never
built for legal/medical recordkeeping. That was a deliberate call, not an
oversight.

---

## Part 2 — WhatsApp bridge: what needs you, step by step

This piece has real-world steps that only you (or whoever holds Wet Noses'
business identity) can do — I can't create accounts or verify a business on
your behalf. Here's the honest sequence:

1. **Decide the provider.** Two realistic paths:
   - **Meta WhatsApp Cloud API** — free to use, but requires a verified
     Meta Business account and goes through Meta's app review for anything
     beyond basic messaging.
   - **Twilio's WhatsApp API** — faster to get running (hours, not days),
     costs a small per-message fee, and doesn't require Meta's business
     verification up front. Given "fastest to pilot," I'd start here.

2. **You (or Wet Noses) need to:**
   - Have a business phone number that isn't already on personal WhatsApp
     (WhatsApp Business API requires a number not currently active on the
     regular WhatsApp app)
   - Create the Twilio account (or Meta Business Manager account) — this
     needs a real business email and, for Meta, business verification
     documents
   - Get the WhatsApp Sender approved on that number (Twilio: usually
     same-day for sandbox testing, longer for production approval)

3. **Once you have API credentials**, I write the actual bridge code —
   webhook that receives WhatsApp messages, routes them to the right org
   thread, and checks membership status before treating a message as
   "inside" the org (this is where the kill switch logic from the access
   model plugs in).

4. **Nothing in step 3 needs to wait on step 2 finishing** — I can build
   and test the bridge logic against Twilio's sandbox number, which anyone
   can use for free during development, and swap in your real number later.

**My recommendation:** start the Twilio sandbox signup today (it's a
5-minute form, not a business-verification process) so I can start on the
actual bridge code in parallel rather than waiting on you.
