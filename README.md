# BMIS — Barangay Baclaran

A localhost MERN application for reporting and tracking non-emergency incidents in Barangay Baclaran, Parañaque City. Residents submit reports and view their own tickets. Administrators manage users, process tickets, link duplicates, and archive or restore completed reports.

## Requirements

- Node.js 20.19 or newer and npm. Development was verified with Node.js 24.
- MongoDB, either an existing local installation or the optional launcher included here.
- Google Chrome for the browser tests. Alternatively install Playwright Chromium and set `PLAYWRIGHT_CHANNEL=chromium`.

## Setup

Install both applications from the project directory:

```powershell
cd C:\PROJECTS\BMIS\server
npm install
cd ..\client
npm install
```

The backend reads `server/.env`. An environment file is already present in this workspace. For a fresh checkout, copy `server/.env.example` to `server/.env` and replace `JWT_SECRET` with your own secret. The default database is `mongodb://127.0.0.1:27017/bmis`; the API uses port 5000.

Start your MongoDB service. If MongoDB is not installed, open a terminal and run:

```powershell
cd C:\PROJECTS\BMIS\server
npm run db
```

This starts a real MongoDB 8.2.6 process bound to localhost on port 27017. It downloads the binary on first use if it is not cached. Data persists in `server/.local-data/mongodb`; keep the terminal running. Use either this launcher or your existing MongoDB service on that port.

Seed the demonstration database once:

```powershell
cd C:\PROJECTS\BMIS\server
npm run seed
```

**Seeding replaces all users and tickets in the configured database.** The prepared dataset contains 10 accounts (2 admins and 8 residents) and 28 realistic tickets: 13 Resolved, 7 Dismissed, 3 In Progress, and 5 Pending. All 20 completed tickets initially remain in the active queue so you can demonstrate archiving them.

Start the backend and frontend in separate terminals:

```powershell
# Backend
cd C:\PROJECTS\BMIS\server
npm run dev
```

```powershell
# Frontend
cd C:\PROJECTS\BMIS\client
npm run dev
```

Open [BMIS at localhost:3000](http://localhost:3000). The frontend proxies API calls and evidence photos to the backend.

## Demo accounts

All seeded accounts use **`Password123!`**.

| Role | Email |
| --- | --- |
| Admin | `maria.santos@email.com` |
| Admin | `juan.delacruz@email.com` |
| Resident | `ana.reyes@email.com` |
| Resident | `pedro.garcia@email.com` |
| Resident | `rosa.martinez@email.com` |
| Resident | `carlos.bautista@email.com` |
| Resident | `elena.villanueva@email.com` |
| Resident | `roberto.aquino@email.com` |
| Resident | `lorna.fernandez@email.com` |
| Resident | `miguel.torres@email.com` |

## Demonstration workflow

1. Sign in as Ana, select **Submit Ticket**, and report an issue. Evidence is optional: one JPEG, PNG, or WebP image up to 5 MB.
2. Open **My Tickets** to filter reports and view details. Residents can access only their own reports.
3. Sign in as Maria and select **View** on the report. Choose **Start Processing**, confirm, then **Mark Resolved** and confirm.
4. Choose **Archive Ticket** and confirm. The ticket leaves the active dashboard and appears under **Archive**.
5. Restore it from **Archive**. Its Resolved status and completion timestamp remain intact.
6. Use **Link to Duplicate** on an active report to link another active ticket. Use **Users** to edit contact details or roles. Changed roles apply to existing sessions on the next API request.
7. Open **Profile** to edit your details. Leave the new password blank to retain the current password.
8. To demonstrate password recovery, log out and choose **Forgot Password**. The localhost demo displays the reset link on screen; copy it into the browser and set a new password. No email delivery service is used.

## Verification

From `client/`:

```powershell
npm run build
npm test
```

The Playwright suite starts its own API on port 5001 and frontend on port 3001, using a fresh temporary MongoDB. It does not seed or modify the normal `bmis` database. The tests cover demo requirements, ticket lifecycle and photos, filters and dashboard totals, profile/user editing, duplicates, registration/logout, password recovery, role enforcement, and privacy across resident accounts. First use may download the MongoDB test binary. Test screenshots and traces appear in `client/test-results/` on failure.

For the frontend contract checks alone, without MongoDB:

```powershell
npm run test:frontend
```

For machines using Playwright's bundled browser:

```powershell
npx playwright install chromium
$env:PLAYWRIGHT_CHANNEL = 'chromium'
npm test
```

## Project references

- `PROJECT_STATUS.md` — implementation specification, checklist and current verification record.
- `CTSYSINL-PROJECT-OVERVIEW.pdf` — academic requirements.
- `BMIS_Context.md` — purpose, users and scope.
- `agentprompt.md` — original build handoff.
- `docs/implementation-plan.md` — completion work and recorded integration decisions.

The application uses React 18, Vite, Ant Design, Express, Mongoose, JWT authentication and local disk uploads. It is intended for the localhost demonstration described in the project references.
