# BMIS — Barangay Baclaran

A localhost MERN application for reporting and tracking non-emergency incidents and hazards in Barangay Baclaran, Parañaque City. Users submit reports, Employees work on assignments, and Admins coordinate triage, review, resolution, accounts and archives.

## Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 18, Vite 5, Ant Design 5, React Router 6, Axios, Day.js |
| Backend | Node.js, Express 4, Mongoose 8 |
| Database | MongoDB |
| Authentication / evidence | JWT, bcrypt password hashes, Multer, local image uploads |
| Testing | Node test runner, isolated MongoDB instances, Playwright |

## Roles and features

**User:** register with a required Philippine mobile number and optional email; log in by phone or email; submit reports with an editable contact snapshot and optional evidence; search/filter/sort/page through own reports; read public updates and reply; submit eligible follow-ups, progress requests and dismissal appeals; edit own profile/password.

**Employee:** work from a current-assignment queue; view reporter contact details; add public updates or internal notes; **Submit for Review**; handle eligible User requests in an assignment-scoped **Action Center**. Final status, priority, links, assignment, archive and account controls remain Admin actions.

**Admin:** use active-only dashboard counts, charts, status tiles and filters; set priority; assign/reassign/unassign active Employees; link eligible duplicates across categories; review Employee work in **For Review**; handle User requests/appeals in **Action Center**; resolve/dismiss/revert reports with history; manage archives and account contacts, roles and activity.

Legacy `resident` roles and `/resident/...` links remain compatible with canonical `user` roles and `/user/...` routes.

## Workflow rules

### Reports, assignment and review

Reports start **Pending** with **Medium** priority. Ownership comes from the authenticated User. A valid Philippine mobile contact is required for submission and stored as a snapshot; legacy reports may fall back to account contact. **Others** requires a custom category description.

Assigning a Pending report to an active Employee changes it to **In Progress** and records history. Reassignment invalidates earlier review. Employee deactivation/role changes clear active assignments while preserving reports and history.

An ordinary Admin public update or resolution on an assigned report requires a current **pending** Employee review. Either action completes review. **Mark Reviewed** also completes it without posting a note or changing status. Another ordinary public update/resolution needs another Employee submission. Internal notes, Admin triage, unassigned reports and User-request/appeal handling remain available under their own rules.

Direct resolution sequence: **Employee Submit for Review → Admin For Review → Mark Resolved**. Posting an Admin public update or selecting Mark Reviewed first consumes that review.

### Linked resolution and archives

Admin resolution also resolves connected unresolved tickets, following duplicate links in both directions and through chains. Cycles are handled without repeatedly visiting a ticket. The selected assigned ticket still requires pending review; propagated resolution does not require separate reviews on linked tickets.

Each newly resolved member is archived with a completion timestamp and status-history event. Already-resolved linked reports retain their completion history/timestamps. Other status changes do not propagate.

New **Resolved** reports immediately leave active lists and appear in Admin **Archive**. **Dismissed** reports remain active until manually archived. Restoring one preserves its status/completion time and does not restore its whole linked group. Use **Revert Status** with a reason for an eligible backward change; restore is not reopen.

Group resolution uses sequential conditional writes and process-local locks, not a multi-document transaction. A conflict can leave part of the group resolved; retrying resolution finishes remaining members.

### Requests and communication

| Request | Available on | Handling |
| --- | --- | --- |
| Follow-up | Own active Pending report | Admin or eligible assigned Employee |
| Progress update | Own active In Progress report | Admin or eligible assigned Employee |
| Appeal | Own Dismissed report, including archived dismissals | Admin decision |

Follow-up/progress requests are limited to one of the same type per Manila calendar day; another is blocked while an earlier same-type request is unresolved. Appeals require an explanation and are limited to one per dismissal; no appeal deadline is implemented. Viewing/acknowledgement does not complete a request; a response or appeal decision does.

Defaults: 5 User / 20 staff notes per ticket per rolling minute, 20 User / 100 staff communication reservations per rolling ten minutes, and a 60-second duplicate-note window. Configure thresholds through `server/config/communicationLimits.js` and its `BMIS_*` variables. These are communication limits, not general HTTP or incident-creation rate limits.

## Requirements and installation

- Node.js **20.19+** and npm for the app. Node.js **24** is the verified environment and supports the test commands below.
- MongoDB: existing local service or included launcher.
- Google Chrome for browser tests, or Playwright Chromium.

From the repository root:

```powershell
Set-Location server
npm install
Set-Location ../client
npm install
```

Copy `server/.env.example` to `server/.env` for a fresh checkout and set a long local secret:

```dotenv
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/bmis
JWT_SECRET=replace-with-your-own-long-secret
JWT_EXPIRE=7d
```

Vite defaults to `http://localhost:5000` for `/api` and `/uploads`. For another API port, set the matching `PORT` in `server/.env` and create ignored `client/.env`, for example:

```dotenv
BMIS_API_TARGET=http://127.0.0.1:5002
```

**This workspace uses API 5002 and frontend 3000** because another application occupies 5000. A process-level `BMIS_API_TARGET` overrides the client environment-file value.

### Database and demo accounts

Start your existing MongoDB service. If none is running, use a separate terminal from `server/`:

```powershell
npm run db
```

The launcher runs MongoDB 8.2.6 on localhost port 27017, downloading it on first use if needed. Data persists in ignored `server/.local-data/mongodb/`. Keep its terminal open and avoid starting a second instance on an occupied port.

For a fresh demonstration database, run `npm run seed` from `server/`. **Seeding replaces the configured users and tickets; do not reseed records you need to keep.** It creates **15 accounts: 3 Admin, 2 Employee and 10 User**, plus 28 reports: 13 Resolved, 7 Dismissed, 3 In Progress and 5 Pending. Seeded completed reports initially remain active for archive demonstrations; new resolutions auto-archive.

The seed prints credentials grouped by role. Original samples, including `maria.santos@email.com` (Admin) and `ana.reyes@email.com` (User), use `Password123!`. Additional dispatch accounts have saved/generated passwords; not every account shares that sample password. Local credentials are ignored at `server/.local-data/demo-accounts-2026-10-19.json` unless overridden.

| Additional role | Email |
| --- | --- |
| Admin | `dispatch.admin@bmis.test` |
| Employee | `dispatch.employee1@bmis.test` |
| Employee | `dispatch.employee2@bmis.test` |
| User | `dispatch.user1@bmis.test` |
| User | `dispatch.user2@bmis.test` |

Registration creates Users only; seed/create the initial Admin before using account controls. Existing databases with a legacy email index may need `server/scripts/migrate-account-indexes.js`; inspect its supported options and resolve reported contact conflicts before applying changes. Current indexes enforce unique optional email and normalized phone identities.

## Run

With MongoDB running, start separate terminals:

```powershell
# Backend, from server/
npm run dev
```

```powershell
# Frontend, from client/
npm run dev
```

Open **http://localhost:3000**. API health is `/` on the configured API port, e.g. **http://127.0.0.1:5002/** here. Use separate browser profiles or normal/incognito windows for roles: tabs in one profile share localStorage login.

## Demo walkthrough

1. As a User, submit two reports about the same issue. Optional evidence: one JPEG/JPG, PNG or WebP image up to **5 MB**.
2. Open **My Tickets** to search/filter and inspect reports. Users access their own reports and public conversation.
3. As Admin, assess priority on the primary and **Link Multiple Duplicates** to the other unresolved active report.
4. Assign an active Employee; the Pending primary becomes In Progress.
5. As that Employee, open **Assigned Tickets**, add progress information and **Submit for Review**.
6. As Admin, open **For Review** and **Mark Resolved** directly. Review completes and the connected unresolved group resolves/archives.
7. Refresh **Archive** to inspect both reports. Restoring one preserves Resolved status/time; it does not reopen/restore the whole group.
8. On a separate eligible report, demonstrate a User request or dismissal appeal through **Action Center**. Internal staff notes stay hidden from User responses.
9. Use **Users** for contact editing and separately confirmed role/activity changes; use **Profile** for own-account editing.

Active lists exclude archived resolutions. Use Admin Archive for final proof. Owners retain authorized direct-detail access and have an archived-Dismissed list option for appeals.

## API overview

Protected calls use `Authorization: Bearer <token>`. Roles, ownership and input are enforced server-side.

| Area | Routes |
| --- | --- |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/profile` |
| Demo recovery | `POST /api/auth/forgot-password`, `POST /api/auth/reset-password/:token` |
| Reports | `POST /api/tickets`, `GET /api/tickets`, `GET /api/tickets/my-tickets`, `GET /api/tickets/:id` |
| Notes | `POST /api/tickets/:id/notes` |
| Lifecycle | `PATCH /api/tickets/:id/assign`, `PUT /api/tickets/:id/status`, `PATCH /api/tickets/:id/priority`, `POST /api/tickets/:id/revert` |
| Links | `PUT /api/tickets/:id/link`, `PUT /api/tickets/:id/unlink` |
| Reviews | `GET /api/tickets/reviews`, `POST /api/tickets/:id/review`, `PATCH /api/tickets/:id/review` |
| Requests | `GET /api/tickets/requests`, `POST /api/tickets/:id/requests`, `PATCH /api/tickets/:id/requests/:requestId` |
| Accounts | `GET /api/users`, `GET /api/users/employees`, `GET /api/users/:id`, `PUT /api/users/:id`, `PATCH /api/users/:id/role`, `PATCH /api/users/:id/active` |
| Archive | `GET /api/archive`, `PUT /api/archive/:id/archive`, `PUT /api/archive/:id/restore` |

Protected requests load current role/activity from MongoDB. Employee access is assignment-scoped; User responses omit private notes and staff workflow metadata. Collections are `users`, `tickets` and `communicationquotas`. Notes, requests and histories are embedded in tickets. Images live in `server/uploads/` with paths stored in tickets.

## Verification

From the repository root:

```powershell
node --test --test-concurrency=1 server/tests/*.test.js
node --test client/tests/role-contract.test.js
```

From `client/`:

```powershell
npm run build
npm test
```

Playwright uses isolated API **5001**, frontend **3001** and fresh temporary MongoDB; it does not seed the normal `bmis` database. First use may download MongoDB. Screenshots/traces appear in ignored `client/test-results/`. Avoid competing acceptance servers and run database suites sequentially.

For frontend contract checks without MongoDB: `npm run test:frontend` from `client/`.

To use Playwright Chromium:

```powershell
npx playwright install chromium
$env:PLAYWRIGHT_CHANNEL = 'chromium'
npm test
```

Coverage includes contacts, authorization, assignments, reviews, requests/appeals, lifecycle/history/archive, linked-group resolution, privacy and frontend workflows. Run checks before reporting a fresh passing result.

## Project layout

```text
assets/                 Shared images
client/src/             React pages, components, API helpers and styles
client/tests/           Browser and role-contract tests
server/config/          Database and communication configuration
server/controllers/     API handlers and business logic
server/middleware/      Authentication, roles and uploads
server/models/          Mongoose schemas and embedded structures
server/routes/          Express endpoints
server/scripts/         DB/test launchers, provisioning and index migration
server/seeders/          Replaceable demonstration dataset
server/tests/           Backend and isolated-database tests
server/uploads/         Local evidence; uploaded files ignored
server/utils/           Access, lifecycle, contacts, review and request policies
```

Local prompts, context, documentation/presentation exports, backlog notes, screenshot exports, secrets, databases and generated artifacts are excluded through `.gitignore`. Source, required assets, lockfiles, configuration examples and tests remain versioned.

## Scope and limits

- Localhost, non-emergency demonstration; not a deployed emergency service.
- Recovery returns a demo reset token/link; **no email or SMS is sent**.
- Evidence uses local disk/static serving, not cloud or authenticated private media storage.
- Location is text; GPS dispatch, notifications and an operator connection are not implemented.
- Locks coordinate one Node process; distributed locks and transactional linked-group rollback are not provided.
