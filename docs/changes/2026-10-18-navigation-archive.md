# Dashboard, navigation, and archive changes — 18 October 2026

The six supplied notes are implemented. This work preserves the earlier audit repairs and role/priority changes. Browser acceptance remains pending because this session cannot start the required child processes.

| Your note | Implemented behavior |
|---|---|
| Add dashboard animations | Both dashboards have an entrance animation, staggered statistic cards, and a subtle card hover movement. |
| Make Report New Incident and View all tickets more noticeable | Both actions now appear together in the resident welcome panel. Report New Incident is a large gold button; View all tickets is a large outlined button. Buttons stack at narrow widths. |
| Remove the redundant bottom-left arrow | Removed Ant Design's bottom sidebar trigger. The header's accessible Collapse/Expand sidebar button remains. |
| Slide into the dashboard | Following your clarification, content enters from the **right edge and moves left** into place. The animation is clipped within the dashboard viewport to avoid horizontal page scrolling. |
| Smooth sidebar selection movement | A shared indicator moves between selected menu entries. The application shell stays mounted during authenticated navigation, preserving collapse state. Archive-origin detail navigation keeps Archive selected. |
| Auto-archive resolved tickets and categorize Archive | Newly resolving a ticket immediately archives it. Dismissed tickets still need manual archiving. Archive has **All / Resolved / Dismissed** tabs with counts, alongside category and search filters. |

Dashboard, statistic-card, sidebar-indicator, and sidebar-width motion respect the operating system/browser **reduced-motion** setting. The initial splash remains a separate existing feature.

The status update saves `Resolved`, `resolvedAt`, `isArchived`, and the new optional `archivedAt` together. Repeating an already resolved/archived update preserves its dates. Manual archiving also records `archivedAt`; Archive displays that date, with `updatedAt` as the fallback for older records. Restore preserves the last status and completion timestamp while clearing the archived flag/date. A restored Resolved report stays active until another explicit resolve/archive action.

**Existing records were not moved or migrated.** Older active Resolved reports stay active. They can still be manually archived. Newly resolved reports disappear from active admin/resident lists and active dashboard totals; authorized detail access is retained.

## Verification performed

- **41 passed, 0 failed/skipped:** the 34 prior focused checks plus seven new archive lifecycle HTTP checks. The new cases exercise actual Express routes, authentication/role middleware, and controllers on an ephemeral loopback server, with database execution/writes and JWT verification supplied by isolated fixtures. They do not establish live MongoDB/JWT integration.
- Before implementation, the new archive checks reproduced six failures and one existing passing guard case. After implementation, all seven pass: immediate archive/list exclusion, repeat-date preservation, manual dismissal archive, restore, combined filters, older-record preservation, and resident/invalid-request denial.
- **56 browser cases discovered in five files**, including eight new navigation/archive cases. Existing lifecycle tests now expect automatic resolution archiving while retaining reload/restore/timestamp checks.
- New browser coverage includes persistent collapsed navigation, indicator position, narrow action buttons, entrance direction/overflow, reduced motion, status/category filtering, Back during delayed/failed detail loading, and restoring the last row on a filtered page.
- Relevant JavaScript/JSX and App.css parse; Git whitespace checks pass. Independent review found two issues, which were corrected: Archive-origin Back before detail loading and a query-sensitive test fixture. The reviewer found no remaining important defects.
- **Browser execution is blocked:** scoped Playwright and `npm test` exit 1 with `spawn EPERM` before running tests. **Production build is blocked:** Vite cannot start esbuild while loading its configuration (`spawn EPERM`, exit 1). No browser pass, visual measurement, or successful post-change build is claimed.

## How to test manually

Run the current backend and frontend, then use the local app at `http://localhost:3000`. Use disposable reports for lifecycle checks.

1. **Dashboard entrance:** sign in as a resident, open My Tickets, and return to Dashboard. Content should enter from the right and move left; statistic cards should appear in sequence. Repeat as an admin. Check desktop and 375px widths for horizontal scrolling.
2. **Resident actions:** confirm Report New Incident and View all tickets are prominent in the welcome panel. Each should open the expected page. At 375px, both should fit and be easy to tap.
3. **Sidebar:** confirm the bottom arrow is gone. Collapse with the header button, visit another page, and confirm it stays collapsed. Expand it and navigate between menu entries; the selection background should move smoothly. Browser Back should select the matching entry.
4. **Reduced motion:** enable reduced motion in the operating system or browser emulation, then repeat dashboard/sidebar navigation. These new animations should be disabled, with controls and content still usable.
5. **Automatic archive:** create a resident report. As admin, start processing, choose Mark Resolved, then Confirm. Confirm the message says it moved to Archive, the detail shows an archived report, and no manual archive step is required. Open Archive and reload: the report should be under All and Resolved. It should be absent from active lists.
6. **Dismissal remains manual:** create and dismiss another report. Confirm it remains in the active queue until Archive Ticket is explicitly confirmed. It should then appear in All and Dismissed, and not in Resolved.
7. **Combined categorization:** use reports in two categories. Switch All / Resolved / Dismissed, select a category, and search by a distinctive title. Counts and rows should reflect both the chosen category/search and status. Clear the filters to see all archived reports again.
8. **Detail navigation:** open a title from Archive. Archive should stay highlighted, and Back to tickets should return there. Repeat with a throttled or failed detail request; Back should still return to Archive.
9. **Restore:** restore one Resolved and one Dismissed report. Confirm each disappears from Archive and returns to the active queue with its previous status and completion date. With more than ten reports in a status tab, restoring its only second-page row should return to a populated first page.
10. **Older records:** confirm previously active Resolved reports were not moved simply by restarting the app or resolving a different report. They should still offer manual Archive Ticket.

## Automated commands

From the repository root:

```powershell
node --test --test-isolation=none server/tests/audit-repairs.test.js server/tests/notes-changes.test.js
```

Where child processes are permitted:

```powershell
cd C:\PROJECTS\BMIS\client
Remove-Item Env:BMIS_FRONTEND_ONLY -ErrorAction SilentlyContinue
npx playwright test tests/navigation-archive.spec.js
npm test
npm run build
```

Playwright uses a temporary database and ports 5001/3001. The normal database and uploads were untouched; no seeds, resets, migrations, dependency installs, or commits were made.

Production changes are in `client/src/App.jsx`, `components/Layout/AppLayout.jsx`, `App.css`, the authenticated page wrappers, `ResidentDashboard.jsx`, `ArchiveView.jsx`, `TicketDetails.jsx`, and `server/controllers/ticketController.js`, `archiveController.js`, and `models/Ticket.js`. Test changes are in `server/tests/notes-changes.test.js`, new `client/tests/navigation-archive.spec.js`, and the affected lifecycle cases in `bmis.spec.js` and `updated-features.spec.js`. Compact evidence: [navigation-archive-verification.json](2026-10-18-navigation-archive-verification.json).
