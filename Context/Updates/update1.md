# BMIS: Ticket Lifecycle Enhancements, Resident Requests, and Employee Action Center

## MASTER IMPLEMENTATION INSTRUCTIONS FOR CODING AGENT

**Project:** Barangay Incident & Hazard Reporting System (BMIS)  
**Workspace:** `C:\PROJECTS\BMIS`  
**Target Client:** Barangay Baclaran, Parañaque City  
**Existing Roles:** Admin, Employee, Resident  
**Previously Established Stack:** React 18, Vite, Ant Design, Express, Mongoose/MongoDB, JWT. Verify against the actual repository before implementation.

---

# 1. PRIMARY OBJECTIVE

Enhance the existing BMIS ticket management system with additional accountability, communication, and administrative control mechanisms.

The enhancements must provide:

1. Admin-only ticket status reversal.
2. Rate limiting for ticket notes, updates, and applicable resident requests.
3. Resident follow-up requests for Pending tickets.
4. Resident update requests for In Progress tickets.
5. Resident appeals for Dismissed tickets.
6. A unified Employee Action Center for handling relevant requests.
7. An optional Barangay Operator contact or escalation feature.

**These are enhancements to the existing BMIS, not instructions to rebuild it.**

Your responsibility is to integrate the features into the current architecture while preserving existing functionality, data integrity, security controls, and user experience.

## Non-negotiable instruction

**DO NOT ASSUME THAT SOMETHING IS MISSING, IMPLEMENTED, OR STRUCTURED A CERTAIN WAY WITHOUT VERIFYING THE REPOSITORY.**

Do not invent existing components, collections, routes, APIs, permission systems, ticket statuses, or workflows.

If a required behavior is unclear, first inspect the implementation and its documentation.

If uncertainty remains and materially affects the implementation, ask the project owner a specific question before making that decision.

Do not ask questions that can be answered by inspecting the repository.

---

# 2. MANDATORY PROJECT DISCOVERY

## 2.1 Read project documentation first

Before modifying any code, read:

- `Context/BMIS session handoff.md`
- `Context/PROJECT_STATUS.md`, if available.
- Existing documentation covering login, roles, priorities, ticket management, notifications, and dashboard behavior.
- Related documentation discovered during inspection.

Preserve all previously completed audit fixes, including `AUD-01` through `AUD-09`, the four login/role/priority notes, and the six dashboard/navigation/archive notes described in the previous implementation handoff.

Inspect the current Git state and all uncommitted work.

Do not assume an earlier commit is still the current HEAD.

**Never execute destructive commands such as:**

- `git reset`
- `git clean`
- `npm run seed` against normal development data
- Commands that discard uncommitted work.
- Commands that wipe or recreate existing databases without explicit authorization.

Do not overwrite working features merely because a different implementation would be easier.

## 2.2 Inspect the existing system

Identify how the project currently implements:

| Area             | Investigation required                                      |
| ---------------- | ----------------------------------------------------------- |
| Ticket model     | Fields, references, statuses, timestamps, history           |
| Ticket lifecycle | Creation, assignment, progress, resolution, dismissal       |
| Role permissions | Admin, Employee, Resident access and restrictions           |
| Notes            | Visibility, author identity, storage, existing limits       |
| Updates          | Status updates, comments, activity logs, public updates     |
| Notifications    | Existing notification storage, events, UI, unread behavior  |
| Dashboards       | Role-specific pages, navigation, ticket components          |
| Authentication   | JWT middleware, user identification, authorization          |
| Archives         | Archived ticket permissions and restoration rules           |
| Testing          | Existing automated tests, fixtures, development conventions |

Look for reusable implementations before introducing new abstractions.

## 2.3 Confirm existing role boundaries

Previous project instructions established these responsibilities:

**Admin**

- Assigns and reassigns tickets.
- Controls priority and ticket linking.
- Manages archives.
- Controls final Resolved and Dismissed actions.
- Has broader administrative ticket access.

**Employee**

- Works with authorized, assigned active tickets.
- Can post permitted notes or progress updates.
- Cannot access admin-only operations.
- Cannot independently perform final administrative actions.

**Resident**

- Creates and views their own tickets.
- Has ticket visibility restricted to their own records.
- Cannot perform staff or administrative actions.

Verify these permissions remain accurate.

Do not expand employee permissions simply to make the new notification interface work.

**Important discovery checkpoint:**

Pending tickets may be unassigned, while Dismissed tickets may be considered closed or archived.

Therefore, giving employees universal access to these tickets could violate existing permissions.

Identify this conflict and propose an authorized handling workflow before implementation.

---

# 3. FEATURE 1: ADMIN-ONLY TICKET STATUS REVERSAL

## 3.1 Objective

Allow an administrator to reverse a ticket's status when an incorrect status change occurs.

Examples include:

- A ticket was mistakenly marked Resolved.
- A ticket was incorrectly Dismissed.
- A ticket was moved forward accidentally.
- A legitimate processing mistake requires an earlier status to be restored.

These are examples of intended behavior, not permission to invent new status transitions.

## 3.2 Required behavior

1. Only an authenticated, authorized Admin may reverse ticket statuses.
2. Employees and Residents must never be able to invoke this action.
3. The Admin must select or confirm the appropriate previous status.
4. A reason for the reversal must be mandatory.
5. The system must preserve the original status history.
6. Reversal must not erase previous notes, assignments, updates, or audit events.
7. The system must display the resulting correct status.
8. Relevant users should see the updated status through the project's existing notification or update mechanisms, where applicable.

## 3.3 Status reversal rules

Inspect how the existing system stores ticket status changes.

Prefer restoration to a valid historical status rather than arbitrary assignment to any status.

Example:

`Pending → In Progress → Resolved`

An administrator discovers that the ticket was resolved accidentally and reverses its status to `In Progress`.

The system records the reversal as a new event. It does not delete the original resolution event.

Do not automatically permit invalid reversals.

Determine how reversal interacts with:

- Employee assignment.
- Ticket priority.
- Linked tickets.
- Archive status.
- Resolved or Dismissed timestamps.
- Existing notifications.
- Status-dependent actions.
- Historical reporting.

If reopening requires unarchiving, reassignment, or other side effects, verify the project's intended behavior before implementing them.

Reversing status is not equivalent to reversing every change ever made to the ticket.

## 3.4 Audit requirements

Every reversal should retain:

- Ticket identifier.
- Original status.
- Restored status.
- Admin identifier.
- Reason.
- Timestamp.
- Relevant historical status event, where available.

The event should be visible in an appropriate authorized activity history.

Do not expose internal-only administrative details to Residents unless the existing visibility model permits it.

## 3.5 Interface requirements

Integrate this action into the existing Admin ticket detail interface.

Use a clearly identified action such as **Revert Status**.

When selected, display a confirmation dialog showing:

- Current ticket status.
- Available valid restoration options.
- Required reason.
- Confirmation and cancel actions.

Hide the action from Employee and Resident interfaces.

Backend authorization must still independently enforce Admin-only access.

**Acceptance criteria:** An Admin can reverse an eligible ticket safely with an audit record, while an Employee or Resident cannot perform the reversal even by directly calling the API.

---

# 4. FEATURE 2: RATE LIMITING FOR NOTES AND UPDATES

## 4.1 Objective

Prevent spam, excessive requests, and accidental repeated submissions without disrupting legitimate ticket handling.

This must work at the backend level, not only through disabled frontend buttons.

## 4.2 Inspect existing functionality

Before modifying anything, identify:

- What qualifies as a ticket note.
- What qualifies as an update.
- Whether notes are internal, public, or both.
- Which roles can create each kind.
- Whether existing rate limiting is already implemented.
- Whether existing endpoints share controllers or services.

Do not combine distinct note or update types if doing so would alter their permissions or visibility.

## 4.3 Required protections

Introduce suitable limits for applicable note and update creation operations.

Evaluate:

- Per-user limits.
- Per-ticket limits.
- Short-window burst protection.
- Repeated identical submissions.
- Accidental double-clicks.
- Concurrent submissions.
- Excessive requests from authenticated or unauthenticated clients, depending on endpoint exposure.

Use the existing middleware or service conventions where possible.

Do not invent numerical thresholds without checking for an existing policy or configuration.

If none exists, propose configurable thresholds for approval.

## 4.4 Expected behavior

When the limit is reached:

1. Reject the restricted submission on the server.
2. Return an appropriate error, such as HTTP `429 Too Many Requests`.
3. Include an appropriate retry indication when available.
4. Show a user-friendly message.
5. Preserve already submitted notes and updates.
6. Do not create a duplicate record or notification.

Example frontend message:

"You've reached the limit for this action. Please try again later."

Prevent rapid repeated submissions caused by double-clicking or network retries.

Do not rely exclusively on debouncing, because an attacker can bypass frontend controls.

## 4.5 Implementation guidelines

Prefer existing rate-limit utilities, configuration patterns, and error handlers.

Do not introduce Redis or another infrastructure dependency solely for this feature unless existing architecture or deployment requirements justify it.

Consider whether a shared limit is appropriate for different roles. Legitimate employee case handling may require a different policy from resident-generated requests.

All limits should be defined in a discoverable, configurable location and documented.

**Acceptance criteria:** Repeated submissions are appropriately restricted, duplicate writes are prevented where necessary, existing notes remain intact, and normal authorized usage continues to work.

---

# 5. FEATURE 3: RESIDENT FOLLOW-UP REQUESTS FOR PENDING TICKETS

## 5.1 Objective

Allow Residents to request attention on their own Pending tickets.

A Resident should not have to submit another incident report merely to ask whether their existing report has been reviewed.

## 5.2 Eligibility

A follow-up request must be allowed only when:

- The requester is authenticated.
- The ticket belongs to the requester.
- The ticket's current status is Pending.
- The applicable request frequency limit has not been exceeded.

The requested limit is **once per day per eligible ticket**.

Before implementing this, confirm whether "once per day" means:

- One request per calendar day in the configured barangay timezone; or
- One request per rolling 24-hour period.

Do not silently choose one interpretation.

## 5.3 Resident interface

Within the existing Resident ticket detail page, provide an action such as:

**Request Follow-Up**

The action must:

1. Appear only when the ticket is eligible.
2. Allow the Resident to initiate a follow-up.
3. Use a confirmation step where appropriate.
4. Submit the request to the backend.
5. Provide clear success or failure feedback.
6. Reflect whether another request is currently allowed.

A message or reason may be supported if consistent with the existing UI, but do not assume one is required.

If a request has already been made within the restricted period, show an explanation instead of permitting another submission.

The backend must still reject ineligible or repeated requests.

## 5.4 Data and workflow

The request should identify:

- Ticket.
- Requesting Resident.
- Request type.
- Creation time.
- Current handling state, if the system supports tracking.
- Relevant associated responses or actions.

Do not automatically change the ticket's main status.

A Pending ticket remains Pending until an authorized workflow changes it.

A follow-up request is not a new incident ticket.

## 5.5 Notification routing

The request must become visible to the appropriate authorized personnel.

If Pending tickets have no assigned Employee, do not expose all Pending tickets to every Employee to satisfy this requirement.

Determine whether the request should initially be handled by an Admin or routed through an existing authorized assignment mechanism.

**Acceptance criteria:** An eligible Resident can follow up on their own Pending ticket once per configured daily period, and the appropriate authorized staff can see and process the request.

---

# 6. FEATURE 4: RESIDENT UPDATE REQUESTS FOR IN PROGRESS TICKETS

## 6.1 Objective

Allow Residents to request progress information on tickets currently being processed.

This is different from a Pending follow-up.

A follow-up asks for attention or review; an update request asks about work already in progress.

## 6.2 Eligibility

Allow the request only when:

- The Resident is authenticated.
- The Resident owns the ticket.
- The ticket is currently In Progress.
- The daily frequency restriction is satisfied.

Requested limit: **once per day per eligible ticket**.

Use the same confirmed definition of "per day" as the follow-up feature unless the project owner explicitly specifies otherwise.

## 6.3 Resident interface

Display a contextual action such as:

**Request Progress Update**

On successful submission, show an appropriate confirmation.

The Resident should be able to understand that a request has been submitted without assuming that staff have already responded.

## 6.4 Employee handling

If the ticket is assigned to an Employee authorized to handle it, the request should appear in that Employee's Action Center.

The Employee should be able to:

1. Open the ticket.
2. Review the request.
3. Review relevant existing ticket information.
4. Provide an update using the system's authorized update mechanism.
5. Complete the request-handling action when appropriate.

Avoid implementing a duplicate progress-update system if a suitable mechanism already exists.

The update request itself must not alter the ticket status.

## 6.5 Request completion

Separate these concepts:

- Request submitted.
- Request viewed.
- Request acknowledged.
- Request answered or handled.

Simply viewing a request must not automatically mean it has been fulfilled.

Reuse existing workflow states where possible.

**Acceptance criteria:** Residents can request progress updates on eligible In Progress tickets, the correct Employee can receive them, and the response can be handled without unauthorized status changes.

---

# 7. FEATURE 5: RESIDENT APPEALS FOR DISMISSED TICKETS

## 7.1 Objective

Give Residents a formal mechanism to challenge the dismissal of their own tickets.

An appeal allows an authorized reviewer to reconsider a dismissed case.

It must not automatically overturn the original administrative decision.

## 7.2 Eligibility

The appeal action must be restricted to:

- Authenticated Residents.
- Tickets owned by that Resident.
- Tickets currently eligible for appeal under the system's Dismissed status rules.

If archived tickets behave differently, inspect those rules before implementation.

## 7.3 Appeal interface

Provide a contextual action such as:

**Submit Appeal**

The appeal form should contain:

- Ticket reference.
- Required appeal explanation.
- Existing relevant ticket information, without forcing duplicate entry.
- Confirmation action.

If the current system supports attachments, determine whether appeals may reuse that capability. Do not create an attachment service just for appeals without approval.

Show the appeal's actual recorded state to the Resident.

## 7.4 Appeal handling

An appeal should be tracked independently of the main ticket status.

Possible workflow:

1. Resident submits appeal.
2. Appeal is recorded.
3. Authorized reviewer receives it.
4. Reviewer examines the appeal and ticket history.
5. Reviewer accepts or rejects the appeal.
6. The decision and reason are recorded.
7. Resident receives the appropriate result.

These stages describe the required behavior. Reuse existing states and workflow infrastructure wherever suitable.

Do not introduce new statuses unnecessarily.

## 7.5 Administrative authority

The current BMIS role design reserves final ticket status authority for Admins.

Therefore:

- Employees must not independently reverse Dismissed status.
- Employees may assist with review only if expressly authorized.
- Final appeal decisions should follow existing administrative authority.
- Acceptance must not automatically cause an unsafe or undocumented status transition.

An accepted appeal may lead to administrative reopening or reversal using Feature 1, but the exact behavior must be confirmed.

## 7.6 Appeal restrictions

The user has not specified:

- Maximum appeals per ticket.
- Whether multiple appeals can be simultaneously active.
- Whether rejected appeals may be appealed again.
- Whether appeals are allowed indefinitely after dismissal.

Inspect the existing project for governing rules.

If none are present, propose a clear policy rather than silently implementing unlimited appeals.

A reasonable design to evaluate is preventing multiple simultaneous unresolved appeals while preserving prior appeal history.

Do not make that policy mandatory without approval.

**Acceptance criteria:** A Resident can appeal an eligible Dismissed ticket, authorized personnel can review the appeal, all decisions are recorded, and only authorized administrative operations can alter final ticket status.

---

# 8. FEATURE 6: UNIFIED EMPLOYEE ACTION CENTER

## 8.1 Objective

Provide Employees with one consolidated location to view and handle requests requiring their attention.

This must not become a second, disconnected ticket management system.

Suggested interface name:

**Action Center**

Alternative: **Ticket Requests**

Follow existing dashboard terminology and visual conventions.

## 8.2 Request categories

The Action Center should consolidate these three request types:

| Category       | Source ticket state | Purpose                                |
| -------------- | ------------------- | -------------------------------------- |
| Follow-Up      | Pending             | Resident requests review or attention  |
| Update Request | In Progress         | Resident requests progress information |
| Appeal         | Dismissed           | Resident contests ticket dismissal     |

Use a shared presentation system with recognizable request categories.

Do not flatten their distinct business rules.

## 8.3 Interface layout

Integrate the Action Center into the existing Employee navigation.

Potential interface elements:

- Total actionable request count.
- Category filters.
- Unread or unacknowledged indicator.
- Ticket reference.
- Request type.
- Submission time.
- Requesting Resident information, only as authorized.
- Ticket status.
- Request handling state.
- Link to the permitted ticket detail or review interface.

Use the existing Ant Design components or equivalent project conventions, after verification.

Do not duplicate dashboard navigation or create unnecessary standalone pages.

## 8.4 Suggested interaction

When an Employee opens a request:

1. Display the relevant request details.
2. Provide a link to the appropriate authorized ticket view.
3. Allow the Employee to take only permitted actions.
4. Reflect handling progress.
5. Update the actionable count when the request is genuinely handled.
6. Preserve the original request and handling history.

Distinguish between:

- Unread.
- Viewed.
- Pending action.
- Completed.

An unread indicator is not the same as an unresolved request count.

## 8.5 Critical permissions conflict

The existing system limits Employees to assigned active tickets.

However:

- Pending tickets may be unassigned.
- Dismissed tickets may be final or archived.
- Appeals may require Admin authority.

**Do not solve this by globally expanding Employee ticket access.**

During discovery, determine which arrangement is compatible with the project:

**Option A: Permission-preserving routing**

The Employee Action Center shows only requests the Employee is authorized to handle. Requests on unassigned Pending tickets and final Dismissed tickets go to an appropriate Admin queue.

**Option B: Explicitly authorized request review**

Specific request-related access is granted to authorized Employees without providing unrestricted control of the underlying tickets.

Option B is a permission model change and requires project owner approval.

Do not assume a new operator role or elevated Employee privileges are permitted.

## 8.6 Notifications

Inspect the project's existing notification implementation.

Reuse it where practical.

When a request is created:

- Record the request.
- Route it to authorized personnel.
- Show it in the unified interface.
- Update the appropriate count.
- Avoid duplicate notifications during retries.

Avoid introducing WebSockets, push notification services, polling frameworks, or third-party services without a demonstrated need.

If real-time functionality already exists, integrate with it.

Otherwise, recommend the least disruptive approach consistent with existing patterns.

## 8.7 Admin visibility

Since some requests require Admin decisions, determine whether the existing Admin dashboard should receive a corresponding request-management view.

Prefer reuse of the same underlying request handling logic with role-based filtering.

Do not create competing data sources for Employee and Admin request management.

**Acceptance criteria:** Authorized Employees have one coherent place to process their actionable requests, while requests requiring Admin authority remain accessible through an authorized administrative workflow.

---

# 9. FEATURE 7: OPTIONAL BARANGAY OPERATOR CONNECTION

## 9.1 Objective

Explore a way for Residents to contact an appropriate Barangay Operator or authorized staff member regarding their ticket.

This is an optional enhancement and must not block the core features.

## 9.2 Discovery requirements

First determine whether BMIS already includes:

- Direct messaging.
- Ticket conversations.
- Public contact details.
- A support or assistance module.
- Operator assignments.
- Existing staff communication functionality.

Do not create a separate chat architecture if the current system already supports a suitable mechanism.

## 9.3 Possible implementation approaches

Evaluate these approaches according to what already exists.

**Approach A: Contact Information Panel**

Display verified official contact information with a suitable link or contact action.

This is likely the simplest option.

Do not invent phone numbers, email addresses, or operating hours.

**Approach B: Ticket-Based Contact Request**

Allow a Resident to request contact or assistance through their existing ticket.

Route that request using authorized staff workflows.

This may be appropriate if the new Action Center can support an additional request type without introducing excessive complexity.

**Approach C: Direct Messaging**

Provide two-way communication between authorized Barangay personnel and the Resident.

Implement this only if the project owner explicitly approves the added scope and the architecture supports it.

Consider privacy, retention, staff availability, abuse prevention, and permissions.

## 9.4 Important boundaries

Do not:

- Invent a new Operator role.
- Automatically grant Employees additional ticket access.
- Assume an operator is always online.
- Implement a full live-chat service without approval.
- Present contact functionality as guaranteed emergency response.
- Introduce external messaging integrations without approval.

For actual emergencies, any displayed instructions or contacts must be verified and approved for the barangay.

**Acceptance criteria:** Present an architecture-compatible recommendation and implement only the approved contact mechanism.

---

# 10. SHARED BACKEND DESIGN

## 10.1 Reuse existing architecture

Before creating new collections, models, controllers, routes, hooks, or services, identify the existing systems that can support these features.

Do not duplicate existing functionality.

A shared request representation may be appropriate for:

- Follow-up requests.
- Progress update requests.
- Appeals.

However, select the actual storage design only after inspecting current ticket, activity, and notification models.

## 10.2 Conceptual request data

Any design should be able to represent:

| Information          | Purpose                              |
| -------------------- | ------------------------------------ |
| Request ID           | Unique request reference             |
| Ticket reference     | Associated ticket                    |
| Request type         | Follow-up, update, or appeal         |
| Requester            | Resident who submitted               |
| Creation time        | Submission tracking                  |
| Message or reason    | Relevant explanation, if applicable  |
| Handling state       | Whether action remains outstanding   |
| Handler              | Authorized staff member, if assigned |
| Response or decision | Recorded outcome                     |
| Handling time        | Audit and tracking                   |

This is a **conceptual requirement list, not a mandatory database schema**.

Map these fields to existing storage where possible.

Avoid excessive denormalization, duplicated counters, or unnecessary collections.

## 10.3 Server-side eligibility

The server must independently verify:

- Authentication.
- Role.
- Ticket ownership.
- Ticket visibility.
- Current ticket status.
- Request eligibility.
- Rate-limit eligibility.
- Handler permissions.
- Administrative privileges.

Never trust client-supplied owner identifiers, role names, status values, or eligibility flags.

## 10.4 Concurrency and duplicate prevention

Prevent duplicate submissions from:

- Double-clicking.
- Browser retries.
- Repeated API calls.
- Two active browser sessions.
- Concurrent requests.

The once-per-day rule must remain correct even if two requests reach the server nearly simultaneously.

Use a suitable atomic write, constraint, or other race-safe pattern compatible with the existing MongoDB design.

An in-memory frontend timer is insufficient.

If multiple server instances are supported, do not rely on instance-local memory as the only protection for persistent business rules.

## 10.5 Errors

Use existing API response conventions.

Distinguish:

- Unauthenticated.
- Unauthorized.
- Ticket not found or inaccessible.
- Ticket ineligible because of status.
- Request already submitted.
- Rate limit exceeded.
- Invalid input.
- Server error.

Avoid leaking private ticket existence through error messages.

Make error messages understandable to the relevant user.

## 10.6 Data preservation

Never overwrite ticket history to represent a new request.

Do not automatically remove existing notes or updates when a ticket is reopened.

Maintain a clear relationship between original ticket activity, resident requests, staff responses, administrative decisions, and status changes.

Use transactions where supported and appropriate, or another safe consistency strategy where transactions are not available.

---

# 11. FRONTEND AND USER EXPERIENCE REQUIREMENTS

## 11.1 Follow the existing design system

Inspect existing reusable:

- Buttons.
- Status indicators.
- Modals.
- Forms.
- Notifications.
- Navigation.
- Ticket cards.
- Ticket details.
- Responsive layouts.

Use them before creating new components.

Do not introduce an unrelated visual theme.

## 11.2 Context-aware Resident actions

Ticket action availability should be derived from actual backend state.

Expected behavior:

| Ticket status | Resident action                      |
| ------------- | ------------------------------------ |
| Pending       | Request Follow-Up                    |
| In Progress   | Request Progress Update              |
| Dismissed     | Submit Appeal                        |
| Resolved      | No new action specified by this task |

Do not assume these actions are the only actions a ticket can have.

Preserve existing permitted actions.

Do not automatically add an appeal mechanism for Resolved tickets.

## 11.3 Helpful interface feedback

Provide clear messages for:

- Request successfully submitted.
- Request cannot currently be submitted.
- Daily limit reached.
- Ticket status changed before submission.
- Request already exists.
- Appeal successfully recorded.
- Server or network error.

Use loading states to reduce accidental duplicate submission.

Do not display a successful submission until the backend confirms it.

## 11.4 Request history

Where appropriate, show Residents their own request history and responses within the existing ticket detail experience.

Avoid adding a separate Resident request dashboard unless justified.

The Resident should be able to tell the difference between submitting a request and receiving a response.

## 11.5 Responsiveness and accessibility

Preserve usable layouts across desktop and mobile screen sizes.

Use semantic labels, keyboard-accessible dialogs, meaningful status text, and accessible color contrast.

Do not rely on color alone to distinguish Follow-Up, Update, and Appeal.

---

# 12. SECURITY AND AUTHORIZATION MATRIX

Validate the final permissions against the existing implementation.

The intended baseline is:

| Action                     | Admin                       | Employee                          | Resident            |
| -------------------------- | --------------------------- | --------------------------------- | ------------------- |
| Revert ticket status       | Allowed                     | Denied                            | Denied              |
| Submit Pending follow-up   | Not as Resident             | Not as Resident                   | Own eligible ticket |
| Request In Progress update | Not as Resident             | Not as Resident                   | Own eligible ticket |
| Submit Dismissed appeal    | Not as Resident             | Not as Resident                   | Own eligible ticket |
| View Resident requests     | Authorized scope            | Authorized scope                  | Own only            |
| Respond to update requests | According to admin workflow | Assigned and authorized           | Denied              |
| Make final appeal decision | Admin authority             | Denied unless explicitly approved | Denied              |
| Change final ticket status | Admin authority             | Denied                            | Denied              |

This table defines the security intent, not a replacement for the project's existing permission logic.

Verify how Admin actions are currently implemented before changing any endpoints.

Test unauthorized actions by direct API request, not only by checking whether buttons are hidden.

All user-generated messages must be validated, stored, and rendered safely.

Preserve existing XSS protections and text visibility restrictions.

---

# 13. IMPLEMENTATION ORDER

Do not implement everything simultaneously.

Follow this sequence.

## Phase 0: Repository discovery and decision checkpoint

- Read required documentation.
- Inspect current Git state.
- Map ticket statuses and ownership.
- Map permissions and assignment behavior.
- Identify existing notes, updates, notifications, and audit mechanisms.
- Identify existing tests.
- Highlight unclear requirements.
- Present the minimum blocking questions.

Do not proceed with a security-sensitive or ambiguous decision until clarified.

## Phase 1: Backend design and shared foundations

- Define the minimum required changes.
- Reuse existing models and services.
- Implement validation rules.
- Implement permission checks.
- Implement safe duplicate prevention.
- Define request-handling lifecycle.
- Prepare safe schema migrations or additions if needed.

Do not modify production data or reseed the normal database.

## Phase 2: Admin status reversal

- Implement backend reversal handling.
- Enforce Admin-only access.
- Preserve audit history.
- Handle permitted state-transition side effects.
- Add the Admin interface.
- Test reversals and denial cases.

## Phase 3: Resident request workflows

Implement progressively:

1. Pending follow-up.
2. In Progress update request.
3. Dismissed appeal.

For each:

- Backend eligibility.
- Persistence.
- Frequency restrictions.
- Resident UI.
- Authorized staff routing.
- Relevant tests.

Finish and validate one workflow before beginning the next.

## Phase 4: Rate limiting

- Apply appropriate note/update limits.
- Integrate daily request restrictions with the confirmed policy.
- Handle duplicate submissions.
- Provide appropriate API errors and UI feedback.
- Test limit boundaries and concurrent requests.

Shared safeguards can be implemented earlier when needed by the request workflows.

## Phase 5: Unified Action Center

- Reuse notification infrastructure.
- Build a consolidated request view.
- Implement filters, counts, and states.
- Add safe ticket navigation.
- Add authorized request handling.
- Add administrative handling for requests Employee permissions cannot cover.
- Test role-specific visibility.

## Phase 6: Operator contact

Evaluate architectural fit and implement only after explicit feature approval.

## Phase 7: Regression testing and cleanup

- Run existing tests.
- Run new feature tests.
- Verify Admin, Employee, and Resident workflows.
- Verify existing audit fixes.
- Verify archives and assigned ticket access.
- Check for console and server errors.
- Inspect changed files.
- Remove only newly introduced unused code.
- Update project documentation.

Do not modify unrelated functionality merely for cleanup.

---

# 14. MANDATORY TESTING CHECKLIST

## Admin status reversal

- [ ] Admin can reverse an eligible status.
- [ ] A reason is required.
- [ ] Original status history is preserved.
- [ ] Employees cannot reverse status.
- [ ] Residents cannot reverse status.
- [ ] Direct API attempts are rejected.
- [ ] Assignment and archive state remain consistent.
- [ ] Reversal does not delete notes or updates.
- [ ] Invalid reversals are safely rejected.

## Rate limiting

- [ ] Normal authorized note creation works.
- [ ] Normal authorized update creation works.
- [ ] Applicable limits are enforced by the server.
- [ ] Rapid duplicate requests do not create unintended duplicates.
- [ ] Restricted submissions return appropriate errors.
- [ ] UI feedback is clear.
- [ ] Existing records remain intact.
- [ ] Limits remain effective during concurrent calls.

## Resident follow-up

- [ ] Resident can follow up on an eligible Pending ticket.
- [ ] A second request within the restricted period is denied.
- [ ] Requests on other Residents' tickets are denied.
- [ ] Requests on non-Pending tickets are denied.
- [ ] Request appears for the correct authorized handler.
- [ ] Main ticket status does not automatically change.

## Resident update request

- [ ] Resident can request an update on an eligible In Progress ticket.
- [ ] Daily restriction is enforced.
- [ ] Assigned authorized staff can view the request.
- [ ] Employee response follows existing permissions.
- [ ] Request handling state is accurately represented.
- [ ] Ticket status is not modified automatically.

## Appeals

- [ ] Resident can appeal an eligible Dismissed ticket.
- [ ] Appeal explanation is validated.
- [ ] Other Residents cannot appeal someone else's ticket.
- [ ] Appeal is preserved in history.
- [ ] Admin can handle permitted appeal decisions.
- [ ] Employees cannot bypass Admin status authority.
- [ ] Accepting an appeal does not create an undocumented transition.
- [ ] Repeat appeals follow the confirmed policy.

## Unified Action Center

- [ ] Authorized requests appear correctly.
- [ ] Follow-up, update, and appeal categories are distinguishable.
- [ ] Filters work correctly.
- [ ] Counts reflect actual request states.
- [ ] Viewing does not automatically complete a request.
- [ ] Completion updates the appropriate views.
- [ ] Employees cannot access unauthorized tickets.
- [ ] Admin-required requests are correctly routed.
- [ ] Duplicate events do not create duplicate actionable items.

## Regression testing

- [ ] Existing authentication works.
- [ ] Existing role routing works.
- [ ] Existing ticket creation works.
- [ ] Ticket assignment and reassignment work.
- [ ] Priority controls work.
- [ ] Ticket linking works.
- [ ] Resolution and dismissal remain functional.
- [ ] Archiving remains functional.
- [ ] Existing notes and updates work.
- [ ] Resident ownership and privacy remain intact.
- [ ] Existing audit fixes remain intact.
- [ ] Existing dashboards and navigation remain functional.

Use the existing testing framework.

Add unit, integration, or end-to-end tests where appropriate.

Use isolated test data and safe fixtures.

Do not run destructive tests against the normal development database.

For previously established development environments, verify current port configuration before testing. Preserve separation between normal development and isolated test services.

---

# 15. AMBIGUITIES THAT MUST NOT BE SILENTLY DECIDED

After repository inspection, explicitly resolve these points if the project does not already define them.

### Decision 1: Daily restriction definition

Does once per day mean a local calendar day or a rolling 24-hour interval?

Also determine whether a Resident may submit a new request when an earlier request remains unresolved.

### Decision 2: Notes and updates rate limits

What numerical limits should apply, and should they differ by role or action type?

Suggest thresholds based on the existing system rather than choosing unexplained constants.

### Decision 3: Status reversal scope

Should Admins be able to restore only the immediately previous valid status, or choose among valid historical statuses?

How should archived tickets and employee assignments be handled during reversal?

### Decision 4: Appeal restrictions

How many appeals are permitted, and can another appeal be submitted after a rejected appeal?

### Decision 5: Employee access conflict

Who should handle follow-ups on unassigned Pending tickets and appeals on Dismissed tickets?

Resolve this without breaking existing permissions.

### Decision 6: Request processing

What exactly counts as fulfilled, acknowledged, or completed?

Determine whether a staff response is sufficient or an explicit handling action is required.

### Decision 7: Operator connection

Is the intended feature:

- Official contact information?
- A ticket-based request to contact staff?
- Direct messaging?

Do not implement an arbitrary choice.

**If these answers already exist in the code, documented requirements, or prior project handoff, use them and report the source.**

Only ask the project owner questions that remain unresolved.

---

# 16. CODE QUALITY AND ARCHITECTURAL STANDARDS

Follow these principles throughout implementation.

### Minimal modification

Prefer extending existing working modules over rewriting them.

### Single source of truth

Ticket status, request eligibility, permissions, and request handling must be enforced consistently by the backend.

### Reusability

Reuse existing components, hooks, middleware, services, and schemas where appropriate.

### Separation of concerns

Keep validation, authorization, persistence, and interface concerns appropriately separated according to the current architecture.

### Data integrity

Do not discard original ticket history or create duplicate incidents for communication requests.

### Security first

Never sacrifice permission boundaries for interface convenience.

### Consistent naming

Use the project's established naming conventions.

### No unnecessary dependencies

Do not add packages, services, frameworks, or infrastructures without a demonstrated requirement.

### No unrelated redesigns

Do not rebuild the dashboard, authentication system, ticket model, or navigation simply because a cleaner architecture is possible.

### No false completion claims

Do not claim a feature is tested or working without actually performing appropriate verification.

---

# 17. REQUIRED AGENT OUTPUTS

## Before implementation

Provide a concise discovery report containing:

1. **Current architecture:** Relevant existing files, models, components, routes, and services.
2. **Existing functionality:** What can already be reused.
3. **Proposed changes:** Which modules require modification or addition.
4. **Permission impact:** How the new workflows preserve role boundaries.
5. **Data design:** How requests, appeals, reversals, and notifications will be stored.
6. **Blocking questions:** Only unresolved decisions requiring owner input.
7. **Implementation plan:** Ordered phases with testing checkpoints.

Do not start a risky implementation before resolving critical blockers.

## During implementation

Complete features incrementally.

After each major feature, report:

- What changed.
- Which files were modified.
- Why the changes were required.
- What was tested.
- What remains incomplete.
- Any discovered conflicts.

Continue through non-blocked work without repeatedly requesting unnecessary approval.

## After implementation

Provide a final report using this structure:

### A. Implementation summary

List every requested feature and its actual completion status.

### B. Files changed

List added or modified files and their purpose.

### C. Backend changes

Explain the implemented models, routes, authorization, and business rules.

### D. Frontend changes

Explain new interfaces, buttons, notifications, and workflows.

### E. Security verification

Explain role restrictions, ownership protections, and request limits.

### F. Test results

Show which automated and manual tests were executed, including failures or limitations.

### G. Outstanding decisions

Identify any intentionally deferred functionality.

### H. Documentation updates

Identify changed project handoff or status documentation.

Do not mark unfinished or untested features as completed.

---

# 18. FINAL ACCEPTANCE CRITERIA

The implementation is acceptable only when:

1. **Admins can safely reverse eligible ticket statuses**, with proper authorization and preserved history.
2. **Notes and updates are appropriately rate-limited**, without breaking normal staff operations.
3. **Residents can follow up on Pending tickets** while respecting the approved daily limit.
4. **Residents can request updates on In Progress tickets** while respecting the approved daily limit.
5. **Residents can appeal eligible Dismissed tickets**, with decisions handled by authorized personnel.
6. **Employees have a unified Action Center** for the requests they are authorized to handle.
7. **Requests requiring Admin authority are correctly routed**, without unauthorized Employee access.
8. **Operator contact is implemented only if its scope is confirmed.**
9. **All existing BMIS functionality remains operational.**
10. **The codebase remains maintainable, consistent, and secure.**

---

# 19. FINAL DIRECTIVE

**Treat the existing BMIS implementation as the authoritative foundation.**

Do not interpret this specification as permission to redesign the project, override previous decisions, invent missing requirements, or weaken authorization.

Your task is to extend the already functioning system through small, deliberate, tested changes.

Prioritize:

**Correctness → Security → Data Integrity → Compatibility → Usability → Maintainability**

If an implementation decision conflicts with the existing architecture, investigate and propose the least disruptive solution.

If an important decision cannot be determined from the repository, ask the project owner before proceeding with that decision.

**Begin by reading the existing project documentation and inspecting the repository. Present the discovery findings and blocking questions before modifying source code.**
