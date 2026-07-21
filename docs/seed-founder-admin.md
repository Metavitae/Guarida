# Seeding the founder's admin account

Done in response to the 18:34:51Z doc, which caught that the 18:18:27Z
addition to the login-gate task (seeding metavitae@gmail.com's own admin
access) had been missed in the first pass.

## What was checked first, not assumed

- `auth.users`: zero rows existed at all (confirmed via the Admin API's
  user list) — no prior magic-link attempt had ever created an account for
  her, or anyone.
- `people`: zero rows — no pre-seeded row for her email either.
- `organizations`: zero rows — **Wet Noses Rescue itself had never been
  seeded as a real row**, despite being referenced throughout the project's
  docs and the legal-reference dataset's Nayarit jurisdiction. This was a
  real, separate gap, not something specific to the founder's account.
- No trigger exists anywhere in the schema (checked docs/ and all backend
  code) that auto-links a pre-created `people` row to a future `auth.users`
  row on first sign-in. This matters: if a `people` row had been inserted
  with `auth_user_id = null` ahead of time, hoping it would "link up" once
  she signed in for real, it never would have — `is_active_worker()` joins
  on `p.auth_user_id = auth.uid()`, and null never matches anything, ever.

## What was actually done, in order

Because of that last point, the only correct approach is to create her real
`auth.users` row *first* (via Supabase's Admin API — this is the correct,
supported way to create a user; raw `INSERT INTO auth.users` bypasses
GoTrue's own constraints and isn't how Supabase auth is meant to be
managed), then create `people`/`memberships` rows already pointing at it,
rather than trying to seed ahead and link up later:

1. `organizations`: inserted `Wet Noses Rescue` (org_type: rescue, country:
   MX, jurisdiction_state: Nayarit) — id `0351f044-e0b3-4cb3-bca8-e328594feeae`.
2. `auth.users`: created via `POST /auth/v1/admin/users` for
   `metavitae@gmail.com`, `email_confirm: true` — id
   `ee1a7fc3-0398-42d7-9630-c15db77fbcb9`.
3. `people`: inserted, `auth_user_id` set directly to the id from step 2 —
   id `1b1752b0-eae1-4b60-aead-75a2a3708933`.
4. `memberships`: inserted, linking that person to the Wet Noses org from
   step 1, `role: admin`, `status: active`.

Equivalent SQL, for the record (this is what steps 3–4 amount to; step 2
has no SQL equivalent since it must go through the Admin API):

```sql
insert into people (auth_user_id, full_name, email)
values ('ee1a7fc3-0398-42d7-9630-c15db77fbcb9', 'Metavitae', 'metavitae@gmail.com');

insert into memberships (org_id, person_id, role, status)
values (
  '0351f044-e0b3-4cb3-bca8-e328594feeae',
  (select id from people where email = 'metavitae@gmail.com'),
  'admin',
  'active'
);
```

## Verification

- Queried `memberships` directly for her `person_id`: `role: admin,
  status: active` — confirmed, not assumed.
- Queried `people` directly: `auth_user_id` correctly set to her real
  Supabase Auth user id.
- Generated a real magic link for `metavitae@gmail.com` via the Admin API,
  verified the OTP to get a genuine access token for her actual account
  (same technique used for the earlier disposable test worker, per this
  task's own suggested fallback for when a live browser click-through
  isn't available in this environment), called `is_active_worker()` with
  that token: **`true`**. Her real account, not a stand-in, passes the gate.

## What this means for her practically

The next time she visits `/login` and enters `metavitae@gmail.com`, the
magic link will sign in to this same real account, which already has an
active admin membership — she will land on a protected page successfully,
not get bounced to `/login?reason=revoked`.
