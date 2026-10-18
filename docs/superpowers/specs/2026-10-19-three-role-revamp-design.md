# Three-role dispatch revamp — agreed design

Authority: `Context/majorrevamp.md` in full, with the user's explicit decisions below taking precedence. The user selected direction 1 and instructed implementation of the whole structure.

## Confirmed scope

- Canonical roles: `admin`, `employee`, `user`. Existing stored `resident` accounts remain compatible; new accounts and URLs use `user`. Existing `/resident/...` links redirect while retaining query parameters and navigation state.
- Add one new Admin, two Employees, and two Users alongside existing accounts and reports. Never reset, reseed, drop, or bulk-rewrite normal data.
- Keep the BMIS logo, colors, Ant Design components, shared login, and existing Admin interface. Employee and User screens have distinct layouts: an operational staff queue versus a card-based reporting portal.
- Extend completed functionality. Preserve priority rules, public/internal note privacy, foreign-link redaction, Others/phone validation, archive/restore lifecycle, searchable tiles, existing API search, persistent navigation, and reduced motion.

## Role and workflow contract

Admin alone assigns/reassigns/unassigns, controls priority and master status, manages roles/accounts, links duplicates, and archives/restores. An assignment changes Pending to In Progress; reassignment retains the other statuses; unassignment never resets the status. Active means not archived, as defined in the supplied document; assignment does not reopen archived tickets.

Employee reads only currently assigned active tickets and their authorized communication. Employees cannot submit reports, read an old personal-report endpoint, see archives/global analytics/users, or change any Admin-controlled fields. Current assignment must be checked in the note write itself. Reassignment, unassignment, archiving, demotion, or deactivation removes access. A denied request clears cached restricted details.

Users retain report submission, owned lists/details, replies, evidence upload, search/fuzzy matching, filters, statistics navigation, and profile controls. New reports start Medium. They see public messages and the assigned staff's display name, never staff email, internal notes, assignment history, or unauthorized linked-report contents.

## Backend interfaces

- `GET /api/users/employees`: Admin only; active Employee `_id`, firstName, lastName, name, email.
- `PATCH /api/users/:id/role`: existing `{ role, confirmationEmail }`; accepts canonical roles plus the legacy resident alias, writes canonical roles.
- `PATCH /api/users/:id/active`: Admin-only `{ isActive, confirmationEmail }`; supports the document's account deactivation/reactivation workflow, preserves records, rejects self-deactivation.
- `PATCH /api/tickets/:id/assign`: Admin only; `{ assignedTo: employeeId | null }`; returns updated authorized ticket.
- Existing ticket list/detail/note routes are extended with explicit role and assignment scopes. Other action routes remain Admin-only.
- Existing account and auth responses exclude passwords and password-reset credentials. Authorization reloads the current database account and rejects inactive accounts.

Assignment schema: optional `assignedTo`, `assignedAt`, and `assignmentHistory`. A history item has `previousEmployee`, `newEmployee`, `changedBy`, `createdAt`, `action` (`assigned`, `reassigned`, `unassigned`), and optional reason. Only Admin responses include assignment history. Existing records require no migration.

Account schema adds `isActive` defaulting true; legacy missing values count as active. Employee-to-other-role transitions and deactivation remove active assignments with recorded history. Cleanup failure is an explicit failure, never reported as complete. Serialize assignment/role transitions per Employee within the existing single-process localhost service and use conditional ticket writes to avoid lost concurrent changes. No replica-set or multi-document transaction requirement is introduced.

Reuse the notes array. Store server-selected message kind/author-role provenance for new replies/updates/internal notes; legacy messages remain readable without rewriting them. Client-supplied author, kind, role, assignment, or history fields cannot grant permission.

## Frontend

One persistent AppLayout remains the authenticated route parent. It selects role-specific presentation without remounting during role navigation. Keep accessible collapse/expand, measured active indicator, existing motion, and reduced-motion behavior.

- Admin: retain dashboard, charts, directory, archive and existing controls; add Employee assignment/history and account role/status controls.
- Employee: `/employee/assigned-tickets`, `/employee/ticket/:id`, profile. Compact queue, search/category/status filters, read-only status/priority, explicit public/internal composers, refresh/loading/empty/error states. No global counts/charts.
- User: `/user/dashboard`, `/user/submit-ticket`, `/user/my-tickets`, `/user/ticket/:id`, profile. A visibly different reporting portal with prominent actions, clickable personal statistics, report cards, readable details/timeline and replies. Preserve existing filters, pagination, sorting and upload behavior.
- One shared login redirects by current canonical role. Old resident routes remain compatibility redirects. Profile styling follows the current role.

## Provisioning and verification

Provide an additive, rerunnable provisioning command for exactly five new demo accounts. It must refuse collisions with unrelated existing users, never reset passwords on rerun, never seed ticket data, and keep generated credentials in ignored local storage. Return the new login details to the user after creation.

Starting evidence: 46 focused checks, 62 browser cases and the production build passed before this change. Preserve all existing test scenarios; adapt literal role/route expectations only for the approved User rename. Add real isolated MongoDB/JWT tests for three roles, assignment lifecycle/races, account transitions, privacy and bypass attempts, plus browser coverage for the full dispatch flow and distinct responsive interfaces. Final gates include all focused checks, full Playwright suite, build, relevant syntax/whitespace, and independent review. No normal database is used for automated tests.

No commits, pushes, destructive migrations, notification infrastructure, GPS, teams/multiple assignees, new master statuses, or Employee final-disposition action.
