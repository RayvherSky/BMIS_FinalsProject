# BMIS — Comprehensive 3-Role Architecture & Dispatch Workflow Revamp

## MASTER IMPLEMENTATION PROMPT FOR AI CODING AGENT

**Project:** Barangay Incident & Hazard Reporting System (BMIS)  
**Target Client:** Barangay Baclaran, Parañaque City, Philippines  
**Workspace:** `C:\PROJECTS\BMIS`  
**Technology Stack:** React 18, Vite, Ant Design, Node.js, Express.js, Mongoose/MongoDB, JWT Authentication  
**Implementation Type:** Full-Stack Feature Enhancement, RBAC Extension, Dispatch Workflow, UI Integration, and Regression Verification

---

# 1. MISSION AND OBJECTIVE

You are acting as the **Senior Full-Stack Software Engineer, Security Reviewer, and Quality Assurance Engineer** responsible for improving the existing Barangay Incident & Hazard Reporting System (BMIS).

Your task is to upgrade the current two-role architecture into a secure, fully integrated **three-role incident dispatch and management system**.

The three roles are:

1. **Admin** — System management, incident oversight, employee dispatch, priority control, user management, and final ticket disposition.
2. **Employee** — Barangay personnel responsible for handling specifically assigned incidents, providing progress updates, and communicating through ticket threads.
3. **Resident/User** — Community members who submit incident reports, monitor their own submissions, and participate in permitted public ticket communication.

The primary goal is to establish a realistic incident-handling workflow:

**Resident submits incident → Admin reviews and assigns Employee → Employee handles incident and posts updates → Admin verifies outcome → Admin resolves or dismisses → Existing archive workflow applies.**

This must be implemented as an extension of the current BMIS application, **not a complete rewrite**.

Preserve existing architecture, business rules, UI patterns, database records, integrations, audit fixes, and completed functionality.

Do not make assumptions about how a feature currently works. Inspect the actual implementation before modifying it.

---

# 2. MANDATORY REPOSITORY DISCOVERY

## 2.1 Required Context Files

Before writing or modifying any code, read:

1. `Context/BMIS session handoff.md`
2. `Context/PROJECT_STATUS.md`, if present or needed
3. Any relevant existing project documentation, audit notes, and testing instructions.

Treat these documents as important historical context, but verify their claims against the current source code.

Pay particular attention to:

- The nine completed audit patches: `AUD-01` through `AUD-09`.
- The four login, role, and priority implementation notes.
- The six dashboard, navigation, and archive implementation notes.
- Existing role permissions and authentication behavior.
- Current ticket schemas and lifecycle.
- Existing backend routes and controllers.
- Archive logic and resident-facing response sanitization.
- Current frontend layout and navigation architecture.
- The existing automated browser test suite.

**Do not proceed directly to coding. Complete repository inspection first.**

## 2.2 Git Safety and Preservation

The expected reference commit is:

`HEAD 61f6a0b`

Inspect the current repository using safe, read-only commands such as:

```bash
git status --short
git rev-parse --short HEAD
git diff --stat
git diff
```

Important requirements:

- Preserve all existing uncommitted changes.
- Do not assume the working tree is clean.
- Do not reset the repository to the reference commit.
- Do not overwrite unrelated user changes.
- Do not revert existing audit patches.
- Do not delete or regenerate unrelated project files.
- Do not create commits unless explicitly requested.

**Strictly prohibited:**

```bash
git reset
git clean
npm run seed
```

These commands must not be used against the working project or normal data.

If the current HEAD differs from `61f6a0b`, inspect the difference and continue using the actual workspace as the source of truth. Do not force checkout or restore the expected commit.

If a file already contains uncommitted changes, preserve them while applying the required modifications.

## 2.3 Environment and Port Isolation

Existing normal development ports:

| Service | Normal Environment | Isolated Playwright Environment |
|---|---|---|
| MongoDB | 27017 | Separate temporary test database/instance |
| Express API | 5000 | 5001 |
| Vite Frontend | 3000 | 3001 |

Requirements:

- Never seed, clear, drop, overwrite, or modify normal development data for test preparation.
- Do not assume that using a different API port guarantees database isolation.
- Ensure the test environment uses an explicitly separate database or temporary MongoDB instance.
- Never run destructive test cleanup against the normal MongoDB database.
- Do not interfere with already-running development services.
- Reuse the project's existing isolated testing strategy whenever possible.
- Do not modify live environment files unnecessarily.
- Never print database credentials, JWT secrets, or other sensitive environment values in reports.

Any temporary test data must be created and cleaned up only within the isolated testing environment.

---

# 3. DEVELOPMENT STRATEGY AND EXECUTION ORDER

Implement the revamp incrementally rather than making a large, uncontrolled set of modifications.

Follow these stages in order:

**Phase 0 — Discovery and Baseline Verification**

- Inspect repository, documentation, routes, schemas, components, and tests.
- Identify existing behavior and implementation risks.
- Run relevant baseline checks where the environment permits.
- Record pre-existing failures separately from changes introduced by this task.

**Phase 1 — Backend Foundation**

- Add Employee role compatibility.
- Extend account role management.
- Add ticket assignment fields.
- Implement secure assignment and reassignment.
- Enforce Employee ticket scoping.
- Secure all related API actions.
- Add focused backend tests.

**Phase 2 — Frontend Integration**

- Add Employee-specific navigation.
- Implement assigned ticket workspace.
- Add Admin assignment controls.
- Adapt ticket details for the three roles.
- Extend the Change Role modal.
- Preserve existing frontend behavior and design.

**Phase 3 — Workflow Integrity**

- Handle role changes and account deactivation.
- Handle reassignment and unassignment.
- Enforce communication visibility.
- Review stale JWT behavior.
- Validate archive and ticket lifecycle interactions.

**Phase 4 — Testing and Regression Verification**

- Execute focused backend tests.
- Verify role-specific access restrictions.
- Execute browser tests using the isolated environment.
- Preserve and extend the existing 56 browser tests.
- Fix regressions introduced by the implementation.

**Phase 5 — Final Documentation and Delivery**

- Summarize modifications.
- Report executed tests and results.
- Explain any unresolved issues.
- Provide manual testing instructions.

Complete the relevant checks for each phase before proceeding to the next. If the environment prevents verification, document the limitation and continue only with changes that can be made safely.

---

# 4. ROLE-BASED ACCESS CONTROL ARCHITECTURE

Implement a strict three-role Role-Based Access Control (RBAC) system.

## 4.1 Admin Role

Role identifier:

`admin`

Admins retain all existing administrative capabilities, including:

- Viewing active tickets.
- Viewing archived tickets.
- Accessing dashboard analytics and statistics.
- Searching and filtering system-wide tickets.
- Managing ticket priority.
- Managing ticket status.
- Linking and unlinking duplicate reports.
- Managing ticket archives.
- Accessing archive filters: All, Resolved, and Dismissed.
- Managing user accounts.
- Changing account roles through the existing secure workflow.
- Viewing permitted internal notes and communication history.

### New Admin Capabilities

Admins must be able to:

1. Assign an active ticket to an Employee account.
2. Reassign an active ticket from one Employee to another.
3. Unassign an Employee from a ticket.
4. View the currently assigned Employee.
5. See assignment history where supported by the implementation.
6. Identify active tickets requiring reassignment.

Only Admins may assign or unassign Employees.

### Admin-Only Status Authority

Only Admins may:

- Set a ticket to `Resolved`.
- Set a ticket to `Dismissed`.
- Execute manual archival operations.
- Modify priority.
- Link or unlink duplicate tickets.

Preserve the existing behavior where marking a ticket `Resolved` immediately auto-archives it and records `archivedAt`.

Preserve the established Dismissed/manual archive behavior without inventing a different lifecycle.

Do not inadvertently alter existing archive filtering, ordering, or record retention.

## 4.2 Employee Role

Role identifier:

`employee`

Employees are Barangay personnel whose accounts are provisioned by an Admin using the existing Change Role mechanism.

They are operational responders, **not secondary administrators**.

### Employee Permissions

Employees may:

- Log into BMIS using the existing authentication system.
- Access their dedicated Assigned Tickets workspace.
- View active tickets explicitly assigned to them.
- Open details of their assigned active tickets.
- Search and filter their assigned ticket queue.
- Post public progress updates on assigned active tickets.
- Communicate through permitted ticket threads.
- Create internal staff notes on assigned tickets, if supported by the existing communication model.
- Read public and authorized internal communication relevant to their assigned tickets.

### Employee Restrictions

Employees must not:

- Access tickets assigned to another Employee.
- Access unassigned tickets.
- Access archived tickets.
- Access global ticket analytics.
- Access Admin dashboard modules.
- Access User Management.
- Change another account's role.
- Edit other users' profiles.
- Assign or reassign tickets.
- Modify ticket priority.
- Mark tickets Resolved.
- Mark tickets Dismissed.
- Archive or restore tickets.
- Link or unlink duplicate tickets.
- Access unrestricted system-wide ticket endpoints.

Employees must not gain elevated access by changing query parameters, manipulating frontend state, modifying request bodies, or directly calling protected API endpoints.

For self-profile management, preserve existing permitted self-service behavior if present, but do not introduce new account-editing privileges through this revamp.

### Employee Status Handling

Employees communicate their work through progress updates and ticket communication.

If the existing system has a separate operational work state that can be safely reused, it may support Employee progress tracking.

However, employees must never gain control over the master ticket's final disposition.

Do not introduce additional master statuses without a demonstrated need.

## 4.3 Resident/User Role

Preserve the existing Resident role representation.

The current project may use:

`resident`

or:

`user`

Inspect the authentication middleware, model enums, database records, and frontend role comparisons before choosing the canonical representation.

Do not silently change existing account records or break compatibility with legacy Resident accounts.

### Resident Permissions

Residents retain their existing capabilities:

- Register an account.
- Log in.
- Submit incident reports.
- View only their own tickets.
- View permitted ticket details.
- Read public progress updates.
- Reply to permitted public ticket communication.
- View their own reports according to existing lifecycle and archive access rules.

### Resident Ticket Creation Rules

Preserve:

- Default ticket priority of `Medium`.
- Server-side enforcement of initial priority.
- Category `Others` requiring a nonblank custom label.
- Trimming of the custom category label.
- Existing ticket validation behavior.
- Existing restrictions on resident-controlled fields.

Residents must never be allowed to choose their initial priority through request manipulation.

### Resident Privacy Rules

Preserve `AUD-01` completely.

Resident-visible ticket responses must:

- Exclude internal/private staff notes.
- Prevent disclosure of unauthorized internal metadata.
- Redact foreign linked reports to `{ _id }`.
- Avoid exposing details of tickets belonging to other Residents.
- Avoid exposing internal assignment history or Employee email addresses.

Residents may see the assigned Employee's display name where appropriate.

If exposing the Employee's name conflicts with existing privacy rules, display:

`Assigned to Barangay Staff`

A ticket with no Employee assigned should display:

`Awaiting Assignment`

---

# 5. BACKEND IMPLEMENTATION

Primary areas:

- `server/models`
- `server/controllers`
- `server/routes`
- `server/middleware`
- Existing authentication and authorization utilities

Follow current folder structure and project conventions.

Do not create duplicate services or rewrite existing controllers when extending them is sufficient.

## 5.1 User Model and Role Validation

Inspect:

- `server/models/User.js`
- `server/controllers/userController.js`
- Existing user routes and authorization middleware.

Extend the existing role enum to support:

- Admin
- Employee
- Resident/User

Preserve valid existing role values and compatibility with stored accounts.

Public registration must always create standard Resident accounts, regardless of any submitted `role` value.

Never accept client-supplied administrative roles during registration.

## 5.2 Admin Change Role Workflow

Preserve:

`PATCH /api/users/:id/role`

Expected request structure:

```json
{
  "role": "employee",
  "confirmationEmail": "employee@example.com"
}
```

The existing typed target-account email confirmation must remain mandatory.

Requirements:

- Admin authorization required.
- Validate target account existence.
- Validate role against supported values.
- Verify `confirmationEmail` against the target account's actual email using existing confirmation semantics.
- Reject mismatched confirmation.
- Preserve existing permission warnings.
- Preserve existing role-change safeguards.
- Preserve current validation and error-response conventions.

The endpoint must support changing a user from Resident to Employee and from Employee to another permitted role.

Preserve existing Admin-change behavior and any existing protection against unsafe Admin removal.

### Role Modification Bypass Prevention

The existing endpoint:

`PUT /api/users/:id`

must remain strictly unable to modify account roles.

Audit other generic account update paths, including bulk or self-profile updates if they exist, to ensure they cannot bypass role-change authorization.

## 5.3 Employee Directory Endpoint

Provide Admins with a lightweight list of active Employee accounts for ticket assignment.

Prefer extending an existing Admin-only user-list API if its current design supports filtering.

Otherwise, create a focused endpoint such as:

`GET /api/users/employees`

Response fields:

```json
[
  {
    "_id": "employee_id",
    "name": "Employee Name",
    "email": "employee@example.com"
  }
]
```

Requirements:

- Admin-only authorization.
- Return only active Employee accounts.
- Exclude passwords, password hashes, tokens, and other sensitive fields.
- Follow existing response envelope conventions.
- Preserve filtering/pagination patterns where applicable.
- Prevent Employee and Resident access to the administrative directory.

Do not expose this directory through public registration or unrestricted profile APIs.

## 5.4 Ticket Schema Enhancement

Inspect:

`server/models/Ticket.js`

Add a single-assignee model:

```js
assignedTo: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  default: null
},

assignedAt: {
  type: Date,
  default: null
}
```

Adapt the implementation to the existing Mongoose schema style.

Requirements:

- Existing tickets must remain valid.
- Missing assignment fields on legacy documents should behave as unassigned.
- Do not delete or rewrite existing documents.
- Do not alter pre-existing ticket IDs.
- Preserve all existing ticket fields.
- Use appropriate query indexes if justified by the current query patterns.

Prefer a single assignee for this implementation.

**Do not introduce multi-Employee assignment or team dispatch functionality.**

### Assignment History

Maintain an auditable record of assignment changes.

Use an existing audit/event mechanism if the project already has one.

Otherwise, implement a minimal compatible history structure recording:

- Previous Employee.
- New Employee.
- Admin who performed the action.
- Timestamp.
- Assignment, reassignment, or unassignment action.

Avoid creating a large independent audit subsystem.

Historical assignment records must not become editable by Employees or Residents.

## 5.5 Admin Ticket Assignment Endpoint

Prefer a dedicated endpoint:

`PATCH /api/tickets/:id/assign`

Suggested request:

```json
{
  "assignedTo": "VALID_EMPLOYEE_OBJECT_ID"
}
```

For unassignment:

```json
{
  "assignedTo": null
}
```

### Assignment Rules

1. Only Admins may call the endpoint.
2. Ticket must exist.
3. Ticket must be active and not archived.
4. Target Employee must exist.
5. Target account must currently have the `employee` role.
6. Target Employee must be active.
7. Archived tickets cannot be assigned.
8. Invalid Employee IDs must be rejected.
9. Unassignment must be supported.
10. Reassignment must preserve ticket history.

### Automatic Status Transition

When an Admin assigns an Employee to a ticket whose current status is:

`Pending`

automatically change its status to:

`In Progress`

Use the existing valid status values and formatting found in the repository.

Do not create duplicate enum values merely because capitalization differs.

When reassigning a ticket already marked `In Progress`, preserve that status.

When unassigning an `In Progress` ticket, do not automatically return it to `Pending`.

### Assignment Timestamp Behavior

- On successful assignment/reassignment, set `assignedAt` to the new assignment time.
- On unassignment, clear the current assignment and its current `assignedAt`, while preserving historical records.
- Prefer no unnecessary database changes when assigning the same Employee again.
- Ensure invalid requests do not partially modify the ticket.

## 5.6 Employee Ticket Listing

Inspect the existing:

`GET /api/tickets`

For Employees, apply mandatory server-side filtering equivalent to:

```js
{
  assignedTo: req.user.id,
  isArchived: false
}
```

This filter must be derived from the authenticated server-side identity.

Never trust an `assignedTo` query parameter to determine the Employee's scope.

Employees must see only tickets assigned to their own account.

The following must all be excluded:

- Unassigned tickets.
- Tickets assigned to Employee B when Employee A is logged in.
- Archived tickets assigned to the Employee.
- Tickets that were previously assigned but have since been reassigned.

Maintain consistent scoping across:

- Ticket listing.
- Search.
- Category filters.
- Status filters.
- Pagination.
- Total counts.
- Any additional list-related endpoint used by the frontend.

Do not fetch unrestricted tickets and filter only in React.

Apply database-level scoping before pagination and counts.

## 5.7 Employee Ticket Detail Access

Inspect:

`GET /api/tickets/:id`

For authenticated Employees:

- Permit access only if the ticket is active.
- Permit access only if `assignedTo` matches the authenticated Employee ID.
- Reject archived tickets.
- Reject unassigned tickets.
- Reject tickets assigned to another Employee.

For existing tickets outside the Employee's scope, respond with:

`403 Forbidden`

For nonexistent or malformed IDs, preserve appropriate `404` or validation-error behavior.

### Important: Mongoose Population

The `assignedTo` field may be populated into an Employee object.

Do not accidentally compare an entire populated object to a string.

Normalize or compare ObjectIds safely.

Avoid over-populating sensitive user information.

## 5.8 Employee Mutation Restrictions

Employees must receive `403 Forbidden` when attempting to:

- Change priority.
- Change master ticket status to `Resolved`.
- Change master ticket status to `Dismissed`.
- Assign or unassign an Employee.
- Link or unlink duplicate tickets.
- Archive or restore a ticket.
- Edit another user's profile.
- Change another user's role.
- Access Admin-only analytics.

Audit all ticket mutation endpoints, not just those exposed in the Employee interface.

Do not allow an Employee to bypass restrictions by submitting restricted fields in an otherwise permitted update request.

Avoid unrestricted operations such as directly spreading client-controlled request bodies into database updates.

Use explicit field allowlists appropriate to each action and role.

## 5.9 Employee Progress Updates and Communication

Allow Employees to post updates only on their assigned, active tickets.

Reuse existing update/comment routes whenever possible.

If the current repository already has suitable communication endpoints, extend them rather than introducing redundant APIs.

Requirements:

- Authenticate the Employee.
- Verify current ticket assignment.
- Verify ticket is not archived.
- Validate message content.
- Preserve author identity.
- Preserve timestamps.
- Follow existing visibility rules.
- Reject unauthorized posting to other tickets.
- Reject posting to archived tickets.

Successful creation should return the project's normal `200` or `201` response.

### Reassignment Concurrency Protection

An Employee must not be able to post updates to a ticket after the assignment has been removed or transferred.

Avoid relying solely on an earlier ticket read if the assignment could change before the write occurs.

Use a conditional database mutation or another safe mechanism consistent with the existing repository to enforce assignment at mutation time.

Do not require MongoDB multi-document transactions unless the deployment environment supports them.

---

# 6. COMMUNICATION PRIVACY AND VISIBILITY

Ticket communication must clearly distinguish between:

**Public Updates**

Visible to authorized participants, including the reporting Resident.

Examples:

- "Barangay personnel have been dispatched."
- "The drainage area is currently being inspected."
- "Initial clearing operations have been completed."

**Internal Staff Notes**

Visible only to authorized administrative/staff users.

Examples:

- Equipment requirements.
- Internal coordination.
- Barangay resource allocation.
- Operational concerns not intended for public display.

## 6.1 Communication Permission Matrix

| Action | Admin | Assigned Employee | Resident |
|---|---|---|---|
| Read public updates | Yes | Yes | Own tickets |
| Post public progress updates | Yes | Yes | Preserve existing reply rules |
| Read internal notes | Yes | Assigned active tickets only | No |
| Create internal notes | Yes | Assigned active tickets only | No |
| Read resident replies | Yes | Assigned active tickets only | Own tickets |
| Modify priority | Yes | No | No |
| Resolve/dismiss | Yes | No | No |
| Assign Employee | Yes | No | No |

A Resident reply must not automatically become a staff progress update.

Preserve the existing distinction between user replies, staff updates, and internal notes if one already exists.

Do not invent duplicate communication collections unnecessarily.

## 6.2 AUD-01 Preservation

All Resident-visible API responses must preserve the original privacy guarantees.

Specifically:

- Internal notes must never be serialized into Resident responses.
- Linked foreign tickets must remain redacted to `{ _id }`.
- Employees must not gain broad access to unrelated Residents' reports.
- Populated references must not expose confidential information.
- Search and related-ticket functions must not reveal unauthorized ticket contents.

Review list, detail, comment, linked-ticket, and populated-reference responses for accidental leakage.

Prefer centralized serialization/sanitization functions if the repository already provides them.

---

# 7. ROLE TRANSITIONS AND ACCOUNT LIFECYCLE

Role changes can affect existing Employee assignments.

This must be handled explicitly.

## 7.1 Employee Promotion

When an Admin changes a Resident to Employee:

- The account becomes eligible for assignment.
- Its existing submitted Resident reports remain preserved.
- Its existing user data remains unchanged.
- The account receives Employee permissions through authenticated authorization.
- No ticket should automatically be assigned.

## 7.2 Employee Demotion

When an Employee is changed to Resident or another supported role:

- The account immediately loses Employee permissions.
- Its active assigned tickets must be unassigned.
- Tickets must remain active.
- Existing updates and internal history must remain preserved.
- Those tickets must become visible to Admins as requiring reassignment.

Do not delete tickets or erase prior assignment records.

## 7.3 Employee Deactivation

If an Employee account is deactivated:

- Prevent new assignments to that account.
- Prevent continued Employee access.
- Remove the Employee from active assignments.
- Preserve ticket data and history.
- Surface unassigned active tickets to Admins.

Adapt this to the existing soft-delete or account-status implementation.

Do not create a new deactivation mechanism unless one is required.

If assignment cleanup spans multiple records, implement failure handling appropriate to the existing database setup. Do not silently report successful cleanup if some assignments remain uncleared.

## 7.4 Reassignment

When Admin transfers a ticket from Employee A to Employee B:

1. Employee A loses ticket access.
2. Employee B gains ticket access.
3. Ticket ID remains unchanged.
4. Status remains unchanged except for the defined Pending-to-In-Progress rule.
5. Previous communication remains intact.
6. Historical assignment details remain recorded.
7. Residents continue seeing authorized public ticket information.

Reassignment must not duplicate the ticket.

---

# 8. JWT AUTHENTICATION AND CURRENT-ROLE VALIDATION

This section is security-critical.

Do not rely on an outdated role stored inside a JWT for ongoing authorization.

Example: An account previously had `admin` permission but has since been demoted.

If the system continues trusting a stale JWT role claim, that account might retain unauthorized access.

### Required Behavior

- Authenticate and verify JWTs using the existing authentication mechanism.
- Resolve the current account and its current role from the database when authorizing protected requests.
- Reject deactivated or otherwise unauthorized accounts.
- Base access decisions on current database permissions.
- Ensure Employee assignment checks use the current authenticated user ID.
- Preserve existing token expiry and session behavior.

### Frontend Role Synchronization

Ensure frontend navigation reflects the currently authorized role.

After a role change, the affected user should receive the updated permitted interface when the application next refreshes or authenticates.

Avoid rendering stale Admin modules as though they are still authorized.

Backend authorization remains authoritative even if the frontend temporarily contains stale role information.

Do not introduce a new authentication framework unless the existing implementation cannot safely support these requirements.

---

# 9. FRONTEND ARCHITECTURE

Primary areas:

- `client/src/App.jsx`
- `client/src/components/Layout/AppLayout.jsx`
- Existing ticket pages.
- `TicketDetails.jsx`
- User Management pages.
- Relevant services, hooks, contexts, and route guards.

Follow the existing component architecture.

Do not unnecessarily replace working React or Ant Design components.

## 9.1 Persistent Authenticated Layout

Preserve the existing persistent `AppLayout` and its `Outlet`.

Do not introduce a separate layout that causes unnecessary navigation remounting.

Preserve:

- Sidebar structure.
- Existing visual design language.
- Header Collapse/Expand toggle.
- Measured selection indicator.
- Right-to-left entrance motion.
- Existing navigation animations.
- Sidebar collapsed state behavior.
- Responsive behavior.
- Current page transitions.
- Existing Admin and Resident navigation where applicable.

The Employee workspace should feel native to the existing application.

## 9.2 Role-Aware Navigation

Render navigation based on the current authenticated role.

### Admin Navigation

Preserve existing administrative navigation, including:

- Dashboard.
- Ticket management.
- User Management.
- Archive.
- Other existing authorized modules.

### Employee Navigation

Provide only authorized Employee navigation.

Primary entry:

**Assigned Tickets**

Do not display:

- Admin Dashboard Analytics.
- User Management.
- Archive.
- Global Ticket Management.
- Other administrative modules.

Existing account/logout controls may remain according to current behavior.

### Resident Navigation

Preserve the existing Resident interface and permitted navigation.

Do not remove Resident functionality merely because the Employee role has been introduced.

## 9.3 Route-Level Authorization

Hiding sidebar items is insufficient.

Implement or extend protected route guards.

Requirements:

- Admin-only routes reject Employee/Resident access.
- Employee ticket routes enforce appropriate role permissions.
- Employees cannot directly navigate to User Management, Archive, or analytics pages.
- Unauthorized navigation should show the application's existing access-denied or redirect behavior.
- Browser refreshes on authorized Employee routes must work.
- Login redirects must send Employees to their assigned-ticket workspace.

Preserve existing route naming where possible.

---

# 10. EMPLOYEE WORKSPACE DESIGN

Create a dedicated **Assigned Tickets** experience.

This is an operational work queue, not an analytics dashboard.

## 10.1 Queue Content

Display only the authenticated Employee's assigned active tickets.

Use existing ticket table/card patterns where appropriate.

Show relevant fields such as:

- Ticket reference or ID.
- Ticket title.
- Category.
- `Others` custom label where applicable.
- Location, if already available and authorized.
- Current status.
- Priority as read-only information.
- Creation date.
- Last update time, if available.
- Action to view ticket details.

Do not expose unnecessary Reporter personal information or hidden staff metadata.

## 10.2 Searching and Filtering

Provide:

- Search by permitted ticket identifier/title.
- Category filtering.
- Status filtering.
- Support for custom category labels under `Others`.
- Existing pagination/sorting patterns where applicable.

Ensure search/filter behavior never expands results beyond the Employee's assignments.

When using server-side search, all results and counts must remain Employee-scoped.

## 10.3 Queue States

Handle:

- Loading.
- No assigned tickets.
- No matching search results.
- Network/API errors.
- Successful refresh.

Recommended empty-state wording:

**No tickets assigned yet.**

Supporting text:

"You will see incidents here once an administrator assigns them to you."

## 10.4 Analytics Restrictions

Do not render:

- Global ticket totals.
- System-wide analytics charts.
- Barangay-wide resolution statistics.
- Admin statistic cards.
- Other restricted administrative metrics.

Basic queue information derived entirely from an Employee's own assignments is acceptable, but the primary experience must remain a clean operational ticket list.

---

# 11. TICKET DETAILS — THREE-ROLE BEHAVIOR

Inspect the existing Ticket Details implementation before changing it.

Keep common ticket information consistent across roles while rendering role-specific controls.

## 11.1 Admin Ticket Details

Add an **Assign Employee** interface.

Prefer an Ant Design `Select` or equivalent control consistent with existing styling.

Requirements:

- Load active Employee accounts from the protected API.
- Display Employee names.
- Provide useful search in the selector.
- Show the current assignee.
- Support initial assignment.
- Support reassignment.
- Support unassignment.
- Display loading/success/error states.
- Prevent invalid or duplicate submissions.
- Refresh relevant ticket information after a successful assignment.

Preserve existing Admin controls:

- Priority.
- Master status.
- Duplicate links.
- Archiving.
- Existing ticket management actions.
- Communication and internal notes.

Do not replace the existing Ticket Details interface unnecessarily.

## 11.2 Employee Ticket Details

Allow the Employee to view only their assigned active ticket.

Show:

- Ticket details.
- Category and custom category label.
- Read-only priority.
- Read-only master status.
- Existing permitted incident information.
- Public progress updates.
- Authorized internal notes.
- Communication composer.
- Update history.

Hide or disable:

- Priority editing.
- Resolved action.
- Dismissed action.
- Archive action.
- Duplicate linking.
- Employee assignment.
- Any Admin-only controls.

The Employee must be able to submit valid progress updates without gaining elevated privileges.

### Access After Reassignment

If the ticket is reassigned or archived while the Employee is viewing it:

- The next protected request must deny unauthorized access.
- The frontend should display an appropriate access-denied or no-longer-assigned state.
- Do not continue exposing cached restricted ticket details after authorization has failed.

## 11.3 Resident Ticket Details

Preserve current Resident functionality.

Add an assignment display where permitted.

Possible presentation:

**Assigned Staff:** Juan Dela Cruz

Fallbacks:

**Assigned Staff:** Assigned to Barangay Staff

or:

**Assigned Staff:** Awaiting Assignment

Residents must be able to:

- View permitted ticket information.
- Read public Employee/Admin updates.
- Submit permitted replies.
- Continue using existing ticket functionality.

Residents must not see:

- Employee assignment management controls.
- Staff internal notes.
- Internal dispatch history.
- Employee email addresses.
- Admin-only metadata.
- Unauthorized linked ticket information.

---

# 12. USER MANAGEMENT — CHANGE ROLE MODAL

Inspect the existing Change Role modal.

Extend the role options to include:

- Admin
- Employee
- Resident/User

Preserve:

- Existing account selection.
- Existing visual design.
- Role change warning.
- Target-account email confirmation.
- Typed confirmation validation.
- Cancellation behavior.
- State reset after cancellation.
- Error handling.
- Retry behavior.
- Success notification.
- User list refresh behavior.

### Important UX Requirements

When Admin chooses Employee:

- Explain that this role can only access assigned active tickets and permitted communication.
- Explain that the role does not include administrative permissions.
- Preserve the target-account email confirmation requirement.

When changing an Employee to another role:

- Warn that active ticket assignments will be removed.
- Confirm the target account's email before submission.
- Preserve the current safety workflow.

Do not allow role changes from generic profile editing controls.

---

# 13. MASTER TICKET LIFECYCLE

Preserve existing master status values unless the current code requires normalization.

Expected conceptual lifecycle:

**Pending → In Progress → Resolved**

Alternative Admin outcome:

**Dismissed**

## 13.1 Pending

- Ticket has been submitted.
- Default priority remains Medium for Resident submissions.
- Admin may review or assign.
- No Employee assignment is required yet.

## 13.2 In Progress

- Automatically set when Admin assigns an Employee to a Pending ticket.
- Employee may provide progress updates.
- Admin retains master status control.
- Employee reassignment may occur.
- Unassignment does not automatically revert status to Pending.

## 13.3 Resolved

- Admin-only status action.
- Preserve immediate auto-archive behavior.
- Preserve `archivedAt` stamping.
- Employee loses active-ticket access.
- Ticket remains available through existing authorized archive views.

## 13.4 Dismissed

- Admin-only status action.
- Preserve current manual archive handling.
- Employee may not dismiss.
- Existing archive filters must continue working.

### Critical Lifecycle Rules

- Employees cannot finalize a ticket.
- Assignment cannot reopen archived tickets.
- Assignment cannot bypass archival restrictions.
- Existing duplicate linkage and priority logic must remain intact.
- Archived tickets cannot appear in Employee active queues.
- Do not introduce unexpected automatic status reversions.

---

# 14. SECURITY AND DATA INTEGRITY REQUIREMENTS

Apply defense-in-depth to all new behavior.

## 14.1 Authorization

Backend role guards are mandatory.

All sensitive actions must validate:

- Authentication.
- Current role.
- Current account status.
- Resource ownership/assignment where applicable.
- Ticket archive state where applicable.

Do not rely on React-only restrictions.

## 14.2 Mass Assignment Protection

Never permit Employees or Residents to change protected fields through generic update payloads.

Examples of protected fields include:

- `assignedTo`
- `assignedAt`
- `priority`
- `isArchived`
- `archivedAt`
- `linkedTicket`
- Master ticket status
- Assignment history
- System-controlled author identity

Only authorized controller actions may modify the relevant fields.

## 14.3 Sensitive Data Protection

Do not expose:

- Password hashes.
- JWT secrets.
- Private account credentials.
- Internal staff notes to Residents.
- Unauthorized ticket details.
- Sensitive populated user fields.
- Internal assignment history to public users.

Use explicit projections and serialization where practical.

## 14.4 Consistent Error Handling

Prefer existing API conventions.

Use appropriate responses:

- `400` — Invalid request.
- `401` — Unauthenticated.
- `403` — Authenticated but unauthorized.
- `404` — Resource not found.
- `409` — Applicable state conflict, if supported.
- `500` — Unexpected server failure.

Do not leak sensitive internal information in production error responses.

## 14.5 Query Safety

Ensure Employees cannot bypass assigned-ticket scoping through:

- Alternate filters.
- Search parameters.
- Pagination.
- Sorting.
- Direct ObjectId requests.
- Populated references.
- Export endpoints, if any.
- Other ticket or analytics APIs.

Audit related routes rather than protecting only the primary Ticket Details view.

---

# 15. BACKWARD COMPATIBILITY REQUIREMENTS

The revamp must preserve existing functionality.

Specifically:

1. All nine audit patches (`AUD-01` through `AUD-09`).
2. All four login/role/priority notes.
3. All six dashboard/navigation/archive notes.
4. Existing Admin workflows.
5. Existing Resident reporting workflows.
6. Existing ticket priorities.
7. Existing `Others` category validation.
8. Existing archive rules.
9. Existing duplicate-linking logic.
10. Existing privacy/sanitization rules.
11. Existing dashboard analytics.
12. Existing layout animations and sidebar behavior.
13. Existing authentication and role-change confirmation.
14. All existing database records.
15. All existing browser test cases.

Do not silently rename stored fields or role values.

If a compatibility migration is genuinely required, design it to be additive, explicit, and safe for existing records.

Prefer schema defaults and backward-compatible reads over unnecessary bulk database updates.

Do not execute destructive migrations.

---

# 16. BACKEND AUTOMATED TESTING

Extend:

`server/tests/notes-changes.test.js`

or create a dedicated focused test file if that is more maintainable.

Reuse existing test infrastructure and conventions.

## 16.1 Role Management Tests

Verify:

- Admin can promote a Resident to Employee with the correct confirmation email.
- Incorrect confirmation email is rejected.
- Non-Admins cannot change roles.
- Public registration cannot create Employee/Admin accounts.
- `PUT /api/users/:id` cannot change roles.
- Employee role changes are persisted correctly.
- A demoted Employee loses authorization immediately.
- Stale JWT roles do not preserve removed permissions.

## 16.2 Assignment Tests

Verify:

- Admin can assign a valid Employee.
- Assigning a Pending ticket changes it to In Progress.
- Assigning an already In Progress ticket preserves status.
- Admin can reassign an Employee.
- Admin can unassign an Employee.
- Assignment to a Resident is rejected.
- Assignment to a nonexistent Employee is rejected.
- Assignment to an inactive Employee is rejected.
- Assignment to an archived ticket is rejected.
- Non-Admins cannot assign tickets.
- Assignment history remains preserved.

## 16.3 Employee Visibility Tests

Create test fixtures including:

- Ticket A: assigned to Employee A, active.
- Ticket B: assigned to Employee B, active.
- Ticket C: unassigned, active.
- Ticket D: assigned to Employee A, archived.
- Ticket E: assigned to Employee A, active, category Others with a custom label.

When Employee A calls:

`GET /api/tickets`

Verify that only Tickets A and E are returned.

Verify that:

- Ticket B is excluded.
- Ticket C is excluded.
- Ticket D is excluded.
- Search/filter counts are scoped.
- Employee A cannot open Ticket B.
- Employee A cannot open Ticket C.
- Employee A cannot open Ticket D.
- Employee B cannot open Ticket A.

## 16.4 Employee Action Tests

Verify:

| Action | Expected Result |
|---|---|
| Employee views assigned active ticket | 200 |
| Employee posts valid update on assigned active ticket | 200/201 |
| Employee posts on another Employee's ticket | 403 |
| Employee posts on archived assigned ticket | 403 |
| Employee changes priority | 403 |
| Employee marks Resolved | 403 |
| Employee marks Dismissed | 403 |
| Employee assigns a ticket | 403 |
| Employee links duplicate ticket | 403 |
| Employee accesses archives | 403 |
| Employee accesses user management | 403 |
| Employee accesses global analytics | 403 |
| Resident tries to assign Employee | 403 |

Adapt expected successful response codes to the existing API contract without weakening authorization checks.

## 16.5 Privacy Tests

Verify:

- Resident responses exclude private notes.
- Resident responses maintain linked-ticket redaction.
- Employees only see authorized internal notes.
- Residents cannot discover unauthorized ticket details through populated references.
- Assignment metadata does not expose unnecessary personal information.
- Public updates are visible to authorized Residents.
- Internal notes remain invisible to Residents.

## 16.6 Account Transition Tests

Verify:

- Demoting an assigned Employee removes active assignments.
- Deactivating an assigned Employee removes active assignments.
- Existing ticket history remains intact.
- Reassignment removes previous Employee access.
- Reassignment grants new Employee access.
- Unassignment preserves ticket status.
- Previously authorized requests cannot create new notes after assignment loss.

---

# 17. PLAYWRIGHT BROWSER TESTING

Preserve all existing **56 browser test cases**.

Do not:

- Delete existing tests.
- Skip tests merely to obtain a passing result.
- Weaken assertions.
- Rewrite tests to hide broken features.
- Change expected business behavior without a justified implementation requirement.

Add focused browser coverage for the three-role architecture.

## 17.1 Admin Flow

Test:

1. Admin logs in.
2. Admin navigates to User Management.
3. Admin changes a Resident to Employee using confirmation email.
4. Employee appears in the assignment selector.
5. Admin opens a Pending ticket.
6. Admin assigns Employee.
7. Ticket transitions to In Progress.
8. Admin reassigns or unassigns the Employee.
9. Admin retains all existing ticket controls.

## 17.2 Employee Flow

Test:

1. Employee logs in.
2. Employee is directed to Assigned Tickets.
3. Sidebar shows only permitted navigation.
4. Employee sees only assigned active tickets.
5. Employee can search and filter assignments.
6. Employee opens an assigned ticket.
7. Employee submits a progress update.
8. Employee cannot see priority-editing controls.
9. Employee cannot see Resolve/Dismiss actions.
10. Employee cannot access Archive or User Management.
11. Direct navigation to Admin routes is blocked.

## 17.3 Resident Flow

Test:

1. Resident logs in.
2. Resident creates a ticket.
3. New ticket starts at Medium priority.
4. Custom label validation for Others still works.
5. Resident sees their permitted ticket details.
6. Resident can see public Employee updates.
7. Resident cannot see internal staff notes.
8. Resident can see appropriate assignment information.
9. Resident cannot access another Resident's ticket.

## 17.4 Reassignment Flow

Test:

1. Admin assigns Ticket A to Employee A.
2. Employee A can open Ticket A.
3. Admin reassigns Ticket A to Employee B.
4. Employee A loses access.
5. Employee B gains access.
6. Previous public updates remain visible.
7. Existing ticket history remains intact.

## 17.5 Test Environment

Use the isolated frontend/API services on:

- Frontend: `3001`
- API: `5001`

Use isolated temporary database resources.

Verify environment isolation before creating fixtures or executing destructive cleanup.

Preserve existing browser test infrastructure.

---

# 18. USER EXPERIENCE AND VISUAL CONSISTENCY

The new Employee experience must maintain the established BMIS design language.

Use existing:

- Ant Design components.
- Typography.
- Spacing.
- Colors.
- Shadows.
- Border radii.
- Form validation patterns.
- Notification patterns.
- Loading states.
- Modals.
- Transitions.

Avoid introducing unrelated design systems or unnecessary dependencies.

## 18.1 Admin Assignment UX

Provide:

- Clearly labeled assignment selector.
- Current assignment display.
- Searchable Employee options.
- Appropriate success/error notifications.
- Loading/disabled states during submission.
- Confirmation when a potentially significant reassignment or unassignment occurs, consistent with existing UX conventions.

## 18.2 Employee Queue UX

Prioritize:

- Readability.
- Fast ticket discovery.
- Clear current status.
- Clear action buttons.
- Consistent categories.
- Proper custom labels.
- Responsive layout.
- Clean empty states.

## 18.3 Accessibility

Ensure:

- Clear form labels.
- Keyboard-accessible controls.
- Appropriate disabled states.
- Visible error messages.
- Readable status indicators.
- Adequate contrast.
- Consistent focus behavior.

Do not rely only on color to communicate status.

---

# 19. PERFORMANCE AND MAINTAINABILITY

Follow existing project conventions.

Prefer:

- Reusable role-guard middleware.
- Existing API service abstractions.
- Reusable ticket serialization.
- Existing notification components.
- Shared role constants or helpers when appropriate.
- Focused, maintainable functions.
- Server-side database filtering.
- Minimal additional dependencies.

Avoid:

- Rewriting entire feature modules unnecessarily.
- Duplicating ticket listing logic.
- Duplicating authorization rules across controllers without shared helpers where appropriate.
- Adding global state libraries without a clear requirement.
- Creating unrelated features.
- Changing application styling globally.
- Large database migrations without necessity.
- Overengineering ticket dispatch into a new independent subsystem.

The target is a reliable extension that remains understandable and maintainable by the existing development team.

---

# 20. IMPLEMENTATION ACCEPTANCE CRITERIA

Do not consider the revamp complete until the following criteria have been evaluated.

## Backend

- [ ] Employee role supported by account model.
- [ ] Legacy Resident/User compatibility preserved.
- [ ] Public registration remains Resident-only.
- [ ] Admin role changes support Employee.
- [ ] Confirmation email remains mandatory.
- [ ] Generic profile updates cannot modify roles.
- [ ] Employee directory is Admin-only.
- [ ] Ticket schema supports assignment.
- [ ] Admin can assign, reassign, and unassign.
- [ ] Pending assignment triggers In Progress.
- [ ] Archived tickets reject assignment.
- [ ] Assignment history is preserved.
- [ ] Employee ticket listing is strictly scoped.
- [ ] Employee ticket details are strictly scoped.
- [ ] Employee updates are restricted to current assignments.
- [ ] Employees cannot modify Admin-only fields.
- [ ] Employees cannot access archives or global analytics.
- [ ] Current database role is authoritative.
- [ ] Demotion/deactivation removes active assignments.
- [ ] AUD-01 privacy remains intact.
- [ ] Existing resolution and archive behavior remains intact.

## Frontend

- [ ] Persistent AppLayout preserved.
- [ ] Header collapse/expand behavior preserved.
- [ ] Measured navigation indicator preserved.
- [ ] Existing entrance motion preserved.
- [ ] Employee navigation is role-specific.
- [ ] Employee has an Assigned Tickets queue.
- [ ] Queue supports search and filtering.
- [ ] No system-wide analytics appear for Employees.
- [ ] Admin Ticket Details includes assignment controls.
- [ ] Employee Ticket Details includes permitted communication.
- [ ] Employee Admin-only controls are hidden.
- [ ] Resident Ticket Details shows permitted assignment information.
- [ ] Resident privacy remains intact.
- [ ] Change Role modal supports Employee.
- [ ] Email confirmation and modal behavior remain intact.
- [ ] Direct unauthorized frontend routes are blocked.
- [ ] Existing Admin/Resident functionality remains usable.

## Testing

- [ ] Focused backend tests added.
- [ ] Cross-role authorization tested.
- [ ] Assignment/reassignment tested.
- [ ] Role demotion/deactivation tested.
- [ ] Public/internal communication privacy tested.
- [ ] Existing 56 browser test cases preserved.
- [ ] New browser coverage added.
- [ ] Normal database untouched by test fixtures.
- [ ] Existing regressions identified separately.
- [ ] Changed functionality verified to the extent supported by the environment.

---

# 21. FINAL DELIVERY REPORT

After implementation, produce a clear final report.

Use the following structure.

## A. Implementation Summary

Briefly explain what was accomplished and how the new three-role architecture works.

## B. Files Modified

Provide a table:

| File | Change Made | Reason |
|---|---|---|
| Actual file path | Description | Purpose |

Use actual modified file paths, not assumed ones.

## C. Backend Changes

Summarize:

- Role modifications.
- New or updated endpoints.
- Ticket assignment logic.
- RBAC enforcement.
- Privacy protections.
- Account-transition behavior.

## D. Frontend Changes

Summarize:

- Employee workspace.
- Navigation and routing.
- Admin assignment controls.
- Ticket Details role behavior.
- Change Role modal.

## E. Testing Results

Include:

| Test Area | Executed | Passed | Failed | Notes |
|---|---:|---:|---:|---|
| Backend focused tests | Actual | Actual | Actual | Findings |
| Existing regression tests | Actual | Actual | Actual | Findings |
| Playwright browser tests | Actual | Actual | Actual | Findings |
| Security/permission tests | Actual | Actual | Actual | Findings |

Do not invent passing test results.

Clearly distinguish:

- Passed tests.
- Failed tests.
- Tests not executed.
- Pre-existing failures.
- New regressions.
- Environment-related blockers.

## F. Manual Testing Instructions

Provide explicit, numbered instructions for testing:

1. Admin login.
2. Employee role creation.
3. Employee assignment.
4. Employee login.
5. Assigned ticket visibility.
6. Employee progress update.
7. Resident public update visibility.
8. Employee permission restrictions.
9. Ticket reassignment.
10. Employee demotion/deactivation.
11. Admin resolution and archival.
12. Regression checks for previous functionality.

Specify exactly which role to use, which page to navigate to, which action to perform, and the expected result.

## G. Remaining Issues and Considerations

Report:

- Unresolved problems.
- Potential edge cases.
- Any migration requirements.
- Test environment limitations.
- Future improvement opportunities.

Do not hide incomplete work.

---

# 22. NON-GOALS AND SCOPE BOUNDARIES

The following features are **not required** for this revamp:

- Multi-Employee ticket assignment.
- Automatic Employee selection.
- AI-based dispatching.
- Employee performance analytics.
- Employee GPS tracking.
- Real-time staff location monitoring.
- A new notification infrastructure.
- A separate mobile application.
- A new authentication framework.
- An entirely new design system.
- Major database restructuring.
- Rebuilding the entire BMIS application.

A future Employee "Request Resolution" workflow may be useful, but it is intentionally excluded from the current scope.

Focus on completing the requested three-role architecture correctly.

---

# 23. FINAL AGENT OPERATING INSTRUCTIONS

You are expected to work as an autonomous but careful engineering agent.

Follow these principles throughout implementation:

**1. Inspect before modifying.**

Do not guess at files, endpoints, schema structures, or existing behavior.

**2. Preserve completed work.**

Never sacrifice existing tested functionality to simplify the new role architecture.

**3. Security must be enforced server-side.**

Frontend visibility is a UX concern, not an authorization boundary.

**4. Extend instead of replacing.**

Prefer compatible additions and focused modifications.

**5. Verify before advancing.**

Use phase-specific tests to discover regressions early.

**6. Protect the user's data and Git state.**

Do not run destructive commands or touch normal data with test fixtures.

**7. Avoid unrelated feature expansion.**

Stay focused on Admin, Employee, and Resident workflows.

**8. Reuse existing architecture.**

Do not create duplicate controllers, endpoints, models, or UI systems when existing components can be safely extended.

**9. Be transparent about failures.**

Never claim a test passed unless it actually ran and passed.

**10. Finish with a complete report.**

Explain exactly what changed, what was verified, what remains unresolved, and how the user can test the system manually.

## EXECUTION DIRECTIVE

Begin by reading `Context/BMIS session handoff.md` and inspecting the current repository state.

Then execute Phase 0 through Phase 5 in order.

You may make implementation decisions independently when the repository clearly establishes the appropriate pattern.

When repository evidence conflicts with an example in this specification, preserve the existing compatible behavior and satisfy the security and workflow intent rather than blindly copying the example.

Prioritize:

**Data Integrity → Security → Existing Functionality → New Role Workflow → User Experience → Regression Verification.**

The implementation is successful when the three roles operate as a coherent dispatch system, all Employee permissions are enforced by the backend, Admin and Resident functionality remains intact, and the changes are demonstrably verified without damaging the existing project.