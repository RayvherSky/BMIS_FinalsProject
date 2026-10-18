# BMIS system audit — 18 October 2026

Reviewed the working tree at commit `61f6a0b`, including the October ticket and analytics updates. This was a testing and documentation pass. No application, backend, dependency, or existing test files were changed. The user's additional notes are deferred until the audit is reviewed; the existing backlog is in root `update.md` (`Context/update.md` is empty).

## Results

| Check | Result | Evidence |
|---|---|---|
| Production build | PASS, 11.23 seconds | `cd client; npm run build`; existing bundle-size warning |
| Original 19 tests | 17 passed, 2 failed | `cd client; npm test`, before adding the audit file; 3.6 minutes |
| New feature/audit tests | 9 passed, 9 failed | `tests/updated-features.spec.js`; final run 93.5 seconds; no skipped or expected-failure cases |
| Distinct cases across the two runs | 37 tested: 26 passed, 11 failed | Aggregate of separate runs against unchanged product code, not a single combined run |
| Normal demo database, read-only inspection | 10 users, 29 tickets, 21 completed | 2 admins / 8 residents; 14 Resolved, 7 Dismissed, 4 In Progress, 4 Pending; 0 archived |

The application builds and its original core workflow remains usable. The new privacy failures and delayed-response bug need correction before calling the update verified. Phone validation is an explicitly planned requirement from `update.md`, rather than a regression from a previously implemented validator.

The original two failures use outdated duplicate-link selectors and request direction: options now include `(Pending)`, selection requires **Link Selected**, and the selected children are linked to the current master. A new test confirms that this batch workflow and unlinking work. Separately, an updated delayed-response scenario reproduces an actual navigation bug; updating selectors alone will not resolve that defect.

## Confirmed findings and reproduction cases

Priorities: **P1** address before demonstration or further feature expansion; **P2** next correction pass; **P3** optional enhancement.

| ID | Priority | Reproduction and actual result | Expected behavior / repair acceptance |
|---|---|---|---|
| AUD-01 | P1 | Admin adds an internal note to a resident's report. `GET /api/tickets/my-tickets` returns its text and `isPrivate: true`. Posting a public update to the same report also returns that internal note. Two failing tests. | Every resident-facing list and mutation response excludes private notes. Keep detail GET behavior, which already filters them correctly. |
| AUD-02 | P1 | Admin links Ana's report to Pedro's report. Ana posts a note on her own report. The POST response includes Pedro's linked report title, description, location, owner ID, notes, and other fields. | Apply the same linked-report privacy rules as detail GET. A linked report belonging to someone else must expose only the permitted identifier. |
| AUD-07 | P1 | On ticket A, batch-link C; delay the subsequent refresh of A; follow A's link to B; release the old refresh. URL remains B but A's title/details reappear. | After every awaited refresh, confirm the component still displays the same route before updating ticket/candidate state. Cover linking and unlinking refresh chains. |
| AUD-03 | P2 | Search for the ordinary character `[` in active tickets, My Tickets, archive, and users. All four APIs return HTTP 500. | Treat search as literal text or explicitly validate patterns without producing a server error. No pathological regex/load test was performed; the earlier ReDoS claim remains a potential risk, not a demonstrated denial of service. |
| AUD-04 | P2 | Directly create an `Others` report with `customCategory: ""` or spaces. Both requests return 201. The browser form already blocks blank custom categories. | Backend requires a nonblank custom category when category is `Others`; return a useful 400 validation response. |
| AUD-05 | P2 | Open Category filter on admin dashboard, admin archive, and resident My Tickets. All three omit `Others`. | Reports accepted under `Others` must also be discoverable through the category filters. |
| AUD-06 | P2 / planned requirement | Register with optional phone `not-a-phone-number`. API accepts it with HTTP 201; the registration input has no phone rule. | Empty remains optional; a supplied value must pass an agreed Philippine phone format, enforced in UI and API. Choose accepted formats before implementation. |
| AUD-08 | P2 | At 375×812, open an admin ticket with an update. Document width settles at 409px. The bordered description table overflows its 213px content area; header/sidebar text is also cramped. Dashboard charts fit the same viewport. | Ticket details and controls fit 375px with readable wrapping/stacking; table content must not expand the whole page. |
| AUD-09 | P2 / test maintenance | Existing duplicate-link E2E and delayed-mutation contract tests time out against the previous single-select interaction. | Update the two original tests to batch linking, option labels, child-to-master request direction, and explicit submission. Retain the new race reproduction rather than removing coverage. |

Responsible locations:

- AUD-01/AUD-02: `server/controllers/ticketController.js:77` (`getMyTickets`), `:307` (`addTicketNote`); compare the filtering at `:129`. The UI assigns the returned ticket directly at `client/src/pages/TicketDetails.jsx:204`.
- AUD-07: `client/src/pages/TicketDetails.jsx:151` and `:172`. Both paths check route identity before another fetch, then assign refreshed state after that fetch without another identity check.
- AUD-03: `server/controllers/ticketController.js:57`, `:85`; `server/controllers/archiveController.js:16`; `server/controllers/userController.js:12`.
- AUD-04: `server/controllers/ticketController.js:8`; `server/models/Ticket.js:28`.
- AUD-05: `client/src/utils/helpers.js:81`, shared by the three filter pages. Submission adds `Others` separately.
- AUD-06: `client/src/pages/Register.jsx:133`; `server/models/User.js:34`; `server/controllers/authController.js:17`.
- AUD-08: `client/src/pages/TicketDetails.jsx:223`, `:294`; responsive description content and the surrounding layout require review.
- AUD-09: `client/tests/bmis.spec.js:187`; `client/tests/frontend-contract.spec.js:40`.

## Original regression cases

All ran against the temporary acceptance database; the normal demo database was not reseeded or modified.

| ID | Case | Actual |
|---|---|---|
| BASE-01 | Ten realistic users and at least twenty completed tickets | PASS |
| BASE-02 | Profile contact save leaves a blank password unchanged | PASS |
| BASE-03 | Resident totals and latest five tickets | PASS |
| BASE-04 | Evidence upload → processing → resolution → archive → restore | PASS |
| BASE-05 | Unsupported/oversized photo validation | PASS |
| BASE-06 | Ticket filters and global admin totals | PASS |
| BASE-07 | Original single-select duplicate-link scenario | FAIL — outdated test contract, AUD-09 |
| BASE-08 | Admin edits user contact and role | PASS |
| BASE-09 | Role routes, ownership, and missing-ticket handling | PASS |
| BASE-10 | Password reset is single-use and invalidates the old password | PASS |
| BASE-11 | Role changes apply to existing tokens | PASS |
| BASE-12 | Detail GET hides another resident's linked report content | PASS; mutation response separately fails AUD-02 |
| BASE-13 | Dismiss/archive/restore preserve status and timestamps | PASS |
| BASE-14 | Registration and logout | PASS |
| BASE-15 | Failed profile save preserves unsaved input | PASS |
| BASE-16 | Failed ticket fetch shows an explanation and back navigation | PASS |
| BASE-17 | Empty resident dashboard | PASS |
| BASE-18 | Original delayed single-link mutation scenario | FAIL — outdated test contract, AUD-09 |
| BASE-19 | Four resident pages fit 375px | PASS; did not cover ticket details |

## New executable test cases

Source: [updated-features.spec.js](../client/tests/updated-features.spec.js). These are normal assertions: unresolved problems fail; none are skipped or marked as expected failures.

| Case | Setup and action | Expected result | Actual |
|---|---|---|---|
| UPD-01 | Create a master and two same-category children; select both; submit; unlink one | Selection alone does not save; both links persist; unlink leaves the other child intact | PASS |
| UPD-02 | Change Medium → Urgent, cancel once, then confirm and reload | Cancel keeps Medium; confirmation saves Urgent across reload | PASS |
| UPD-03 | Send an invalid priority as admin and a priority update as resident | 400 / 403; stored priority unchanged | PASS |
| UPD-04 | Select Others; submit without its description; then supply Animal welfare | Form validation blocks blank; valid custom category persists | PASS |
| UPD-05 | Resident posts a public update and reloads | Timeline renders the update and keeps it after reload | PASS |
| UPD-06 | Admin posts private and public notes; owner reads detail; another resident posts | Owner receives public note only; admin receives both; other resident gets 403 | PASS |
| UPD-07 | Resident submits `isPrivate: true` with a note | Note is stored as public, not as an admin-only internal note | PASS |
| AUD-01a | Admin private note → owner lists own tickets | Private note absent from list response | FAIL — private content returned |
| AUD-01b | Admin private note → owner posts public note | Only public notes in mutation response | FAIL — private content returned |
| AUD-02 | Cross-resident link → owner posts note | Foreign linked report contains only permitted identifier | FAIL — full report returned |
| AUD-03 | Search `[` across four APIs | 200, literal search; no server error | FAIL — four HTTP 500 responses |
| AUD-04 | POST Others with empty/whitespace description | 400 for both | FAIL — both return 201 |
| AUD-05 | Open category menus for admin dashboard/archive and resident list | Others available in all three | FAIL — absent from all three |
| UPD-08 | Controlled four-ticket dataset; read chart labels; filter directory to zero | Status counts 1 Pending / 2 Resolved / 1 Dismissed, percentages 25/50/25; category counts correct; charts retain global totals | PASS |
| UPD-09 | Dashboard receives no tickets | Five zero totals; empty directory; no invalid chart | PASS |
| AUD-06 | Register a supplied alphabetic phone value | Reject invalid supplied phone | FAIL — accepted; planned validation gap |
| UPD-10 / AUD-08 | At 375px inspect admin analytics then a ticket with a note | Document width ≤375 on both pages | FAIL — dashboard fits; ticket details are 409px wide |
| AUD-07 | Delay A's post-link refresh, navigate to B, release A | B remains the displayed ticket | FAIL — A is displayed under B's URL |

Analytics and race tests control API responses to check known counts and response order. The other new feature tests use the real temporary API/database. No stress test, production deployment test, email/SMS delivery test, or full screen-reader audit was performed.

## Backlog carried from update.md

| Work | Current status / next action |
|---|---|
| Redesigned login and startup splash | Present. Basic photo split and fade animation verified in source; original login flows pass. |
| Chosen system name | Notes mark name selection done, but current title/sidebar/API still use BMIS. Confirm the chosen name before applying it consistently. |
| Logo at upper-right of login form and docking animation | Not present in this checkout. The ledger's 12 October 01:10 entry claims it, but current Login still has the large left-panel logo and Splash has only scale/fade. Reconcile the intended version before implementing. |
| Pie chart and analytics | Implemented; deterministic count/empty-state tests pass. |
| Notes / public updates | Implemented and persistent; privacy across list and POST responses remains blocked by AUD-01/AUD-02. |
| Multiple duplicate links / unlink | Implemented as several child reports pointing to one master, not an array of links on each ticket. Successful flow verified; delayed refresh remains AUD-07. |
| Admin priority editing | Confirmation, cancellation, persistence, invalid-value handling, and resident rejection verified. |
| Others/custom categories | Submission and display in detail/admin analytics work; backend validation and shared filters remain incomplete. Resident list/cards still show generic Others rather than the custom label. |
| Registration phone validation | Not implemented; reproduced as AUD-06. |
| Dashboard/entry/sidebar highlight animations | Pending; decide motion and reduced-motion behavior when addressed. |
| More visible Report New Incident and View All Tickets actions | Pending usability pass. |
| Duplicate sidebar collapse controls | Both the bottom Sider trigger and header button remain. Remove or repurpose one during navigation polish. |
| Real logo in header/browser title section | Pending. Header/sidebar use a generic badge; `client/index.html` still references `/vite.svg`. |
| Make role changes harder to trigger / separate from general edit | Pending UX/safety workflow. Existing role authorization tests pass; this is not a demonstrated unauthorized role change. |
| Simple mode | Future feature; define essential resident actions and navigation before implementation. |
| Assistant/companion | Optional future feature; decide scope, model/API, cost, and what advice it can provide. No implementation found. |
| Ticket email notifications | Future integration; no delivery pipeline verified. Password recovery currently displays a local demo link. |
| SMS updates | Future integration; provider, contact consent/preferences, and costs remain undecided. |

Suggested sequence for later one-at-a-time changes: AUD-01 → AUD-02 → AUD-07 → search handling → custom-category validation/filtering → phone validation → mobile details → legacy test maintenance → navigation/branding polish → optional features. The phone format and chosen product name need user input when their implementation begins.

## Evidence and repeat commands

- [Compact machine-readable results](audits/2026-10-18/results.json)
- [Admin dashboard screenshot](audits/2026-10-18/admin-dashboard.png)
- [375px admin ticket screenshot](audits/2026-10-18/admin-ticket-mobile.png)
- Original failure screenshots/traces: `client/test-results/bmis-duplicate-linking-*/` and `client/test-results/frontend-contract-a-delaye-*/`.
- New final failure screenshots/traces: `client/test-results/updated-features-final/`.
- Full final new-test JSON: `client/test-results/updated-features-final-report.json`.

```powershell
cd C:\PROJECTS\BMIS\client
npm run build
# Re-run the original 19 only:
npx playwright test tests/bmis.spec.js tests/frontend-contract.spec.js
# Re-run the 18 new cases:
npx playwright test tests/updated-features.spec.js
# After adding the audit file, npm test discovers all 37 cases:
npm test
```

The harness creates a temporary MongoDB and uses ports 5001/3001. Expected current failures are documented above; exit code 1 must not be described as a green suite. The normal 27017 database and 5000/3000 application remain separate. No seed or cleanup mutation was run against the normal database.
