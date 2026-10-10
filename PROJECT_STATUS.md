# BMIS — Project Ledger & Agent Handoff

> **What is this file?** This is a shared status document between the **Planner Agent** (architecture, specs, audit) and the **Builder Agent** (code implementation). Both agents should read this file before starting work and update it as tasks are completed. Keep it in the project root so all agents can access it.

---

## 🏗️ Project Overview

| Field | Value |
|-------|-------|
| **Project** | Barangay Incident & Hazard Reporting System (BMIS) |
| **Target Client** | Barangay Baclaran, Parañaque City |
| **Stack** | MERN (MongoDB, Express.js, React.js + Vite, Node.js) |
| **UI Library** | Ant Design (antd) + @ant-design/icons |
| **Theme** | Government-themed green/blue (#0A4D68 primary, #2D6A4F secondary, #D4A017 accent) |
| **Deployment** | Localhost only |
| **Demo Requirements** | 10 users (2 admin, 8 resident), 20+ completed tickets, clean data |
| **Demo Password** | `Password123!` for all seeded accounts |

---

## 📋 Master Task Checklist

Mark tasks `[x]` when completed. Add your agent name and timestamp when updating.

### Backend (Server) — ✅ ALL COMPLETE

- [x] `server/config/db.js` — MongoDB connection
- [x] `server/models/User.js` — User schema with bcrypt hashing
- [x] `server/models/Ticket.js` — Ticket schema with all fields
- [x] `server/middleware/authMiddleware.js` — JWT verification
- [x] `server/middleware/roleMiddleware.js` — Role-based access
- [x] `server/middleware/uploadMiddleware.js` — Multer image upload
- [x] `server/controllers/authController.js` — Register, login, profile, password recovery
- [x] `server/controllers/ticketController.js` — CRUD, status updates, linking
- [x] `server/controllers/userController.js` — Admin user management
- [x] `server/controllers/archiveController.js` — Archive/restore logic
- [x] `server/routes/authRoutes.js` — Auth endpoints
- [x] `server/routes/ticketRoutes.js` — Ticket endpoints
- [x] `server/routes/userRoutes.js` — User management endpoints
- [x] `server/routes/archiveRoutes.js` — Archive endpoints
- [x] `server/server.js` — Express app entry point
- [x] `server/seeders/seed.js` — 10 users + 20+ tickets seed script
- [x] `server/.env` — Environment variables
- [x] `server/package.json` — Dependencies defined
- [x] `npm install` — Server dependencies installed

### Frontend (Client) — Config & Setup ✅ COMPLETE

- [x] `client/package.json` — Dependencies defined (react, react-dom, react-router-dom, axios, antd, @ant-design/icons, dayjs)
- [x] `client/vite.config.js` — Vite config with proxy to localhost:5000
- [x] `client/index.html` — HTML entry point
- [x] `client/src/main.jsx` — React entry with BrowserRouter
- [x] `client/src/App.jsx` — Routes + ConfigProvider theme
- [x] `client/src/App.css` — Global styles, government theme

### Frontend — Context & API Layer ✅ COMPLETE

- [x] `client/src/context/AuthContext.jsx` — Auth state, login/logout/register/updateProfile
- [x] `client/src/api/axios.js` — Axios instance with interceptors
- [x] `client/src/api/ticketApi.js` — Ticket API calls
- [x] `client/src/api/userApi.js` — User API calls
- [x] `client/src/api/archiveApi.js` — Archive API calls

### Frontend — Reusable Components ✅ COMPLETE

- [x] `client/src/components/ProtectedRoute/ProtectedRoute.jsx` — Auth + role guard
- [x] `client/src/components/Layout/AppLayout.jsx` — Sidebar + Header layout
- [x] `client/src/components/StatusBadge/StatusBadge.jsx` — Color-coded status tag
- [x] `client/src/components/TicketCard/TicketCard.jsx` — Ticket summary card

### Frontend — Utilities ✅ COMPLETE

- [x] `client/src/utils/helpers.js` — formatDate, getPriorityColor, getCategoryIcon

### Frontend — Auth Pages ✅ COMPLETE

- [x] `client/src/pages/Login.jsx` — Login form
- [x] `client/src/pages/Register.jsx` — Registration form
- [x] `client/src/pages/ForgotPassword.jsx` — Forgot password + token display
- [x] `client/src/pages/ResetPassword.jsx` — Reset password with token

### Frontend - App Pages COMPLETE (8 pages verified)

- [x] `client/src/pages/Profile.jsx`
- [x] `client/src/pages/ResidentDashboard.jsx`
- [x] `client/src/pages/SubmitTicket.jsx`
- [x] `client/src/pages/MyTickets.jsx`
- [x] `client/src/pages/AdminDashboard.jsx`
- [x] `client/src/pages/TicketDetails.jsx`
- [x] `client/src/pages/UserManagement.jsx`
- [x] `client/src/pages/ArchiveView.jsx`

### Setup & Testing COMPLETE

- [x] Run `npm install` in `client/`
- [x] Start backend (`cd server && npm run dev`) — verify no crashes
- [x] Start frontend (`cd client && npm run dev`) — verify no crashes
- [x] Run seed script (`cd server && npm run seed`) — verify 10 users + 20+ tickets
- [x] Test full ticket lifecycle (submit → process → resolve → archive → restore)
- [x] Test role-based access (resident vs admin)
- [x] Test password recovery flow
- [x] Test image upload on ticket submission
- [x] Test duplicate ticket linking
- [x] Create README.md

---

## App Page Specifications

> **Builder Agent**: Use these specs to build each page. All pages use Ant Design components, functional React with hooks, and wrap content inside `<AppLayout>`. Import API functions from `src/api/`. Import `useAuth` from `src/context/AuthContext`. Handle loading with `<Spin>` and errors with `message.error()`.

---

### Page 1: `Profile.jsx`

**Route:** `/profile` (any authenticated user)  
**Wrapped in:** `AppLayout`

**Layout:**
- Page title: "My Profile"
- Ant Design `Card` containing a `Descriptions` component showing current user info (read-only view)
- "Edit Profile" button opens an editable `Form` (can be inline toggle or modal):
  - `firstName` (Input)
  - `lastName` (Input)
  - `phone` (Input)
  - `address` (Input)
  - `password` (Input.Password, optional — only updates if filled)
- Save button calls `updateProfile()` from `AuthContext`
- Success: `message.success("Profile updated")`

**Data source:** `useAuth()` → `user` object

---

### Page 2: `ResidentDashboard.jsx`

**Route:** `/resident/dashboard` (resident only)  
**Wrapped in:** `AppLayout`

**Layout:**
- Welcome heading: "Welcome, {user.firstName}!"
- Row of 4 `Card` components with `Statistic`:
  - Total Tickets (count of all my tickets)
  - Pending (status === 'Pending')
  - In Progress (status === 'In Progress')
  - Resolved (status === 'Resolved')
- Section: "Recent Tickets" — show last 5 tickets using `TicketCard` component
- Button: "Report New Incident" → navigates to `/resident/submit-ticket`

**API call:** `getMyTickets()` from `ticketApi.js` on mount. Compute stats from the response.

---

### Page 3: `SubmitTicket.jsx`

**Route:** `/resident/submit-ticket` (resident only)  
**Wrapped in:** `AppLayout`

**Layout:**
- Page title: "Report an Incident"
- Ant Design `Form` with `Form.Item` for:
  - **Title** — `Input`, required
  - **Description** — `Input.TextArea`, required, 4 rows
  - **Category** — `Select` dropdown with 7 options: Sanitation, Infrastructure, Security, Noise Complaint, Public Safety, Environmental Hazard, Utilities
  - **Location** — `Input`, required, placeholder "e.g., Quirino Ave. cor. Redemptorist Rd."
  - **Priority** — `Select`: Low, Medium, High, Urgent (default Medium)
  - **Evidence Photo** — `Upload` component (antd), single file, `beforeUpload` returns false (manual upload), show preview with `Upload.Dragger` or basic Upload with listType="picture"
- Submit button: Build `FormData` object, append all fields + file, call `createTicket(formData)` from `ticketApi.js`
- On success: `message.success()`, navigate to `/resident/my-tickets`
- On error: `message.error()` with server error message

**Important:** Use `FormData` (not JSON) because of the image file. The axios call needs `Content-Type: multipart/form-data`.

---

### Page 4: `MyTickets.jsx`

**Route:** `/resident/my-tickets` (resident only)  
**Wrapped in:** `AppLayout`

**Layout:**
- Page title: "My Tickets"
- Filter bar (Row with Col):
  - Category `Select` (allow clear, placeholder "All Categories")
  - Status `Select` (allow clear, placeholder "All Statuses")
  - `Input.Search` for text search
- Ant Design `Table` with columns:
  - Title
  - Category — plain text or `Tag`
  - Status — `StatusBadge` component
  - Priority — `Tag` with color from `getPriorityColor()`
  - Location
  - Date — formatted with `formatDate()` from helpers
- Row click → `navigate(/resident/ticket/${record._id})`
- Default sort: newest first

**API call:** `getMyTickets({ category, status, search })` — re-fetch when filters change (use `useEffect` with filter state dependencies, or call on filter change).

---

### Page 5: `AdminDashboard.jsx`

**Route:** `/admin/dashboard` (admin only)  
**Wrapped in:** `AppLayout`

**Layout:**
- Page title: "Dashboard"
- Stats row — 5 `Card` components with `Statistic`:
  - Total Active Tickets
  - Pending (yellow/gold icon)
  - In Progress (blue icon)
  - Resolved (green icon)
  - Dismissed (red icon)
- Filter bar:
  - Category `Select` (allow clear)
  - Status `Select` (allow clear)
  - Priority `Select` (allow clear)
  - `Input.Search` for text search
- Ant Design `Table` with columns:
  - Title
  - Submitted By — show `submittedBy.firstName + submittedBy.lastName`
  - Category
  - Status — `StatusBadge`
  - Priority — colored `Tag`
  - Location
  - Date — `formatDate()`
  - Actions — `Button` "View" → `navigate(/admin/ticket/${record._id})`
- Pagination (antd Table has built-in pagination)

**API call:** `getAllTickets({ category, status, priority, search })` — re-fetch when filters change.

---

### Page 6: `TicketDetails.jsx`

**Route:** `/resident/ticket/:id` AND `/admin/ticket/:id` (both roles, different controls)  
**Wrapped in:** `AppLayout`

**Layout:**
- Back button: "← Back to tickets"
- Ant Design `Descriptions` (bordered) showing:
  - Title, Description, Category, Status (StatusBadge), Priority, Location
  - Submitted By (name + email)
  - Date Submitted (formatDate)
  - Resolved/Dismissed At (if applicable)
  - Linked Ticket (if exists — show as a clickable link to the other ticket)
- Image section: If ticket has an image, display it with `Image` component (antd, with preview)
  - Image URL: `http://localhost:5000/uploads/{ticket.image filename}` or however the path is stored

**Admin-only controls** (show only if `user.role === 'admin'`):
- Status action buttons (based on current status):
  - **Pending:** "Start Processing" button (→ In Progress) + "Dismiss" button (→ Dismissed)
  - **In Progress:** "Mark Resolved" button (→ Resolved) + "Dismiss" button (→ Dismissed)
  - **Resolved:** "Archive Ticket" button
  - **Dismissed:** "Archive Ticket" button
- Each status change shows a `Modal.confirm()` before executing
- Status change calls `updateTicketStatus(id, newStatus)` from `ticketApi.js`
- Archive calls `archiveTicket(id)` from `archiveApi.js`

**Duplicate linking** (admin only):
- "Link to Duplicate" section with a `Select` component
  - Options: search/list other active tickets (fetch from `getAllTickets`)
  - On select: call `linkTicket(id, selectedTicketId)` from `ticketApi.js`

**API call:** `getTicketById(id)` on mount (id from `useParams`).

---

### Page 7: `UserManagement.jsx`

**Route:** `/admin/users` (admin only)  
**Wrapped in:** `AppLayout`

**Layout:**
- Page title: "User Management"
- Search bar: `Input.Search` to filter users by name or email
- Ant Design `Table` with columns:
  - Name — `firstName + lastName`
  - Email
  - Role — `Tag` (admin = blue, resident = green)
  - Phone
  - Address
  - Registered — `formatDate(createdAt)`
  - Actions — "Edit" `Button`
- Edit click → opens Ant Design `Modal` with `Form`:
  - firstName (Input)
  - lastName (Input)
  - email (Input)
  - phone (Input)
  - address (Input)
  - role (Select: admin, resident)
- Modal save → calls `updateUser(id, formData)` from `userApi.js`
- On success: `message.success()`, refresh table
- On error: `message.error()`

**API call:** `getAllUsers({ search })` on mount and when search changes.

---

### Page 8: `ArchiveView.jsx`

**Route:** `/admin/archive` (admin only)  
**Wrapped in:** `AppLayout`

**Layout:**
- Page title: "Archived Tickets"
- Filter bar:
  - Category `Select` (allow clear)
  - Search `Input.Search`
- Ant Design `Table` with columns:
  - Title
  - Submitted By — `submittedBy.firstName + submittedBy.lastName`
  - Category
  - Last Status — `StatusBadge` (shows Resolved or Dismissed)
  - Date Archived — `formatDate(updatedAt)`
  - Actions — "Restore" `Button`
- Restore click → `Modal.confirm("Are you sure you want to restore this ticket?")` → calls `restoreTicket(id)` from `archiveApi.js`
- On success: remove row from table, `message.success("Ticket restored")`

**API call:** `getArchivedTickets({ category, search })` on mount and when filters change.

---

## 🔌 API Reference (Quick Cheat Sheet)

> For the Builder Agent's reference — these are the backend endpoints the pages call.

### Auth — `/api/auth`
```
POST   /register              { firstName, lastName, email, password, phone, address }
POST   /login                 { email, password }
GET    /me                    → current user (needs auth header)
PUT    /profile               { firstName, lastName, phone, address, password? }
POST   /forgot-password       { email } → returns { resetToken, resetUrl }
POST   /reset-password/:token { password }
```

### Tickets — `/api/tickets`
```
POST   /                      FormData { title, description, category, location, priority, image? } (resident, auth)
GET    /                      ?category=&status=&priority=&search= (admin, auth)
GET    /my-tickets             ?category=&status=&search= (resident, auth)
GET    /:id                   (auth)
PUT    /:id/status            { status } (admin, auth)
PUT    /:id/link              { linkedTicketId } (admin, auth)
```

### Users — `/api/users`
```
GET    /                      ?search= (admin, auth)
GET    /:id                   (admin, auth)
PUT    /:id                   { firstName, lastName, email, phone, address, role } (admin, auth)
```

### Archive — `/api/archive`
```
GET    /                      ?category=&status=&search= (admin, auth)
PUT    /:id/archive           (admin, auth)
PUT    /:id/restore           (admin, auth)
```

---

## 📝 Change Log

> Both agents: Add entries here when you complete work. Format: `[timestamp] Agent — what was done`

```
[2026-10-11 01:44] Planner — Created project scaffolding, directory structure, server package.json, .env, .gitignore
[2026-10-11 01:46] Backend Builder (subagent) — Created ALL 16 server files (models, middleware, controllers, routes, server.js, seed.js)
[2026-10-11 01:46] Frontend Builder (subagent) — Created config files, auth pages, components, API modules, context, utils (20 files)
[2026-10-11 01:49] Frontend Builder — STOPPED (token exhaustion) — 8 app pages NOT created
[2026-10-11 01:53] Planner — Audited project, created this ledger
[2026-10-11 02:59] Codex - Installed frontend dependencies and implemented all eight app pages in the handoff order; preserved AppLayout, Ant Design, API wrappers, and theme.
[2026-10-11 02:59] Codex - Corrected category helpers and upload proxy/path handling. Added five realistic Resolved tickets: demo now has 10 users and 28 tickets, including 20 completed.
[2026-10-11 02:59] Codex - Reproduced and fixed backend permission defects: role edits now apply to existing tokens, and linked reports cannot disclose another resident's content.
[2026-10-11 02:59] Codex - Added optional persistent local MongoDB launcher, isolated acceptance database, environment example, browser/API tests, and README.
[2026-10-11 02:59] Codex - Independent code review identified a delayed mutation/navigation race; regression test reproduced it, route identity guards fixed it, and the final suite passed 19/19. Production build passed; normal localhost API/frontend and resident pages at 375 px verified.
```

---

## Verification Record

- **Production build:** `cd client; npm run build` - PASS. Vite emits a non-blocking bundle-size warning for the Ant Design application.
- **Acceptance suite:** `cd client; npm test` - **19 passed**, including the full photo submission -> processing -> resolution -> archive -> restore workflow; dismissal and restoration; user/profile editing; filters; duplicate links; registration/logout; password recovery; role/ownership controls; cross-resident privacy; delayed-response navigation; errors/empty states; and 375 px layouts.
- **Frontend-only checks:** `cd client; npm run test:frontend` - **5 passed** without MongoDB.
- **Normal demo database:** 10 users (2 admin, 8 resident); 28 tickets (13 Resolved, 7 Dismissed, 3 In Progress, 5 Pending). Tests run against a separate temporary database; seed accounts retain `Password123!`.
- **Local setup:** MongoDB is running on 27017 via `npm run db`; backend dev server on 5000; frontend on 3000. No system MongoDB service was available, so the optional launcher retains data in `server/.local-data/mongodb`.
- **Presentation cleanup:** normal database contains only intentionally prepared seed data. Test photos are removed after the acceptance suite; earlier test photos were also cleaned up.
- **Workspace:** no Git repository was present, so there are no commits, branches, or PRs. Work is saved in the supplied project directory.

## Review Decisions

- Preserve the approved page specifications and existing architecture. Existing production files were changed only to correct category/image integration and demonstrated permission defects.
- Keep clickable linked-ticket navigation as specified. A resident cannot open another resident's linked report; its content/title is hidden and its detail endpoint returns 403. Same-owner and admin links work normally.
- The initial phone measurements captured the sidebar's responsive transition. Waiting for the layout to settle confirmed all four real resident pages fit 375 px; no redesign was needed.
- Review's upload artifact observation was addressed in the acceptance test teardown: only the photos created by that test worker are removed.

## Known Issues / Warnings

1. `npm run seed` replaces users and tickets in the configured database. It was run once against an empty normal demo database; acceptance seeding always uses a fresh temporary database.
2. The optional MongoDB launcher and tests may download MongoDB on first use. The verified binary is cached on this machine.
3. Password recovery displays a reset link for the localhost demonstration; no email delivery is configured.
4. Existing dependency audit warnings remain (client: 3 moderate, 1 high; server: 3 high). Dependency modernization is outside this approved completion task; no force upgrades were applied.
5. The production bundle-size warning remains; it does not prevent building or running this localhost demo.

---

## 🎨 Theme Quick Reference

```
Primary (teal-blue):    #0A4D68
Secondary (green):      #2D6A4F
Accent (gold):          #D4A017
Background:             #F0F2F5
Cards:                  #FFFFFF
Sidebar:                Dark green/teal

Status Colors:
  Pending:    gold / #FAAD14
  In Progress: blue / #1890FF
  Resolved:   green / #52C41A
  Dismissed:  red / #FF4D4F

Priority Colors:
  Low:    green
  Medium: blue
  High:   orange
  Urgent: red

Incident Categories (7):
  Sanitation, Infrastructure, Security, Noise Complaint,
  Public Safety, Environmental Hazard, Utilities

Ticket Status Flow:
  Pending → In Progress → Resolved → [Archive]
  Pending → Dismissed → [Archive]
  In Progress → Dismissed → [Archive]
  [Archived] → Restore back to last active status
```
