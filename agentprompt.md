You are picking up an in-progress MERN stack project. The project is a **Barangay Incident & Hazard Reporting System (BMIS)** — a non-emergency ticketing helpdesk for Barangay Baclaran, Parañaque City. Residents report public issues (garbage, broken streetlights, noise, etc.) and barangay admins track, process, and resolve them.

## Current State

The project lives at `C:\PROJECTS\BMIS`. A previous agent already built:

- **The entire backend** (100% complete) — Express.js server with MongoDB models, auth (JWT + bcrypt), ticket CRUD, user management, archive/restore, image upload (multer), and a seed script with 10 users + 20+ realistic tickets.
- **Frontend scaffolding** (~60% complete) — Vite + React project with Ant Design, all config files, auth context, API modules (axios), reusable components (AppLayout sidebar/header, StatusBadge, TicketCard, ProtectedRoute), utility helpers, and all 4 auth pages (Login, Register, ForgotPassword, ResetPassword).

**What is NOT done yet:** 8 core frontend pages that make the app actually functional.

## Your Primary Reference

Read `C:\PROJECTS\BMIS\PROJECT_STATUS.md` first. This is the project ledger created by the system architect. It contains:
- A master checklist of every file and its completion status
- **Detailed implementation specs for each of the 8 missing pages** (layout, Ant Design components to use, API calls, behavior, edge cases)
- A full API endpoint cheat sheet (all backend routes, params, auth requirements)
- Theme/color reference
- Known issues and warnings

**Do not deviate from the specs in PROJECT_STATUS.md unless something is technically broken.** The architecture decisions have already been made and approved.

## Your Tasks (In Order)

### Step 1: Install frontend dependencies
```bash
cd C:\PROJECTS\BMIS\client
npm install
```

### Step 2: Verify the existing code compiles
```bash
cd C:\PROJECTS\BMIS\client
npm run dev
```
Fix any import errors or issues in the existing files before adding new ones. If the dev server starts without crashing (even if pages are missing), move on.

### Step 3: Create the 8 missing pages

Build these files in this order. Full specs for each are in `PROJECT_STATUS.md` under the "Specs for Missing Pages" section:

1. **`client/src/pages/Profile.jsx`** — View/edit own profile (simplest page, good warm-up)
2. **`client/src/pages/ResidentDashboard.jsx`** — Welcome panel + ticket summary stats + recent tickets list
3. **`client/src/pages/SubmitTicket.jsx`** — Incident report form with image upload (uses FormData + antd Upload)
4. **`client/src/pages/MyTickets.jsx`** — Resident's ticket list table with category/status filters and search
5. **`client/src/pages/AdminDashboard.jsx`** — Overview stats + full tickets table with filters + pagination
6. **`client/src/pages/TicketDetails.jsx`** — Full ticket view. Admin sees status change buttons + archive + duplicate linking. Resident sees read-only view.
7. **`client/src/pages/UserManagement.jsx`** — Admin user list table + edit modal for user info/roles
8. **`client/src/pages/ArchiveView.jsx`** — Archived tickets table + restore with confirmation

### Step 4: Verify the app works end-to-end

Start MongoDB, then:
```bash
# Terminal 1 — Backend
cd C:\PROJECTS\BMIS\server
npm run dev

# Terminal 2 — Frontend  
cd C:\PROJECTS\BMIS\client
npm run dev

# Terminal 3 — Seed demo data (run once)
cd C:\PROJECTS\BMIS\server
npm run seed
```

Then test:
- Login as admin (`maria.santos@email.com` / `Password123!`)
- Login as resident (`ana.reyes@email.com` / `Password123!`)
- Submit a ticket as resident (with image upload)
- View the ticket on admin dashboard
- Change status: Pending → In Progress → Resolved
- Archive the resolved ticket
- Check archive view, restore the ticket
- Test user management (edit a user's info)
- Test profile page (edit own profile)
- Test forgot/reset password flow

### Step 5: Update the project ledger

After completing work, update `C:\PROJECTS\BMIS\PROJECT_STATUS.md`:
- Check off completed items in the Master Task Checklist
- Add entries to the Change Log at the bottom with timestamps

## Key Technical Details

**Imports you'll need in every page:**
```jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';  // useParams only for TicketDetails
import { message } from 'antd';  // for success/error toasts
import AppLayout from '../components/Layout/AppLayout';
import { useAuth } from '../context/AuthContext';
// + specific antd components (Card, Table, Form, Input, Select, Button, Statistic, Descriptions, Modal, Tag, Spin, Upload, Image)
// + API functions from ../api/ticketApi, ../api/userApi, ../api/archiveApi as needed
// + StatusBadge from ../components/StatusBadge/StatusBadge
// + helpers from ../utils/helpers
```

**Page structure pattern:**
```jsx
const PageName = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiCall();
      setData(res.data);
    } catch (err) {
      message.error(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      {/* page content */}
    </AppLayout>
  );
};
export default PageName;
```

**Image upload in SubmitTicket — use FormData:**
```jsx
const formData = new FormData();
formData.append('title', values.title);
formData.append('description', values.description);
formData.append('category', values.category);
formData.append('location', values.location);
formData.append('priority', values.priority);
if (fileList.length > 0) {
  formData.append('image', fileList[0].originFileObj);
}
await createTicket(formData);
```

**Image display in TicketDetails:**
```jsx
// The image field stores just the filename. Serve from:
{ticket.image && <Image src={`http://localhost:5000/uploads/${ticket.image}`} />}
```

**Status action button logic in TicketDetails (admin only):**
```
If status === 'Pending':     Show "Start Processing" (→ In Progress) and "Dismiss" (→ Dismissed)
If status === 'In Progress': Show "Mark Resolved" (→ Resolved) and "Dismiss" (→ Dismissed)
If status === 'Resolved':    Show "Archive Ticket"
If status === 'Dismissed':   Show "Archive Ticket"
```

## Rules

1. **Use Ant Design (antd) components everywhere** — Table, Card, Form, Input, Select, Button, Modal, Tag, Statistic, Descriptions, Spin, Upload, Image, etc.
2. **Wrap every page in `<AppLayout>`** — this provides the sidebar and header.
3. **All API calls in try/catch** — show `message.error()` on failure, `message.success()` on success.
4. **Use `loading` state** — show `<Spin>` while data is loading.
5. **Don't modify existing files unless they're broken.** The backend, auth pages, components, context, and API modules are already done and working.
6. **Follow the government theme** — colors are already configured in App.jsx's ConfigProvider. Just use antd's default primary styling and it will pick up the theme.