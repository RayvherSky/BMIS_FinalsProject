# BMIS frontend completion

**Historical record:** This plan describes the original frontend completion, not the current assignment. For the current stopping point and confirmed behavior, read [the session handoff](../Context/SESSION_HANDOFF.md). The original build prompts were removed during documentation consolidation.

**Original goal:** Complete the approved Barangay Baclaran incident reporting workflow recorded in the [project ledger](../Context/PROJECT_STATUS.md).

**Approach:** Preserve React, Ant Design, AppLayout, the existing API wrappers, routes, and government theme. API wrappers return the response body directly (arrays for lists, objects for details). Implement in the handoff's page order. Work in the supplied directory; this project has no Git repository.

## Implementation checklist

- [x] Read the four handoff documents and inspect the existing backend and frontend.
- [x] Install client dependencies; reproduce the build failure from missing page imports.
- [x] Add browser/API acceptance tests before page implementation.
- [x] Profile: read/edit name, phone, address, optional password; use AuthContext's result and notifications.
- [x] ResidentDashboard: four statistics, five latest tickets, report button.
- [x] SubmitTicket: required fields, approved seven categories, Medium default, optional JPEG/PNG/WebP photo up to 5 MB, FormData submission.
- [x] MyTickets: category/status/search filters, latest-first table and detail navigation.
- [x] AdminDashboard: five statistics independent of list filters, category/status/priority/search, paginated table.
- [x] TicketDetails: both roles, evidence image using stored upload path, timestamps, links, confirmed admin status/archive actions and duplicate selection excluding self.
- [x] UserManagement: searchable user table, edit modal and roles.
- [x] ArchiveView: category/search, retained terminal status, confirmed restore and row removal.
- [x] Resolve proven integration defects only: incorrect helper categories, upload URL assumptions, inadequate completed seed count, and any failures demonstrated by tests.
- [x] Verify API authorization, full lifecycle, uploads, duplicate linking, user/profile updates, recovery and registration in a disposable MongoDB; verify production build.
- [x] Seed a clean local demo database only after checking existing data; provide a local MongoDB launcher if no installation exists.
- [x] Create README and update the project ledger with actual results.

## Acceptance checks

Use Playwright with isolated API/frontend ports and a disposable database. Exercise the complete resident/admin workflow through the browser and assert database-visible behavior through the API. Check required form validation, loading/errors, independent dashboard totals, invalid photo selection, empty results, forbidden role routes, access to other residents' tickets, cancelled confirmations, optional password omission, terminal status archive eligibility, and restoration retaining status. Assert 10 seeded users (2 admins, 8 residents) and at least 20 completed tickets. Preserve demo data by keeping acceptance tests separate from the normal database.

## Recorded decisions

- The user approved continuing the existing written architecture and handoff; no redesign or hosting is required.
- Use backend categories as the source of truth. The original helper constants conflict with the approved spec and model.
- Backend image values include `/uploads/`; serve uploads through Vite's proxy to avoid duplicating that path.
- No MongoDB service, executable, or listener was found. Supply an optional development launcher using a downloaded real MongoDB binary with persistent project-local storage; tests use separate temporary storage.
- Existing seed has 23 total tickets but only 15 terminal tickets. Add five realistic resolved tickets, retaining the pending/in-progress examples.

## Final validation

- Production build passed.
- Full acceptance suite: 19/19 passed. Frontend contract checks: 5/5 passed.
- The normal demo was checked before seeding (0 users, 0 tickets), seeded once, and verified afterward (10 users, 28 tickets, 20 completed).
- Independent review: no Critical findings; its Important delayed mutation/navigation race was reproduced by a failing test and fixed with route identity checks for duplicate, status, and archive mutations.
- Demonstrated permission bugs were fixed with failing-then-passing regressions: stale JWT roles and cross-resident linked report disclosure.
- Upload test artifacts are removed by test teardown. Real resident routes were also checked at 375 px, after the sidebar's responsive transition settled.
- Linked cross-resident references retain the required navigation and return an access-denied result; protected report content is not exposed.
