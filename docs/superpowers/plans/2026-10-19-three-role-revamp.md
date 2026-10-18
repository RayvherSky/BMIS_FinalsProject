# Three-role dispatch revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement the complete approved Admin/Employee/User dispatch structure and five additive demo accounts while preserving tested BMIS behavior.

**Architecture:** Extend the existing Express/Mongoose/JWT APIs and persistent React layout. Centralize effective-role and authorized-ticket serialization, add single-assignee history and current-assignment writes, and render distinct Employee and User role layouts in the same authenticated shell.

**Tech Stack:** Existing React 18, Vite, Ant Design, Express, Mongoose/MongoDB, JWT, Node tests and Playwright; no additional application dependencies.

**Spec:** `docs/superpowers/specs/2026-10-19-three-role-revamp-design.md`, implementing `Context/majorrevamp.md` with the recorded user overrides.

## Global Constraints

- Canonical `admin` / `employee` / `user`; legacy resident account/link compatibility.
- Preserve existing accounts, reports, uploads, uncommitted edits, all 62 browser scenarios, and the existing Admin interface.
- Admin-only assignment, priority, master status, duplicates, archive and user management.
- Employee reads/writes only currently assigned active tickets; no archive/global analytics/User Management.
- User responses exclude internal notes, staff email/history, and foreign linked-report contents.
- One new Admin, two Employees, two Users; additive provisioning only.
- Shared login; different Employee/User layouts; existing BMIS branding and component library.
- No commits, normal-data seeding/resets, dependency replacement, or unsupported MongoDB transactions.

## Review Focus

1. An already-open Employee page loses assignment during a delayed post: no new message or cached restricted record remains after denial.
2. Concurrent assignment and role/deactivation changes: no newly eligible assignment escapes cleanup, and failures are reported accurately.
3. Existing resident accounts and copied detail/filter URLs: login and redirects preserve access, query parameters, and navigation destinations.
4. Populated linked tickets, authors and assignees: no private note, staff email, history or foreign content crosses a role boundary.
5. A rerun or email collision during demo provisioning: no existing account, password or ticket is replaced.

## Task 1: Backend role, dispatch and account lifecycle foundation

**Files:** Existing server models/controllers/routes/middleware; new focused helpers in `server/utils`, `server/controllers/assignmentController.js` if needed; new `server/tests/dispatch-roles.test.js`; additive `server/scripts/provision-accounts.js` and its tests.

**Interfaces:** Consumes existing User/Ticket schemas and route conventions. Produces all API contracts and projections in the design document. Return normal response objects, not a new envelope. Expose `name` as well as firstName/lastName on the Employee directory.

- [x] Write failing isolated HTTP/MongoDB/JWT tests for canonical/legacy roles, Employee login, public registration role injection, confirmed role changes, inactive access, and generic-update bypasses.
- [x] Run `node --test --test-isolation=none server/tests/dispatch-roles.test.js`; confirm missing Employee/dispatch behavior fails.
- [x] Implement role normalization, inactive account checks, explicit role scopes, safe user projections and the Admin-only Employee directory.
- [x] Add failing cases for assignment validation, Pending transition, no-op assignment, reassignment/unassignment history, archives, missing/malformed IDs, other-role targets, and forged protected fields.
- [x] Implement schema/history and conditional Admin assignment, serializing target eligibility with account transitions in this single-process service.
- [x] Add cases for Employee list/detail/note scopes, query tampering, foreign/private populated references, reassignment-before-write, and demotion/deactivation cleanup failure.
- [x] Implement current-assignment note writes, role-specific serialization and recorded transition cleanup. Preserve all existing Admin/User lifecycle behavior.
- [x] Write and run provisioning tests for exactly the requested role counts, collisions, reruns and preservation; implement additive provisioning with ignored local credentials, no seeds or ticket writes.
- [x] Run the existing 46 focused checks plus the new tests; adapt only the deliberately changed canonical role contract, retaining each scenario and assertion's behavior. Expected: all pass, zero skipped.

## Task 2: Distinct role interfaces and compatible navigation

**Files:** `client/src/App.jsx`, AuthContext, ProtectedRoute, AppLayout; new client role helper, Employee queue, scoped role CSS; existing User dashboard/MyTickets/SubmitTicket/Profile/TicketDetails/UserManagement and API helpers.

**Interfaces:** Uses Task 1 API contracts. Employee primary route `/employee/assigned-tickets`; standard primary route `/user/dashboard`. Old resident routes redirect to corresponding user routes with query/state preserved. Note and ticket response shapes remain compatible plus assignment data.

- [x] Add failing browser scenarios for Employee login/queue restrictions, User canonical/legacy routes, and the visually distinct role workspaces.
- [x] Implement explicit role helpers, login redirects, guarded role routes and persistent role-aware shell. Unknown roles deny access.
- [x] Implement the Employee operational queue using only scoped API results, with category/status/search, custom labels and loading/empty/error/refresh states.
- [x] Restyle the User portal and cards while retaining personal statistics actions, search/fuzzy/filter/sort/pagination, report submission fields/upload rules and profile functionality.
- [x] Extend TicketDetails with Admin assignment/history, Employee read-only details/public/internal updates and denial clearing, and User-safe assignment display/replies. Retain existing async route-identity guards.
- [x] Extend Change Role and account status controls, preserving target-email confirmation, cancel/reset/retry and current-role refresh behavior.
- [x] Run affected browser cases and production build. Expected: all selected cases pass, build exits 0.

## Task 3: End-to-end regression, privacy and lifecycle acceptance

**Files:** Existing six Playwright files; new `client/tests/dispatch-roles.spec.js`; isolated test-server fixtures only as needed.

**Interfaces:** Runs against the completed Task 1/2 stack and fresh temporary test MongoDB/API/Vite on 5001/3001.

- [x] Preserve all original 62 scenarios; change only role/URL/copy expectations required by the approved User rename and layout, preserving tested functionality.
- [x] Exercise Admin promotion and assign/reassign/unassign, two Employees' scoped access and messages, User public/private visibility, deactivation/demotion, archived denial, priority/status/role bypass attempts, direct route guards and mobile workspaces.
- [x] Run all focused backend checks, then full Playwright with BMIS_FRONTEND_ONLY unset, then `npm run build`. Expected: no failed/skipped/flaky cases; build exit 0.
- [x] Diagnose any failures from artifacts and patch only their responsible layer; repeat relevant proof after actual changes.

## Task 4: Add requested accounts and deliver verified structure

**Files:** Provisioning command from Task 1; local ignored credentials; `docs/changes/2026-10-19-three-role-revamp.md`; `Context/SESSION_HANDOFF.md`; plan progress record.

**Interfaces:** Uses the verified provisioner against the existing normal database, creating only the requested five accounts. Preserve unrelated accounts and all tickets; do not run the destructive seed command.

- [x] Perform an independent review of this revamp's changes against the design and Review Focus; correct important findings with failing regression cases first.
- [x] Check normal database availability without stopping unrelated services; run the approved additive provisioner once and verify all existing records remain, exactly five new accounts exist, and each new role logs into its correct workspace.
- [x] Confirm test-owned services/photos are cleaned up; run relevant syntax/whitespace checks.
- [x] Record actual test/build outcomes, endpoints, files changed, account handling, manual role-by-role steps, and any remaining limitations. Update handoff with the exact stopping point.

## Execution record

The user's latest message explicitly authorizes implementation of the whole selected structure. No additional feature approval is needed. Preserve the current dirty checkout as the actual tested baseline; no reset, clean, staging or commits. Keep a pre-edit source snapshot and a progress ledger for recovery and review.
