# Ticket search, dashboard filters, and linking — 18 October 2026

Implemented the three requested changes while preserving previous repairs and the normal database.

- **Live search:** Admin Ticket Directory, My Tickets, and Archive filter as you type; Enter is optional. Results include every matching row, with a count and existing pagination. Search covers title, submitter name/email, category/custom label, status, priority, location, description, and dates. Multiple words must all match somewhere in those fields.
- **Fuzzy toggle:** Off by default. Enable it to tolerate small spelling mistakes in words of four or more letters, including transposed letters. Dates and other numeric terms stay literal. Search never indexes internal notes or linked-report contents.
- **Clickable tiles:** All existing resident tiles open the corresponding owned active-ticket list, which remains searchable. Admin has Total Active Tickets, Archived Tickets, Pending, In Progress, Resolved, and Dismissed tiles. As explicitly confirmed, admin status counts/results include active **and archived** reports. Selecting a tile clears unrelated filters/search and displays its matching directory rows. A Ticket scope selector allows Active, Archived, or both. Charts retain their existing active-queue scope, explained on screen.
- **Resolved linking:** Resolved and archived reports are excluded from new-link candidates. A resolved master no longer offers the linking form. The API rejects a new link when either side is resolved or archived, covering stale pages and direct requests. Existing saved relationships remain visible and may still be unlinked.

Enhanced matching runs against the already authorized lists returned by the existing APIs. Category/status/priority selection retains server filters; ordinary API `search` behavior remains unchanged. The browser already receives these lists without server pagination, so no extra data access or new dependency was introduced. Resident lists still contain only their own active reports; this change does not add resident archive/history access.

Date input supports `YYYY-MM-DD` and displayed English dates such as `Oct 18 2026`. Search includes submission/completion/archive dates; older archived records use the same `updatedAt` fallback as the displayed Archive date. Dates follow the browser's local calendar, matching existing display behavior.

## Verification

- **46 focused checks passed, 0 failed/skipped:** the prior 41 plus four real shared-matcher checks and one actual HTTP link-guard case exercising both sides and resolved/archive states. The HTTP test reproduced acceptance of a resolved child before the fix, then passed after the guard was added.
- Matcher checks cover every requested field, multiple results, words across columns, custom categories, dates including legacy archive dates, typo-mode toggle behavior, literal regex characters, missing data, and exclusion of notes/linked-report text.
- HTTP cases execute Express routes/auth/role middleware/controllers with isolated database/JWT fixtures, not live MongoDB/JWT integration. Matcher checks execute the module imported by the UI.
- **62 browser cases discovered in six files.** Six new cases cover live search on all three lists, fuzzy toggling, admin status/archive tiles, resident filtered navigation, and resolved-link exclusions. The empty analytics fixture now includes the Archive source and expects six tiles; existing coverage remains.
- Relevant JS/JSX and CSS parse; Git whitespace checks pass. Review identified and prompted corrections for legacy archive-date matching and one fixture's expected counts.
- `npm test` remains **blocked before browser execution**, exit 1, `spawn EPERM`. `npm run build` remains **blocked while loading Vite config/starting esbuild**, exit 1, `spawn EPERM`. Browser rendering/interactions and a successful production build are not established.

## Manual checks

1. Open the admin dashboard with two reports sharing a title word or submitter. Type that value in Search tickets without pressing Enter. Both rows and the matching count should update immediately. Clear the input to restore the list.
2. Repeat with a category, status, priority, location, submitter email, and submission date such as `2026-10-18`. Combine search with the existing dropdown filters. Check My Tickets and Archive as well.
3. Type a misspelling such as `draingae` for Drainage. With Fuzzy search off it should not match; turn it on and confirm the intended rows appear. Turn it off to restore literal behavior. A wrong numeric date should remain unmatched.
4. Click each admin tile. Pending/In Progress/Resolved/Dismissed should show all matching active and archived records. Archived Tickets should show only archived records; Total Active Tickets should reset to the active list. Counts/charts should stay independent of directory search.
5. Search inside each tile's results. Then click another tile: old search/category/priority constraints should clear so the tile shows its complete group. Test tiles with keyboard Tab and Enter/Space too.
6. As a resident, click Pending or another existing dashboard tile. Confirm My Tickets opens with that status selected and its search still works. Other residents' reports must remain inaccessible.
7. On an unresolved admin report, open Link to Duplicate. Same-category unresolved reports should be available; legacy active Resolved reports and archived reports should be absent. Open a resolved master and confirm no new-link form appears. A direct link request involving a resolved/archived report should return 400 without writing a link.
8. At 375px, confirm the search input, fuzzy switch, scope/category/status controls, and tiles remain usable. When searching from a later table page, results should return to page 1.

## Commands

```powershell
# From C:\PROJECTS\BMIS
node --test --test-isolation=none server/tests/audit-repairs.test.js server/tests/notes-changes.test.js server/tests/ticket-search.test.js
Set-Location client
Remove-Item Env:BMIS_FRONTEND_ONLY -ErrorAction SilentlyContinue
npx playwright test tests/ticket-search.spec.js
npm test
npm run build
```

Playwright uses temporary data on ports 5001/3001. Normal data/uploads were not seeded, reset, or migrated; no dependencies were installed and no commit was made. Production changes are in the three ticket-list pages, both dashboards, TicketDetails, App.css, new TicketSearch component/shared matcher, and the link controller guard. Compact evidence is saved beside this report.
