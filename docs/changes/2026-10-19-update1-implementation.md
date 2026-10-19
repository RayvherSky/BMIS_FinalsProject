# Update 1 — ticket requests, reversals and staff Action Center

19 October 2026. The owner approved every recommended default in the [discovery/design](2026-10-19-update1-discovery.md) and authorized implementation. [Execution plan](../superpowers/plans/2026-10-19-update1.md). Requirements: `Context/Updates/update1.md`.

**Complete and verified.** All **96 backend/seed checks**, **3 client role checks**, **86 browser scenarios**, and the production build pass. The browser run has zero failures, skips, flaky cases or runner errors. Normal data and credentials were preserved.

## A. Implementation summary

| Feature | Result |
|---|---|
| Admin reversal | Required reason, previous recorded active status, labelled legacy correction, retained audit |
| Communication protection | Configurable backend quotas, concurrent duplicate suppression and retry feedback |
| Pending follow-up | Owner-only; once per Manila calendar day, with no earlier unresolved follow-up |
| Progress update request | Same daily/open-request rules; currently authorized Employee or Admin handles it |
| Dismissal appeal | Active/archived Dismissed reports; one per dismissal, required explanation, Admin decision |
| Staff Action Center | Shared source/page, role filtering, counts, filters, pagination, viewing, acknowledgement and explicit completion |
| Optional operator | Deferred as approved; existing ticket conversations remain available |

Normal data was not seeded, provisioned or migrated. No dependencies were added. Existing roles, canonical User URLs, resident compatibility, reporting, priority, links, assignments, account controls, evidence and archive/restore remain in the regression suite.

## B. Files changed

The owner committed part of the implementation during the session/environment transition. The working-tree diff alone is not the complete feature: starting HEAD was `01d77d9`, later observed HEAD `1c8b7f7`. The agent did not stage or commit.

| Files | Purpose |
|---|---|
| `server/models/Ticket.js`, `models/ticketWorkflowSchemas.js` | Optional request/status-history subdocuments and workflow version |
| `server/models/CommunicationQuota.js`, `config/communicationLimits.js` | Persistent rolling account quota and configurable thresholds |
| `server/utils/{requestPolicy,ticketLifecycle,communicationLimits}.js` | Daily eligibility, historical reversal, validation, conditional writes and limits |
| `server/controllers/requestController.js`, `routes/ticketRoutes.js` | Request, inbox, handling, appeal decision and reversal endpoints |
| `server/controllers/{ticketController,assignmentController,archiveController}.js`, `utils/assignmentLifecycle.js` | Forward history, backward-change bypass prevention, atomic notes, archive scope and coordinated lifecycle/assignment writes |
| `server/utils/ticketAccess.js` | Role-filtered requests/history and backend action eligibility |
| `client/src/pages/ActionCenter.jsx`, `components/TicketRequests/{TicketRequests,RequestHistory,ReversalPanel}.jsx` | Shared staff handling, User requests/history, Admin reversal/history |
| `client/src/api/requestApi.js`, `utils/ticketRequests.js` | API helpers, labels and retry feedback |
| `client/src/pages/{TicketDetails,MyTickets}.jsx`, `App.jsx`, `components/Layout/AppLayout.jsx`, `roles.css` | Protected routes/navigation, archived-dismissed access, origin-aware Back, drafts, stale-access guards and responsive styles |
| `server/tests/ticket-requests.test.js` | 22 new real HTTP/MongoDB eligibility, role, quota and race checks |
| `server/tests/notes-changes.test.js` | Conditional-write support in the isolated fixture; original assertions retained |
| `server/tests/helpers/testDatabase.js`, `tests/{dispatch-roles,seed-accounts}.test.js`, `scripts/test-server.js` | Optional strictly isolated standalone test-Mongo support and safe seed-output capture; normal default remains temporary MongoDB |
| `client/tests/{ticket-requests,ticket-requests-flow}.spec.js` | 13 interface/race checks and two full-stack workflows |
| `client/tests/frontend-contract.spec.js` | Explicitly include the approved Action Center in Employee navigation; retain forbidden-navigation checks |
| Discovery/design, plan, this report, Context handoff/status | Approved rules, execution record, manual guide and proof |

Removed the newly introduced temporary `client/tests/.update1.config.mjs`. Existing unrelated changes and Context deletions are preserved.

## C. Backend changes

Future status changes, including assignment-driven Pending to In Progress, append status events. Events record old/new status, actor, time, kind, reason, previous event and prior completion/archive values. Internal history is Admin-only.

`POST /api/tickets/:id/revert` requires Admin access, a reason and the immediately previous recorded Pending/In Progress status. Without recorded history, an explicitly labelled legacy correction permits In Progress to Pending, or Resolved/Dismissed to Pending/In Progress. No previous events are invented. Reopening clears current archive/completion markers but retains their old values in history, keeps an eligible assignee, clears an unavailable assignee with assignment history, and preserves notes/priority/links. Ordinary status updates reject backward/reopening changes that bypass the reason requirement. Existing forward actions and separate archive restoration remain supported.

The new endpoints reuse the existing ticket router:

- `POST /api/tickets/:id/requests`: User-only `{type,message}`; ownership, status, daily and unresolved-request checks.
- `GET /api/tickets/requests`: Admin/Employee inbox with type/state/literal title-or-ID search and pagination. Outstanding/unread counts cover the full authorized scope, independently of filters/page.
- `PATCH /api/tickets/:id/requests/:requestId`: staff actions `view`, `acknowledge`, `respond`, `decide`. A public response and request completion save together.
- `GET /api/tickets/my-tickets?archived=dismissed`: that owner's archived Dismissed reports. The existing default remains active reports.

Daily periods reset at midnight in Asia/Manila. An unresolved request blocks another of the same type across days. Completion still blocks a same-day repeat; a later day permits another if eligible. Follow-up/update messages are optional. Viewing, acknowledgement, unrelated notes, assignment and status changes never silently complete requests.

Appeals require an explanation and reuse existing evidence. There is one appeal per dismissal, including archives, no deadline and no second appeal after rejection for that dismissal. A later reopening/new dismissal permits a new appeal. Admin rejection records a public reason without changing ticket status; acceptance requires an explicit eligible reopening status and atomically saves decision, public response and reversal. A superseded appeal can be explicitly rejected after a manual reopening.

Limits live in `server/config/communicationLimits.js`; overrides must be positive integers:

| Environment variable | Default |
|---|---:|
| `BMIS_USER_NOTES_PER_MINUTE` | 5 per User/ticket |
| `BMIS_STAFF_NOTES_PER_MINUTE` | 20 per staff member/ticket |
| `BMIS_USER_SUBMISSIONS_PER_TEN_MINUTES` | 20 across tickets |
| `BMIS_STAFF_SUBMISSIONS_PER_TEN_MINUTES` | 100 across tickets |
| `BMIS_DUPLICATE_NOTE_SECONDS` | 60 |

Account limits include notes, new requests and public responses/decisions; a response counts once. View/acknowledgement does not consume communication quota. Identical trimmed text from the same author/ticket/visibility is suppressed. HTTP 429 includes `Retry-After`, `retryAfter` seconds and `nextAllowedAt`. MongoDB-backed rolling reservations and versioned ticket predicates enforce concurrency. No Redis, external notification service or replica set is required.

## D. Frontend changes and manual guide

1. **User:** open an owned Pending report and choose **Request follow-up**, or an In Progress report and **Request progress update**. Confirm the optional message. Request history distinguishes submitted, acknowledged and answered. Eligibility/next permitted time come from the backend; **Refresh details** reloads state.
2. **User:** choose **My Tickets → Archived dismissed**, open a Dismissed report and **Appeal dismissal**. Provide an explanation. The form identifies the ticket and uses existing evidence; history later shows the recorded decision/reason.
3. **Staff:** open **Action Center**, filter/search and **Review request**. Unread tracks viewing; outstanding tracks completion. Optionally acknowledge, then **Send response and complete** with a public answer.
4. **Admin:** review an appeal, choose **Accept and reopen** or **Reject appeal**, and provide a public reason. Acceptance also requires the reopening status. Employees cannot decide appeals.
5. **Admin:** open an eligible ticket, including one in Archive, then **Revert Status**. The dialog shows current status, eligible target and mandatory reason. Confirmation updates status and **Status History**.

Both staff roles share one inbox implementation with server-scoped results. Employees see only nonappeal requests on currently assigned, unarchived Pending/In Progress tickets; Admins cover unassigned/final/archived requests and appeals. Drafts survive ordinary failures. Denial clears restricted content/drafts and invalidates older responses. Back links preserve Action Center or archived-dismissed origin. BMIS colors, seal, Ant Design and persistent shell remain; 320px/375px layouts and keyboard forms are tested.

## E. Security verification and review

Real HTTP tests exercise direct role/ownership bypasses, invalid input, historical/legacy reversal, concurrent requests/responses, quota exhaustion and preserved records. Current assignment/archive/version are database-write predicates. Account eligibility is rechecked under the existing locks. Returned populated documents are reauthorized before serialization.

Review reproduced and corrected three privacy/access issues: Employee ticket projections included appeal/final-ticket request history; an empty refreshed inbox retained a revoked open request; and reassignment during the final populated response read could disclose newer private notes. Each now has focused proof. A loading spinner covering the modal Close button was also reproduced and corrected. The independent reviewer closed the fixes with no remaining material findings.

## F. Test results

| Verification | Result |
|---|---|
| Existing backend regressions | **72/72 passed** |
| New real HTTP/MongoDB cases | **22/22 passed** |
| Actual seed CLI/reseed cases | **2/2 passed**, isolated databases/credentials |
| Total backend/seed | **96/96 passed**, zero failures/skips |
| Client role contracts | **3/3 passed** |
| Production build | **Passed**, 3,092 modules, 16.48 seconds; existing bundle-size warning |
| Full browser suite | **86/86 passed**, original 71 plus 15 new, 406.74 seconds, exit 0, zero failed/skipped/flaky cases or runner errors |

The first full run was 78/83. It identified the approved navigation expectation, hidden Ant Design radio interaction, spinner overlap and Escape focus setup. These were corrected without removing scenarios/assertions. A focused run then passed 15/16 including both real full-stack workflows; its remaining Back-button accessible-name selector was corrected, and the complete archived-appeal scenario passed separately.

Initial child-process restrictions blocked test startup. After the user supplied the current execution environment, temporary MongoDB, Playwright and Vite ran normally; no runtime blocker remains. Final browser evidence is [update1-complete.json](../../client/test-results/update1-complete.json) with artifacts in `client/test-results/update1-complete/`. The full-stack User history screenshot was visually inspected. Test ports 5001/3001, temporary frontend port 3002 and the earlier isolated Mongo port 48174 are no longer listening. Normal API health and frontend HTTP 200 were checked at 5000/3000. No acceptance-test upload remains; normal uploads were preserved.

Commands used for final verification:

```powershell
node --test --test-isolation=none server/tests/audit-repairs.test.js server/tests/notes-changes.test.js server/tests/ticket-search.test.js server/tests/dispatch-roles.test.js
node --test server/tests/ticket-requests.test.js
node --test server/tests/seed-accounts.test.js
node --test client/tests/role-contract.test.js
Set-Location client
$env:PLAYWRIGHT_JSON_OUTPUT_NAME='test-results/update1-complete.json'
npm test -- --output=test-results/update1-complete --reporter=list,json
npm run build
```

## G. Outstanding decisions and scope

Operator contact is deferred as approved. No product decisions remain. No contact details, operator role or emergency-response promise were invented.

The documented single-process account/assignment coordination remains. Persistent request/quota predicates are atomic in MongoDB; cross-process account transitions would still need shared coordination beyond the current process-local locks. Inbox updates load on navigation/refresh and after actions; no real-time delivery is claimed.

## H. Documentation and cleanup

The approved discovery/design, plan, this report, current handoff and project-status entry record the feature. Historical audit/revamp entries remain history. Tests use temporary data and ports 5001/3001; normal services/data and credentials stay separate. The temporary frontend configuration was removed. Automatic approval review rejected deletion of the unused `server/.local-data/update1-test-mongo-88737cbc3b1947109ea8969d6d42dcee/` directory with "blocked by policy"; this ignored temporary directory remains, with no active process using it. No normal seeding, provisioning, password reset, dependency installation, Git reset/clean, staging or agent commit occurred.
