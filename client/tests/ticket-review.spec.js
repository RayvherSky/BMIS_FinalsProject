import { test, expect } from '@playwright/test';
import { testPhone } from './helpers/phone';

const employee = { _id: '000000000000000000000002', firstName: 'Luis', lastName: 'Cruz', role: 'employee', email: 'luis@example.test' };
const manager = { _id: '000000000000000000000003', firstName: 'Maria', lastName: 'Santos', role: 'admin', email: 'maria@example.test' };
const owner = { _id: '000000000000000000000001', firstName: 'Ana', lastName: 'Reyes', role: 'user', email: 'ana@example.test' };
const ticketId = '000000000000000000000010';
const createdAt = '2026-10-19T02:00:00.000Z';
const report = (fields = {}) => ({ _id: ticketId, title: 'Drainage inspection', description: 'Inspect the market entrance.', category: 'Infrastructure', status: 'In Progress', priority: 'Medium', location: 'Baclaran', submittedBy: owner, assignedTo: employee, notes: [], requests: [], isArchived: false, createdAt, ...fields });
const pendingReview = { status: 'pending', requestedBy: employee, requestedAt: createdAt };

async function session(page, account = employee) {
  await page.addInitScript(() => localStorage.setItem('token', 'ticket-review-contract'));
  await page.route('**/api/auth/me', route => route.fulfill({ json: account }));
  await page.route(url => url.pathname === '/api/tickets', route => route.fulfill({ json: [] }));
  await page.route('**/api/tickets/reviews*', route => route.fulfill({ json: { items: [], total: 0, counts: { pending: 0, reviewed: 0 } } }));
}

test('REVIEW Employee submits the assigned report once and sees its pending review state', async ({ page }) => {
  await session(page);
  await page.route(`**/api/tickets/${ticketId}`, route => route.fulfill({ json: report() }));
  let submissions = 0;
  await page.route(`**/api/tickets/${ticketId}/review`, route => {
    expect(route.request().method()).toBe('POST'); submissions++;
    return route.fulfill({ status: 201, json: report({ review: pendingReview }) });
  });
  await page.goto(`/employee/ticket/${ticketId}`);
  const panel = page.getByRole('region', { name: 'Employee review', exact: true });
  const submit = panel.getByRole('button', { name: 'Submit for Review', exact: true });
  await submit.focus(); await submit.press('Enter');
  await expect(panel.getByText('Pending Admin review', { exact: true })).toBeVisible();
  await expect(submit).toBeDisabled();
  await expect(panel.getByText('Luis Cruz', { exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Mark Reviewed', exact: true })).toHaveCount(0);
  expect(submissions).toBe(1);
});

test('REVIEW Admin queue stays distinct from Action Center and returns to the pending queue after review', async ({ page }) => {
  await session(page, manager);
  let current = report({ review: pendingReview });
  let requestInboxReads = 0;
  await page.route('**/api/tickets/requests*', route => { requestInboxReads++; return route.fulfill({ json: { items: [], total: 0, counts: { unread: 0, outstanding: 0 } } }); });
  await page.route('**/api/tickets/reviews*', route => {
    expect(new URL(route.request().url()).searchParams.get('status')).toBe('pending');
    return route.fulfill({ json: { items: current.review.status === 'pending' ? [current] : [], total: current.review.status === 'pending' ? 1 : 0, counts: { pending: current.review.status === 'pending' ? 1 : 0, reviewed: current.review.status === 'reviewed' ? 1 : 0 } } });
  });
  await page.route(`**/api/tickets/${ticketId}`, route => route.fulfill({ json: current }));
  await page.route(`**/api/tickets/${ticketId}/review`, route => {
    expect(route.request().method()).toBe('PATCH');
    expect(route.request().postDataJSON()).toEqual({ action: 'reviewed' });
    current = report({ review: { ...pendingReview, status: 'reviewed', reviewedBy: manager, reviewedAt: createdAt } });
    return route.fulfill({ json: current });
  });
  await page.goto('/admin/for-review');
  await expect(page.getByRole('heading', { name: 'For Review', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /For Review/ })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Action Center/ })).toBeVisible();
  await page.getByRole('button', { name: 'Review ticket', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Employee review', exact: true });
  await panel.getByRole('button', { name: 'Mark Reviewed', exact: true }).click();
  await expect(panel.getByText('Reviewed', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark Resolved', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Back to tickets', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/for-review$/);
  await expect(page.getByText('No tickets awaiting review.', { exact: true })).toBeVisible();
  expect(requestInboxReads).toBe(0);
});

test('REVIEW assigned Admin public update and resolution wait for an Employee review while triage remains available', async ({ page }) => {
  await session(page, manager);
  await page.route(`**/api/tickets/${ticketId}`, route => route.fulfill({ json: report() }));
  await page.goto(`/admin/ticket/${ticketId}`);
  await page.getByPlaceholder('Add a new update or note to this ticket...').fill('Inspection completed.');
  const post = page.getByRole('button', { name: 'Post Update', exact: true });
  await expect(post).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Mark Resolved', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Dismiss', exact: true })).toBeEnabled();
  await page.getByRole('checkbox', { name: /Private Internal Note/ }).check();
  await expect(post).toBeEnabled();
  await page.route(`**/api/tickets/${ticketId}`, route => route.fulfill({ json: report({ review: pendingReview }) }));
  await page.getByRole('button', { name: 'Refresh details', exact: true }).click();
  await page.getByRole('checkbox', { name: /Private Internal Note/ }).uncheck();
  await expect(post).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Mark Resolved', exact: true })).toBeEnabled();
});

test('REVIEW a failed submission remains retryable and revoked Employee access clears the panel', async ({ page }) => {
  await session(page);
  await page.route(`**/api/tickets/${ticketId}`, route => route.fulfill({ json: report() }));
  let submissions = 0;
  await page.route(`**/api/tickets/${ticketId}/review`, route => ++submissions === 1
    ? route.fulfill({ status: 500, json: { message: 'Review service unavailable' } })
    : route.fulfill({ status: 403, json: { message: 'This ticket is no longer assigned to you.' } }));
  await page.goto(`/employee/ticket/${ticketId}`);
  const panel = page.getByRole('region', { name: 'Employee review', exact: true });
  await panel.getByRole('button', { name: 'Submit for Review', exact: true }).click();
  await expect(panel.getByText('Review service unavailable', { exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Submit for Review', exact: true })).toBeEnabled();
  await panel.getByRole('button', { name: 'Submit for Review', exact: true }).click();
  await expect(page.getByText('This ticket is no longer assigned to you.', { exact: true })).toBeVisible();
  await expect(panel).toHaveCount(0);
  await expect(page.getByText('Drainage inspection', { exact: true })).toHaveCount(0);
});

test('REVIEW the pending queue clears stale cards after a failed refresh and fits a narrow screen', async ({ page }) => {
  await session(page, manager);
  await page.setViewportSize({ width: 320, height: 850 });
  await page.route('**/api/tickets/reviews*', route => route.fulfill({ json: { items: [report({ review: pendingReview })], total: 1, counts: { pending: 1, reviewed: 0 } } }));
  await page.goto('/admin/for-review');
  await expect(page.getByText('Drainage inspection', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.route('**/api/tickets/reviews*', route => route.fulfill({ status: 403, json: { message: 'Review access is unavailable.' } }));
  await page.getByRole('button', { name: 'Refresh reviews', exact: true }).click();
  await expect(page.getByText('Review access is unavailable.', { exact: true })).toBeVisible();
  await expect(page.getByText('Drainage inspection', { exact: true })).toHaveCount(0);
});

test('REVIEW queue loads later pages and searches across the complete server result', async ({ page }) => {
  await session(page, manager);
  await page.route('**/api/tickets/reviews*', route => {
    const params = new URL(route.request().url()).searchParams;
    const rows = Array.from({ length: 11 }, (_, index) => report({ _id: `page-${index}`, title: `Inspection ${index}`, review: pendingReview }));
    const filtered = params.get('search') ? rows.filter(row => row.title.includes(params.get('search'))) : rows;
    const pageNumber = Number(params.get('page') || 1);
    return route.fulfill({ json: { items: filtered.slice((pageNumber - 1) * 10, pageNumber * 10), total: filtered.length, page: pageNumber, counts: { pending: 11, reviewed: 0 } } });
  });
  await page.goto('/admin/for-review');
  await expect(page.getByRole('status')).toHaveText('11 tickets awaiting review');
  await expect(page.getByRole('heading', { name: 'Inspection 10', exact: true })).toHaveCount(0);
  await page.getByTitle('2', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Inspection 10', exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search ticket reviews', exact: true }).fill('Inspection 10');
  await expect(page.getByRole('status')).toHaveText('1 ticket awaiting review');
  await expect(page.getByRole('heading', { name: 'Inspection 10', exact: true })).toBeVisible();
});

test('REVIEW full stack Employee submission notifies Admin, completes on update, and permits a new review before resolution', async ({ page, request }, testInfo) => {
  const authenticate = async email => {
    const response = await request.post('/api/auth/login', { data: { email, password: 'Password123!' } });
    expect(response.status()).toBe(200); return response.json();
  };
  const admin = await authenticate('maria.santos@email.com');
  const headers = who => ({ Authorization: `Bearer ${who.token}` });
  const registered = await request.post('/api/auth/register', { data: { firstName: 'Review', lastName: 'Worker', phone: testPhone(), password: 'Password123!' } });
  expect(registered.status()).toBe(201); const worker = await registered.json();
  expect((await request.patch(`/api/users/${worker.user._id}/role`, { headers: headers(admin), data: { role: 'employee', confirmationIdentifier: worker.user.phone } })).status()).toBe(200);
  const resident = await authenticate('ana.reyes@email.com');
  const submitted = await request.post('/api/tickets', { headers: headers(resident), data: { title: 'Review workflow drainage', description: 'Inspect drainage at the entrance.', category: 'Infrastructure', location: 'Baclaran', contactNumber: '09991234567' } });
  expect(submitted.status()).toBe(201); const row = await submitted.json();
  expect((await request.patch(`/api/tickets/${row._id}/assign`, { headers: headers(admin), data: { assignedTo: worker.user._id } })).status()).toBe(200);
  const open = async (who, path) => {
    await page.goto('/login'); await page.evaluate(token => localStorage.setItem('token', token), who.token); await page.goto(path);
  };
  await open(worker, `/employee/ticket/${row._id}`);
  await expect(page.getByText('09991234567', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Submit for Review', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Submit for Review', exact: true })).toBeDisabled();
  await open(admin, '/admin/for-review');
  await expect(page.getByRole('heading', { name: row.title, exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /For Review/ })).toContainText('1');
  await page.getByRole('button', { name: 'Review ticket', exact: true }).click();
  await page.getByPlaceholder('Add a new update or note to this ticket...').fill('The inspection results have been reviewed.');
  await page.getByRole('button', { name: 'Post Update', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Employee review', exact: true })).toContainText('Reviewed');
  await expect(page.getByRole('button', { name: 'Mark Resolved', exact: true })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('admin-reviewed-report.png'), fullPage: true });
  await open(worker, `/employee/ticket/${row._id}`);
  await expect(page.getByRole('button', { name: 'Submit for Review', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Submit for Review', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Submit for Review', exact: true })).toBeDisabled();
  await open(admin, `/admin/ticket/${row._id}`);
  await page.getByRole('button', { name: 'Mark Resolved', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('Ticket resolved and moved to Archive', { exact: true })).toBeVisible();
  const persisted = await (await request.get(`/api/tickets/${row._id}`, { headers: headers(admin) })).json();
  expect(persisted.isArchived).toBe(true); expect(persisted.review.status).toBe('reviewed');
  const userView = await (await request.get(`/api/tickets/${row._id}`, { headers: headers(resident) })).json();
  expect(userView).not.toHaveProperty('review'); expect(userView).not.toHaveProperty('reviewHistory');
  expect(userView.notes.some(note => note.text === 'The inspection results have been reviewed.')).toBe(true);
});
