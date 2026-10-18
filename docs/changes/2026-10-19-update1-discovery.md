# Update 1 discovery and decision checkpoint

19 October 2026. Source request: `Context/Updates/update1.md`.

Status: the owner approved all recommended defaults and explicitly authorized implementation on 19 October 2026. The findings below are the approved design basis. Implementation and fresh verification are tracked in `docs/superpowers/plans/2026-10-19-update1.md`.

## Current architecture and reusable behavior

- The actual stack matches the request: React 18, Vite 5, Ant Design 5, Express 4, Mongoose 8, MongoDB and JWT. Package manifests are `client/package.json` and `server/package.json`.
- `server/models/Ticket.js` owns the four ticket statuses, assignment history, notes, archive state, and resolution/dismissal timestamps. It has no status-history ledger or request/appeal records.
- `server/controllers/ticketController.js` and `server/routes/ticketRoutes.js` provide status changes, public/internal messages, ownership-scoped detail/list access, priority and linking. The status API currently accepts any of the four status values; the UI offers forward actions only. Adding a dedicated reversal endpoint alone would leave a reason-free backward-change path in the ordinary status endpoint.
- `server/controllers/assignmentController.js` moves Pending to In Progress on assignment and preserves assignment history. This implicit status change must also enter the new status history.
- `server/controllers/archiveController.js` archives final tickets and restores them without changing status/completion time. New resolution automatically archives; dismissal remains manually archived. Restore rechecks Employee eligibility and clears unavailable assignees with history.
- `server/middleware/authMiddleware.js` reloads current account role/activity on every protected request. `server/utils/ticketAccess.js` centralizes role-aware ticket access and serialization. Canonical roles remain Admin, Employee and User, with the existing resident compatibility alias and routes.
- Employees can read and update only their currently assigned, unarchived tickets. This predicate does not itself exclude an unarchived Dismissed ticket, but it gives no authority to decide appeals or change status. Users can open their own archived ticket by ID; `getMyTickets` excludes all archived tickets from the list.
- Public updates, User replies and internal notes already share the ticket notes array, with server-selected kind/author role and filtered responses. These are suitable for answering requests. Request completion should reference a public note rather than duplicate the communication system.
- `client/src/pages/TicketDetails.jsx`, `components/AssignmentPanel/AssignmentPanel.jsx`, `pages/MyTickets.jsx`, `components/Layout/AppLayout.jsx`, `App.jsx`, the existing API helpers, and scoped `roles.css` provide the extension points. Preserve their route identity/access-revocation guards and responsive Ant Design patterns.
- There is no persistent notification inbox, unread/request state, application rate-limit utility, or approved numerical messaging policy in the inspected implementation/documentation. Existing UI messages are transient feedback. Email notifications remain a separate backlog item.
- There is no operator role, verified public operator contact directory, or direct messaging subsystem. Ticket conversations already exist.

The requested `Context/BMIS session handoff.md` is not present. The current authoritative replacement is `Context/SESSION_HANDOFF.md`, already restored. Older ledger/report test failures are historical; the latest saved result remains 74 backend/seed checks and 71 browser scenarios passing. Discovery did not repeat those tests or the audit.

## Owner decisions — all recommended defaults approved

| # | Area | Recommendation requiring confirmation |
|---|---|---|
| 1 | Daily requests | Use calendar days in Asia/Manila. Allow at most one request of each applicable type per ticket per local day, and prevent another of the same type while an earlier one is unresolved. A completed request may be submitted again on a later day if the ticket is still eligible. Follow-up/update messages are optional; appeal explanations are required. |
| 2 | Communication limits | For Users: 5 notes/minute per ticket and 20 communication submissions/10 minutes across tickets. For Admins/Employees: 20 notes/minute per ticket and 100 communication submissions/10 minutes across tickets. The account-wide quota includes notes, new requests, and request responses; a response written as a note is counted once. Suppress identical note text by the same author on the same ticket with the same visibility for 60 seconds. Return retry information for quota exhaustion. These are proposed configurable starting values, with higher staff capacity for case handling; no measured usage policy exists. |
| 3 | Reversal and older tickets | Restore the immediately previous recorded status when it is Pending or In Progress. Require a reason, preserve every event, and route backward/reopening changes through this action. For existing tickets without recorded history, offer an explicitly labelled legacy correction: In Progress may return to Pending; Resolved/Dismissed may return to Pending or In Progress. Never invent past events. Reopening clears archive/current completion fields while preserving their former values in the new history event. Retain a currently eligible assignee; clear an unavailable assignee using the existing restore policy. Priority, links and messages remain intact. |
| 4 | Appeals | One appeal per dismissal occurrence, including archived Dismissed tickets; no submission deadline. No second appeal after rejection for that same dismissal. A later reopening and new dismissal permits a new appeal. Require a written explanation, reuse the ticket's existing evidence, and initially accept no new appeal attachments. An Admin accepts with a public decision reason and explicitly confirms the eligible reopening status; the decision and audited reversal save together. Rejection records a public reason without changing ticket status. Include an archived-dismissed view within My Tickets so owners can reach eligible reports. |
| 5 | Staff routing | Use Option A from the request. Admins see all requests and handle unassigned/final/archived cases and every appeal. Employees see follow-up/update requests only while the ticket is currently assigned to them, unarchived, and Pending/In Progress. Routing follows current assignment and eligibility; reassignment does not leave access with the former Employee. Reuse one underlying request source and a shared Action Center page for both staff roles. |
| 6 | Handling and counts | Track viewing separately from handling. Offer explicit acknowledgement. A follow-up/update completes only through a public response linked to that request using a clear Send response and complete action; ordinary unrelated notes, internal notes, viewing, assignment and status changes do not silently complete it. Appeals complete through an Admin decision. Show distinct unread and outstanding counts. Load on navigation, refresh after mutations, and provide Refresh using the existing request/response pattern. |
| 7 | Optional operator feature | Defer it for this update. Existing ticket conversations remain available. A later contact panel is the smallest compatible addition once the owner provides verified contact details and approves the scope. |

Alternative daily policy: rolling 24 hours. Alternative reversal scope: choose among earlier recorded active statuses. Alternative appeal policy: owner-specified deadline/attempt limit. The implementation must follow the owner's answers rather than silently adopting this table.

## Proposed data and API design

Extend the existing Ticket document with optional status-history and request subdocuments. Older records remain readable without a bulk backfill. Record future explicit status changes and assignment-driven status changes; keep legacy correction events distinguishable from known historical transitions.

Each request contains an ID, type, requester, creation time, optional message/required appeal explanation, handling state, viewing/acknowledgement metadata, response-note reference or appeal decision, handler/time, and handling history. Appeal decisions reference the dismissal occurrence and any resulting reversal. Derive inbox items and counts from these records instead of maintaining a separate notification copy.

Use MongoDB conditional atomic updates for ownership, current status, request period, unresolved-request exclusion and completion/reversal. Request acceptance, linked public response and handling state should update in one ticket write where applicable. Continue the existing account/ticket lock coordination for assignment eligibility; persistent daily/duplicate rules must also be enforced in database predicates. No replica-set requirement is introduced.

Keep communication thresholds in one documented configuration module. Use MongoDB-backed atomic window counters where an account-wide limit spans tickets, and enforce ticket-local duplicates with the ticket write. Apply authentication/eligibility checks before communication quota handling. Do not introduce Redis or another service.

Add small request/lifecycle controller and policy modules rather than growing TicketDetails or the current ticket controller indefinitely. Add protected request creation/handling/list APIs and an Admin-only reversal API to the existing routing structure. Reuse existing error envelopes, API clients, account checks, note serializer and role guards.

User responses expose only their own request explanations, public handling state, public responses and appeal decisions. Internal reversal reasons, staff viewing metadata, internal notes and staff-only audit details stay filtered. Employee reads and writes recheck current assignment/archive/account eligibility; stale frontend responses must not restore revoked content.

## Planned module changes

| Area | Expected files/modules |
|---|---|
| Persistence and policies | Extend `server/models/Ticket.js`; add shared request/lifecycle and configurable communication-limit utilities plus a small rate-window model if required for account-wide quotas |
| API | New focused request/reversal controllers; extend ticket routes and server route mounting; update current status, assignment, archive and note writes where shared lifecycle/atomicity requires it |
| Privacy and access | Extend `server/utils/ticketAccess.js`; reuse existing authentication, roles and account-transition coordination |
| User interface | Contextual request actions/history in TicketDetails; archived-dismissed reachability in MyTickets if approved |
| Staff interface | Shared Action Center with role filtering, request type/state filters, pagination, counts and permitted ticket links; Admin reversal dialog/history; existing public-note composer integration |
| Frontend integration | App routes, persistent layout navigation, API helpers and scoped responsive styles |
| Verification/documentation | New focused lifecycle/request integration and browser cases; retain prior cases; update delivery report, SESSION_HANDOFF and current project-status entries |

## Ordered implementation and testing checkpoints

1. Resolve the table above and record the approved rules. Finalize the design and execution plan using the existing modules.
2. Add backward-compatible schemas, authorization/projection helpers, lifecycle history and atomic safeguards. Test old documents, ownership, forged inputs and concurrent writes against isolated MongoDB.
3. Implement Admin reversal and its dialog/history. Test reason validation, allowed/invalid transitions, legacy correction, API bypass denial, timestamps, archive/assignment interactions, and preserved notes/links/priority.
4. Implement Pending follow-up, then In Progress update requests, then appeals. Validate each workflow before proceeding. Cover confirmed day boundaries, unresolved/repeat policy, status changes during submission, request completion, and atomic appeal acceptance/reopening.
5. Apply configurable rate/duplicate protections to existing messages and the new workflows. Test thresholds, retry timing, independent identities/tickets, concurrent duplicate calls, and normal public/internal note behavior.
6. Integrate the shared staff Action Center, scoped counts/filtering, request handling, User history, and any approved archive discoverability. Test reassignment/deactivation races, viewing versus completion, navigation and 320px/375px layouts.
7. Run all existing backend/seed and client role checks, all browser scenarios plus the new cases, and the production build. Check browser/server errors and final changed-file scope. Document actual results and cleanup only test-owned artifacts.

Normal services were observed listening on 27017/5000/3000 during discovery; test ports 5001/3001 were free. The existing test launcher creates a temporary MongoDB and uses 5001/3001. Preserve that isolation and the normal credential file. No normal seeding, provisioning, account creation, migration, reset, staging or commit is part of this task.

## Workspace at checkpoint

HEAD: `01d77d9`. Pre-existing changes: modified `Context/SESSION_HANDOFF.md` and `docs/changes/2026-10-19-seed-accounts.md`, deleted `Context/majorrevamp.md`, and untracked `Context/Updates/`. Preserve them. This discovery report is the only new file written for Update 1 at this checkpoint.
