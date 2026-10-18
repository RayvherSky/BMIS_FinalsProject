# Seed includes the three-role account set

`cd server; npm run seed` now creates **15 accounts**: the original ten plus the five dispatch accounts. Its final console output lists every email and usable password under **Admin Accounts**, **Employee Accounts**, and **User Accounts**. Totals are three Admins, two Employees and ten Users.

The new entries are `dispatch.admin@bmis.test`, `dispatch.employee1@bmis.test`, `dispatch.employee2@bmis.test`, `dispatch.user1@bmis.test` and `dispatch.user2@bmis.test`. The existing provisioner remains the source of those account definitions and generated passwords. Reseeding reuses their saved initial passwords from `server/.local-data/demo-accounts-2026-10-19.json`; if no file exists, it generates and prints the new passwords. The original ten sample logins retain `Password123!`. The obsolete “all passwords” message is removed.

Freshly seeded standard accounts use canonical `user`; existing resident records are not migrated. All original ticket samples and owner references remain part of the seed. The seed still intentionally replaces users and tickets when invoked. This change did **not** run it against the normal database.

## Changed files

| File | Change |
|---|---|
| `server/seeders/seed.js` | Reuse additive account provisioner after the sample seed; print all credentials grouped by current role; seed canonical User roles |
| `server/scripts/test-server.js` | Force a credentials file inside the temporary MongoDB directory, which is removed with that database |
| `server/tests/seed-accounts.test.js` | Execute actual `npm run seed` against temporary MongoDB; verify accounts, roles, printed/password-file credentials, password hashing, sample ownership and repeated reseeding |
| `client/tests/bmis.spec.js` | Assert the expanded 15-account fixture, retaining the original ten-account completeness and completed-ticket checks |
| `Context/SESSION_HANDOFF.md` | Record current seed behavior and final evidence |
| `Context/PROJECT_STATUS.md` | Clarify current demo password/account instructions |

The optional `BMIS_DEMO_CREDENTIALS_PATH` override lets isolated seed runs use temporary credential storage. Normal seeding defaults to the existing local credentials file. Automated tests never overwrite that file; its before/after checksum was unchanged.

## Verification

- Before implementation, both new CLI tests failed with **10 accounts instead of 15**.
- After implementation, both CLI tests passed. Every printed dispatch password matched its real bcrypt-backed account; reseeding preserved saved passwords and restored the specified active role set without duplicating tickets.
- All **72 existing backend checks** passed, zero failures or skips.
- Syntax checks passed for the seed, temporary test launcher and new tests.
- Complete browser verification against the expanded seed passed **71/71**, with **zero failures, skips, flaky cases or runner errors**, in **359.99 seconds**. Evidence: `client/test-results/reseed-accounts.json`.
- Test ports **5001/3001** were released and no acceptance-test uploaded photos remained. The normal credentials file still has its original modification time, before these tests.

The final result is **74 passing backend/seed checks** (72 existing + two new) and **71 passing browser scenarios**. No frontend application source or dependencies changed, and the normal database was not reseeded. There are no pending implementation or verification steps for this follow-up.

## Use

```powershell
cd C:\PROJECTS\BMIS\server
npm run seed
```

Read the grouped email/password list at completion. New Employees start unassigned; assign an active ticket from the Admin details page when testing their workspace. The normal database and its saved credentials were left intact during implementation/testing.
