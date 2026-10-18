import { test, expect } from '@playwright/test';

const owner = { _id: '000000000000000000000001', firstName: 'Ana', lastName: 'Reyes', role: 'user', email: 'ana@example.com' };
const ticketId = '000000000000000000000010';
const requestId = '000000000000000000000020';
const createdAt = '2026-10-19T02:00:00.000Z';
const requestRecord = (overrides = {}) => ({ _id: requestId, type: 'follow_up', message: 'Please inspect the market.', state: 'pending', createdAt, ...overrides });
const report = (overrides = {}) => ({ _id: ticketId, title: 'Market drainage report', description: 'Water collects by the entrance.', category: 'Infrastructure', location: 'Baclaran market', priority: 'Medium', status: 'Pending', isArchived: false, createdAt, submittedBy: owner, notes: [], requests: [], ...overrides });
const inboxItem = (overrides = {}) => ({ ...requestRecord(), ticketId, title: 'Market drainage report', ticketStatus: 'Pending', isArchived: false, requester: owner, read: false, ...overrides });

async function session(page, role = 'user') {
  await page.addInitScript(() => localStorage.setItem('token', 'update1-contract-token'));
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ...owner, role } }));
  await page.route(url => url.pathname === '/api/tickets', route => route.fulfill({ json: [] }));
}
async function choose(page, name, value) {
  const select = page.getByRole('combobox', { name, exact: true });
  await select.focus(); await select.press('ArrowDown');
  await page.getByRole('option', { name: value, exact: true }).click();
}

test('UPDATE1 User request uses server eligibility, preserves a rate-limited draft and shows public history', async ({ page }) => {
  await session(page);
  let current = report({ requestEligibility: { follow_up: { allowed: true }, progress_update: { allowed: false, reason: 'Not in progress' }, appeal: { allowed: false } } });
  await page.route(`**/api/tickets/${ticketId}`, route => route.fulfill({ json: current }));
  let attempts = 0;
  await page.route(`**/api/tickets/${ticketId}/requests`, route => {
    expect(route.request().postDataJSON()).toEqual({ type: 'follow_up', message: 'Please inspect the market.' });
    if (++attempts === 1) return route.fulfill({ status: 429, json: { message: 'Communication limit reached', retryAfter: 30 } });
    current = { ...current, requests: [requestRecord()], requestEligibility: { follow_up: { allowed: false, reason: 'An earlier follow-up is still outstanding.' } } };
    return route.fulfill({ json: current });
  });
  await page.goto(`/user/ticket/${ticketId}`);
  await expect(page.getByRole('button', { name: 'Request progress update', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Request follow-up', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Message (optional)', { exact: true }).fill('Please inspect the market.');
  await dialog.getByRole('button', { name: 'Send request', exact: true }).click();
  await expect(dialog.getByText(/Communication limit reached/)).toBeVisible();
  await expect(dialog.getByText(/30 seconds/)).toBeVisible();
  await expect(dialog.getByLabel('Message (optional)', { exact: true })).toHaveValue('Please inspect the market.');
  await dialog.getByRole('button', { name: 'Send request', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Request follow-up', exact: true })).toBeDisabled();
  await expect(page.getByText('An earlier follow-up is still outstanding.', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Request history', exact: true })).toContainText('Please inspect the market.');
  await expect(page.getByText('Status History', { exact: true })).toHaveCount(0);
});

test('UPDATE1 archived dismissed reports remain reachable and appeal requires an explanation', async ({ page }) => {
  await session(page);
  const archived = report({ status: 'Dismissed', isArchived: true, requestEligibility: { appeal: { allowed: true } } });
  await page.route('**/api/tickets/my-tickets*', route => route.fulfill({ json: new URL(route.request().url()).searchParams.get('archived') === 'dismissed' ? [archived] : [] }));
  await page.route(`**/api/tickets/${ticketId}`, route => route.fulfill({ json: archived }));
  await page.route(`**/api/tickets/${ticketId}/requests`, route => {
    expect(route.request().postDataJSON()).toEqual({ type: 'appeal', message: 'The obstruction remains.' });
    return route.fulfill({ json: { ...archived, requests: [requestRecord({ type: 'appeal', message: 'The obstruction remains.' })], requestEligibility: { appeal: { allowed: false, reason: 'An appeal has already been submitted for this dismissal.' } } } });
  });
  await page.goto('/user/my-tickets');
  await page.getByRole('radio', { name: 'Archived dismissed', exact: true }).check();
  await expect(page).toHaveURL(/archived=dismissed/);
  await page.getByRole('button', { name: archived.title, exact: true }).click();
  await page.getByRole('button', { name: 'Appeal dismissal', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Submit appeal', exact: true })).toBeDisabled();
  await expect(dialog.getByText(/existing evidence/i)).toBeVisible();
  await dialog.getByLabel('Appeal explanation', { exact: true }).fill('The obstruction remains.');
  await dialog.getByRole('button', { name: 'Submit appeal', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Request history', exact: true })).toContainText('The obstruction remains.');
  await page.getByRole('button', { name: 'Back to tickets', exact: true }).click();
  await expect(page).toHaveURL(/archived=dismissed/);
});

test('UPDATE1 Admin legacy reversal requires a reason and explicit target, then displays its audit history', async ({ page }) => {
  await session(page, 'admin');
  const current = report({ status: 'Dismissed', isArchived: true, reversal: { options: ['Pending', 'In Progress'], legacy: true }, statusHistory: [] });
  await page.route(`**/api/tickets/${ticketId}`, route => route.fulfill({ json: current }));
  await page.route(`**/api/tickets/${ticketId}/revert`, route => {
    expect(route.request().postDataJSON()).toEqual({ status: 'In Progress', reason: 'Dismissed in error.' });
    return route.fulfill({ json: { ...current, status: 'In Progress', isArchived: false, reversal: { options: [], legacy: false }, statusHistory: [{ from: 'Dismissed', to: 'In Progress', kind: 'legacy_correction', reason: 'Dismissed in error.', createdAt, changedBy: { firstName: 'Maria', lastName: 'Santos' } }] } });
  });
  await page.goto(`/admin/ticket/${ticketId}`);
  await page.getByRole('button', { name: 'Revert Status', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/Legacy correction/i).first()).toBeVisible();
  const confirm = dialog.getByRole('button', { name: 'Confirm reversal', exact: true });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel('Reason for reversal', { exact: true }).fill('Dismissed in error.');
  await expect(confirm).toBeDisabled();
  await choose(page, 'Restore status', 'In Progress');
  await confirm.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Status History', exact: true })).toContainText('Dismissed in error.');
  await expect(page.getByRole('region', { name: 'Status History', exact: true })).toContainText('Legacy correction');
  await expect(page.getByRole('button', { name: 'Mark Resolved', exact: true })).toBeVisible();
});

test('UPDATE1 Employee viewing, acknowledgement and public completion remain distinct actions', async ({ page }) => {
  await session(page, 'employee');
  let entry = inboxItem();
  const actions = [];
  await page.route('**/api/tickets/requests*', route => route.fulfill({ json: { items: [entry], total: 1, page: 1, pages: 1, counts: { outstanding: entry.state === 'completed' ? 0 : 1, unread: entry.read ? 0 : 1 } } }));
  await page.route(`**/api/tickets/${ticketId}/requests/${requestId}`, route => {
    const body = route.request().postDataJSON(); actions.push(body);
    if (body.action === 'view') entry = { ...entry, read: true };
    if (body.action === 'acknowledge') entry = { ...entry, state: 'acknowledged', acknowledgedAt: createdAt };
    if (body.action === 'respond') entry = { ...entry, state: 'completed', completedAt: createdAt, responseText: body.text };
    return route.fulfill({ json: report({ requests: [entry] }) });
  });
  await page.goto('/employee/action-center');
  await expect(page.getByRole('heading', { name: 'Action Center', exact: true })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Request counts', exact: true })).toContainText('1 outstanding');
  await page.getByRole('button', { name: 'Review request', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Acknowledge', exact: true })).toBeVisible();
  expect(actions).toEqual([{ action: 'view' }]);
  await expect(page.getByRole('status', { name: 'Request counts', exact: true })).toContainText('0 unread');
  await dialog.getByRole('button', { name: 'Acknowledge', exact: true }).click();
  await expect(dialog.getByText('Acknowledged', { exact: true })).toBeVisible();
  const complete = dialog.getByRole('button', { name: 'Send response and complete', exact: true });
  await expect(complete).toBeDisabled();
  await dialog.getByLabel('Public response', { exact: true }).fill('Inspection is scheduled tomorrow.');
  await complete.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status', { name: 'Request counts', exact: true })).toContainText('0 outstanding');
  expect(actions).toEqual([{ action: 'view' }, { action: 'acknowledge' }, { action: 'respond', text: 'Inspection is scheduled tomorrow.' }]);
});

test('UPDATE1 Admin appeal acceptance sends an explicit reopening status and public decision reason', async ({ page }) => {
  await session(page, 'admin');
  const entry = inboxItem({ type: 'appeal', ticketStatus: 'Dismissed', isArchived: true, message: 'The obstruction remains.' });
  await page.route('**/api/tickets/requests*', route => route.fulfill({ json: { items: [entry], total: 1, page: 1, pages: 1, counts: { outstanding: 1, unread: 1 } } }));
  let decision;
  await page.route(`**/api/tickets/${ticketId}/requests/${requestId}`, route => {
    const body = route.request().postDataJSON();
    if (body.action === 'decide') decision = body;
    return route.fulfill({ json: report({ status: 'Dismissed', isArchived: true, requests: [body.action === 'decide' ? { ...entry, state: 'completed', decision: body.decision, decisionReason: body.text } : entry], reversal: { options: ['Pending', 'In Progress'], legacy: true } }) });
  });
  await page.goto('/admin/action-center');
  await page.getByRole('button', { name: 'Review request', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await choose(page, 'Appeal decision', 'Accept and reopen');
  await dialog.getByLabel('Public decision reason', { exact: true }).fill('Existing evidence warrants inspection.');
  const confirm = dialog.getByRole('button', { name: 'Submit decision', exact: true });
  await expect(confirm).toBeDisabled();
  await choose(page, 'Reopen status', 'Pending');
  await confirm.click();
  await expect(dialog).toHaveCount(0);
  expect(decision).toEqual({ action: 'decide', decision: 'accepted', status: 'Pending', text: 'Existing evidence warrants inspection.' });
});

test('UPDATE1 Action Center sends filters and page while keeping global counts distinct', async ({ page }) => {
  await session(page, 'admin');
  const queries = [];
  await page.route('**/api/tickets/requests*', route => {
    const query = Object.fromEntries(new URL(route.request().url()).searchParams); queries.push(query);
    return route.fulfill({ json: { items: [inboxItem({ title: query.page === '2' ? 'Second page report' : 'First page report' })], total: 11, page: Number(query.page || 1), pages: 2, counts: { outstanding: 23, unread: 9 } } });
  });
  await page.goto('/admin/action-center');
  await choose(page, 'Request type', 'Progress update');
  await choose(page, 'Request state', 'Acknowledged');
  await page.getByRole('searchbox', { name: 'Search requests', exact: true }).fill('drainage');
  await expect.poll(() => queries.at(-1)?.search).toBe('drainage');
  await page.getByTitle('2', { exact: true }).click();
  await expect(page.getByText('Second page report', { exact: true })).toBeVisible();
  expect(queries.at(-1)).toMatchObject({ type: 'progress_update', state: 'acknowledged', search: 'drainage', page: '2', limit: '10' });
  await expect(page.getByRole('status', { name: 'Request counts', exact: true })).toContainText('23 outstanding');
  await expect(page.getByRole('status', { name: 'Request counts', exact: true })).toContainText('9 unread');
});

test('UPDATE1 revoked Employee request access clears the request content and draft', async ({ page }) => {
  await session(page, 'employee');
  let revoked = false;
  await page.route('**/api/tickets/requests*', route => route.fulfill({ json: { items: revoked ? [] : [inboxItem()], total: revoked ? 0 : 1, page: 1, pages: 1, counts: { outstanding: revoked ? 0 : 1, unread: 0 } } }));
  await page.route(`**/api/tickets/${ticketId}/requests/${requestId}`, route => {
    if (route.request().postDataJSON().action === 'view') return route.fulfill({ json: report({ requests: [requestRecord()] }) });
    revoked = true;
    return route.fulfill({ status: 403, json: { message: 'Ticket access has changed.' } });
  });
  await page.goto('/employee/action-center');
  await page.getByRole('button', { name: 'Review request', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Public response', { exact: true }).fill('Draft that must be cleared');
  await dialog.getByRole('button', { name: 'Send response and complete', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Ticket access has changed.', { exact: true })).toBeVisible();
  await expect(page.getByText('Market drainage report', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Please inspect the market.', { exact: true })).toHaveCount(0);
});

test('UPDATE1 a failed staff response preserves the draft and a later explicit retry completes it', async ({ page }) => {
  await session(page, 'employee');
  await page.route('**/api/tickets/requests*', route => route.fulfill({ json: { items: [inboxItem()], total: 1, page: 1, pages: 1, counts: { outstanding: 1, unread: 0 } } }));
  let attempts = 0;
  await page.route(`**/api/tickets/${ticketId}/requests/${requestId}`, route => {
    const body = route.request().postDataJSON();
    if (body.action === 'view') return route.fulfill({ json: report({ requests: [requestRecord()] }) });
    expect(body).toEqual({ action: 'respond', text: 'Inspection is scheduled tomorrow.' });
    if (++attempts === 1) return route.fulfill({ status: 409, json: { message: 'Request changed. Please review before retrying.' } });
    return route.fulfill({ json: report({ requests: [requestRecord({ state: 'completed', responseText: body.text })] }) });
  });
  await page.goto('/employee/action-center');
  await page.getByRole('button', { name: 'Review request', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Public response', { exact: true }).fill('Inspection is scheduled tomorrow.');
  await dialog.getByRole('button', { name: 'Send response and complete', exact: true }).click();
  await expect(dialog.getByText('Request changed. Please review before retrying.', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Public response', { exact: true })).toHaveValue('Inspection is scheduled tomorrow.');
  await dialog.getByRole('button', { name: 'Send response and complete', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(attempts).toBe(2);
});

test('UPDATE1 closing a pending review prevents its late response from restoring a request', async ({ page }) => {
  await session(page, 'employee');
  await page.route('**/api/tickets/requests*', route => route.fulfill({ json: { items: [inboxItem()], total: 1, page: 1, pages: 1, counts: { outstanding: 1, unread: 0 } } }));
  let pendingView;
  await page.route(`**/api/tickets/${ticketId}/requests/${requestId}`, route => { pendingView = route; });
  await page.goto('/employee/action-center');
  await page.getByRole('button', { name: 'Review request', exact: true }).click();
  await expect.poll(() => !!pendingView).toBe(true);
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
  await pendingView.fulfill({ json: report({ requests: [requestRecord()] }) });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Public response', { exact: true })).toHaveCount(0);
});

test('UPDATE1 a late User request response cannot restore a ticket after ownership access is revoked', async ({ page }) => {
  await session(page);
  let reads = 0;
  const current = report({ requestEligibility: { follow_up: { allowed: true } } });
  await page.route(`**/api/tickets/${ticketId}`, route => ++reads <= 2
    ? route.fulfill({ json: current })
    : route.fulfill({ status: 403, json: { message: 'Ticket no longer available to this account.' } }));
  // StrictMode may perform one or two initial reads; revoke explicitly after the dialog opens.
  let pendingSubmission;
  await page.route(`**/api/tickets/${ticketId}/requests`, route => { pendingSubmission = route; });
  await page.goto(`/user/ticket/${ticketId}`);
  await page.getByRole('button', { name: 'Request follow-up', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Send request', exact: true }).click();
  await expect.poll(() => !!pendingSubmission).toBe(true);
  await page.route(`**/api/tickets/${ticketId}`, route => route.fulfill({ status: 403, json: { message: 'Ticket no longer available to this account.' } }));
  // The page remains in place; trigger its refresh through the underlying button while the modal is busy.
  await page.getByRole('button', { name: 'Refresh details', exact: true }).evaluate(button => button.click());
  await expect(page.getByText('Ticket no longer available to this account.', { exact: true })).toBeVisible();
  await pendingSubmission.fulfill({ json: { ...current, requests: [requestRecord()] } });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(current.title, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Request history', exact: true })).toHaveCount(0);
});

for (const width of [320, 375]) {
  test(`UPDATE1 request controls and staff review fit ${width}px with keyboard-operable forms`, async ({ page }) => {
    await session(page, 'employee');
    await page.setViewportSize({ width, height: 850 });
    await page.route('**/api/tickets/requests*', route => route.fulfill({ json: { items: [inboxItem()], total: 1, page: 1, pages: 1, counts: { outstanding: 1, unread: 1 } } }));
    await page.route(`**/api/tickets/${ticketId}/requests/${requestId}`, route => route.fulfill({ json: report({ requests: [requestRecord()] }) }));
    await page.goto('/employee/action-center');
    await expect(page.getByRole('heading', { name: 'Action Center', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const review = page.getByRole('button', { name: 'Review request', exact: true });
    await review.focus(); await review.press('Enter');
    await expect(page.getByRole('dialog').getByLabel('Public response', { exact: true })).toBeVisible();
    const bounds = await page.getByRole('dialog').boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}
