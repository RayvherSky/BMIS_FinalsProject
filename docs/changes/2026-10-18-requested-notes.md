# Requested changes — 18 October 2026

All four supplied notes were checked against the current source. Changes were implemented sequentially, preserving the previous audit repairs and normal application data.

| Your note | Result |
|---|---|
| Move the barangay logo to the upper right of the form and improve its appearance | Implemented on the login form. The existing seal now sits at the upper right of the form header on desktop and mobile, beside the barangay name. Refined header spacing, a subtle seal border/shadow, and rounded input/button corners. |
| Make role switching harder or separate it from editing | Implemented. Contact Edit no longer contains Role. A distinct Change Role action opens a permission warning, requires a different role and the target account's email, and offers Cancel before saving. The API independently validates this confirmation. |
| Allow admins to change a resident report's priority | Already implemented; preserved. The detail page already has an admin priority selector with confirmation, backed by an admin-protected PATCH endpoint. Focused HTTP checks verified all four allowed levels. |
| Allow only admins to change priority | Existing update protection was already implemented. Closed the remaining submission gap: residents no longer choose initial priority, and the API always creates resident reports at Medium even if a request supplies another value. Residents see the priority subsequently assigned by an admin. |

## Verification actually performed

- **34 checks passed, 0 failed, 0 skipped:** 25 existing focused repair checks plus nine new HTTP checks.
- The nine new checks exercise the real Express routes, authentication middleware, role guards, and controllers over a temporary loopback HTTP server. Database queries/writes and JWT verification use isolated fixtures; these checks do not contact the normal database or establish live MongoDB/JWT integration.
- Role checks cover contact-edit rejection without partial updates, ordinary contact saving, role/email validation, unauthenticated and resident denial, promotion/demotion, changed permissions on an existing session, password exclusion, and missing targets.
- Priority checks cover resident creation attempts with forged priority values, all four admin-assigned levels, resident visibility, and rejection of resident/invalid updates.
- Changed JavaScript/JSX and CSS parse successfully; scoped Git whitespace checks pass.
- **48 browser cases are discoverable across four files.** Existing role scenarios were updated to the separate API/UI, retaining contact persistence and immediate session-permission assertions. New cases cover resident priority visibility and role-change error/retry behavior.
- Browser execution is **blocked**: both the focused Playwright command and `npm test` stop with `spawn EPERM` while starting the temporary API. The build is also **blocked** by `spawn EPERM` when Vite starts esbuild. No browser pass or successful production build is claimed. Visual placement, responsiveness, and full MongoDB persistence still need runtime confirmation.
- Superdesign's CLI was unavailable (`ENOTCACHED` in the restricted npm cache). The login update was implemented directly with the existing seal and project styles; no external design draft was generated.

## How to test manually

Use the local app at `http://localhost:3000`. Ensure the backend is running the current code so the new role endpoint is available. Use a test resident account for role changes.

### 1. Login logo

1. Log out and open `/login`.
2. Confirm the barangay seal appears at the **upper right of the login form**, beside the barangay name. It should no longer appear in the left photograph panel.
3. Check desktop and narrow widths such as 375px and 320px. The seal should remain at the right of the header, with no clipped fields or horizontal scrolling.
4. Sign in as a resident and admin, then verify Register and Forgot Password links still open their pages.

### 2. Contact editing and separate role changes

1. As an admin, open **User Management** and find a test resident.
2. Click **Edit**. Confirm there is **no Role selector**. Change a phone/address, save, and confirm the account still has its previous role after reload.
3. Click **Change Role**. Confirm the account name/email and permissions warning are visible.
4. Select **Admin**. The confirmation button must stay disabled while the email is blank or incorrect.
5. Enter the displayed account email. The button should enable. Click **Cancel** and confirm the role did not change.
6. Reopen Change Role. Confirmation must be empty again. Select Admin, enter the email, and click **Confirm Role Change**.
7. Confirm the row shows admin after reload, and that the contact details saved in step 2 remain intact.
8. Repeat using Resident to return the test account to its original role. An already signed-in session for that account should immediately lose access to admin APIs after demotion.
9. A resident must not be able to open User Management. A role-change request without admin access must return 401/403. A contact-edit PUT containing `role` must return 400, and a dedicated role PATCH with the wrong confirmation email must return 400.

### 3. Existing admin priority controls

1. As a resident, submit a new report. There should be **no priority dropdown**; the form explains the Medium starting priority and admin assessment.
2. Open the new report and confirm its priority is Medium and displayed read-only.
3. As an admin, open that same report and choose another priority.
4. First cancel the confirmation: the previous value must remain. Select it again and confirm: reload and verify the new value persists.
5. Return to the resident's view and reload. The assigned priority should match the admin's selection, with no editing control.
6. A direct resident PATCH to `/api/tickets/{id}/priority` must return 403 and preserve the value. A report submission supplying `priority: "Urgent"` must still create the report at Medium.

## Automated commands

Run the checks that work without subprocesses from the repository root:

```powershell
node --test --test-isolation=none server/tests/audit-repairs.test.js server/tests/notes-changes.test.js
```

Run the final browser/build gates in an environment that permits child processes:

```powershell
cd C:\PROJECTS\BMIS\client
Remove-Item Env:BMIS_FRONTEND_ONLY -ErrorAction SilentlyContinue
npm test
npm run build
```

Playwright uses its own temporary database and ports 5001/3001. Normal database records and uploads were not seeded, reset, migrated, or deleted for this work.

## API changes and files

- `PUT /api/users/:id` now updates contact details only; supplying `role` returns 400 before any fields change.
- New `PATCH /api/users/:id/role` accepts `{ role, confirmationEmail }`, requires current admin access, and checks the target email. It returns the updated account without its password.
- Resident `POST /api/tickets` ignores any client-supplied priority and stores Medium. The existing admin-only `PATCH /api/tickets/:id/priority` is unchanged.
- Production changes: `client/src/pages/Login.jsx`, `UserManagement.jsx`, `SubmitTicket.jsx`, `client/src/App.css`, `client/src/api/userApi.js`, `server/controllers/userController.js`, `ticketController.js`, and `server/routes/userRoutes.js`.
- Tests: new `server/tests/notes-changes.test.js` and `client/tests/requested-notes.spec.js`; updated relevant role scenarios in `client/tests/bmis.spec.js` and the intentional new priority expectation in `server/tests/audit-repairs.test.js`.

Other notes and backlog features remain outside this change set. No dependency upgrades or commits were made.
