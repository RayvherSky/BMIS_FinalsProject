# Automated acceptance verification — 19 October 2026

The recorded browser and production-build gates now pass after the session's process restrictions were removed. The audit was not repeated. Application code, dependencies, and build configuration were not changed during this verification.

| Gate | Result |
|---|---|
| Existing focused JS/HTTP checks, earlier in this session | **46 passed, 0 failed/skipped** across the recorded audit/notes command (42) and the shared search-matcher command (4) |
| Initial complete browser run | 51 passed, 11 failed; failures identified test mocks/selectors that stopped the intended assertions from running |
| Affected browser files after test-only corrections | **21 passed, 0 failed/skipped/flaky**, exit 0; 93.2 seconds |
| Final complete browser run | **62 passed in six files, 0 failed/skipped/flaky**, exit 0; 274.2 seconds |
| Production build | **Passed**, exit 0; Vite 5.4.21, 3,081 modules, 21.56 seconds |

The initial browser failures were corrected only in the tests:

- `frontend-contract.spec.js`: match the `/api/users` pathname so the mock also handles `?search=`. The original exact URL glob missed that request, which reached the real test API with a fixture token, returned 401, and redirected to login before contact editing could run.
- `navigation-archive.spec.js`: locate the labeled buttons while allowing the icon-name prefix exposed by Ant Design. The snapshots showed `plus Report New Incident`, `file-text View all tickets`, and `arrow-left Back to tickets`; exact text-only accessible names did not match them.
- `ticket-search.spec.js`: use the rendered `searchbox` role instead of `textbox` for the search inputs.

All 62 cases remain. No assertions, cases, role guards, timeouts, or application behavior were removed or relaxed. The navigation checks still assert viewport bounds, minimum action height, animation geometry, Archive selection, and exact destinations. Search checks still assert matching rows, counts, fuzzy behavior, tile scope, and owned navigation. The legacy-contact check still verifies that the unchanged phone is omitted from the real form's update payload.

The final suite covers the existing browser scenarios, including live Express/JWT/temporary-MongoDB flows and frontend contract cases with mocked API responses. The 46 focused checks use isolated database/JWT fixtures for HTTP cases and the actual shared UI matcher for search cases. Normal database integration and manual visual judgment beyond these automated assertions were not exercised.

The build emitted the existing nonblocking warning about a JavaScript chunk over 500 kB: the main bundle was 1,302.67 kB minified, 414.29 kB gzipped. No build changes were made to suppress the warning.

## Reproduction and artifacts

From `C:\PROJECTS\BMIS\client`, with `BMIS_FRONTEND_ONLY` unset:

```powershell
# Affected files, preserving initial failure artifacts in the parent directory.
$env:PLAYWRIGHT_JSON_OUTPUT_NAME = 'test-results/recheck-focused.json'
npm test -- tests/frontend-contract.spec.js tests/navigation-archive.spec.js tests/ticket-search.spec.js --output=test-results/recheck-focused --reporter=list,json

# Complete suite: no file, grep, or frontend-only restriction.
$env:PLAYWRIGHT_JSON_OUTPUT_NAME = 'test-results/recheck-full.json'
npm test -- --output=test-results/recheck-full --reporter=list,json

# Production build, run successfully before the test-only corrections.
npm run build
```

Local generated evidence remains in `client/test-results/recheck-focused.json` and `client/test-results/recheck-full.json`. Initial failing screenshots, error contexts, and traces remain in the original `client/test-results` case directories; reruns used separate subdirectories.

The harness used fresh temporary data on ports 5001/3001. Both ports were no longer listening after completion, and no acceptance-test pavement photos remained in `server/uploads`. Normal data and existing uploads were preserved. No dependency installs, normal-data seeds/resets/migrations, or commits were performed. Pre-existing edits and untracked files were preserved.
