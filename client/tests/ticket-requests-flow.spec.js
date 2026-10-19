import { test, expect } from '@playwright/test';

const password = 'Password123!';
const headers = account => ({ Authorization: `Bearer ${account.token}` });
async function manager(request) {
  const response = await request.post('/api/auth/login', { data: { email: 'maria.santos@email.com', password } });
  expect(response.status()).toBe(200); return response.json();
}
async function account(request, suffix) {
  const response = await request.post('/api/auth/register', { data: { firstName: 'Request', lastName: suffix,
    email: `request-flow-${suffix}-${Date.now()}@example.test`, password } });
  expect(response.status()).toBe(201); return response.json();
}
async function report(request, owner, suffix) {
  const response = await request.post('/api/tickets', { headers: headers(owner), data: {
    title: `Request flow ${suffix}`, description: 'Inspect drainage at the market entrance.', category: 'Infrastructure', location: 'Baclaran market',
  } });
  expect(response.status()).toBe(201); return response.json();
}
async function openAs(page, who, path) {
  await page.goto('/login'); await page.evaluate(token => localStorage.setItem('token', token), who.token); await page.goto(path);
}
async function choose(page, label, option) {
  const input = page.getByRole('combobox', { name: label, exact: true }); await input.focus(); await input.press('ArrowDown');
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function createFromUI(page, name, text = '') {
  await page.getByRole('button', { name, exact: true }).click();
  const dialog = page.getByRole('dialog');
  if (text) await dialog.getByRole('textbox').fill(text);
  await dialog.getByRole('button', { name: name === 'Appeal dismissal' ? 'Submit appeal' : 'Send request', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
async function review(page, role, ticket) {
  await page.goto(`/${role}/action-center`);
  await page.getByRole('searchbox', { name: 'Search requests', exact: true }).fill(ticket._id);
  const card = page.locator('.request-inbox-card').filter({ has: page.getByRole('heading', { name: ticket.title, exact: true }) }).filter({ hasText: 'Pending' });
  await card.last().getByRole('button', { name: 'Review request', exact: true }).click();
  return page.getByRole('dialog');
}

test('UPDATE1 full stack User follow-up, assigned Employee update and Admin appeal decision persist across sessions', async ({ page, request }, testInfo) => {
  test.setTimeout(90000);
  const admin = await manager(request), owner = await account(request, 'Owner'), employee = await account(request, 'Employee');
  const promoted = await request.patch(`/api/users/${employee.user._id}/role`, { headers: headers(admin), data: { role: 'employee', confirmationEmail: employee.user.email } });
  expect(promoted.status()).toBe(200);
  const ticket = await report(request, owner, 'all request types');
  await openAs(page, owner, `/user/ticket/${ticket._id}`);
  await createFromUI(page, 'Request follow-up', 'Please review this drainage report.');
  await expect(page.getByRole('button', { name: 'Request follow-up', exact: true })).toBeDisabled();
  await openAs(page, admin, '/admin/action-center');
  let dialog = await review(page, 'admin', ticket);
  await dialog.getByLabel('Public response', { exact: true }).fill('An inspection will be assigned.');
  await dialog.getByRole('button', { name: 'Send response and complete', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await request.patch(`/api/tickets/${ticket._id}/assign`, { headers: headers(admin), data: { assignedTo: employee.user._id } })).status()).toBe(200);
  await openAs(page, owner, `/user/ticket/${ticket._id}`);
  await createFromUI(page, 'Request progress update', 'When will the inspection happen?');
  await openAs(page, employee, '/employee/action-center');
  dialog = await review(page, 'employee', ticket);
  await dialog.getByRole('button', { name: 'Acknowledge', exact: true }).click();
  await expect(dialog.getByText('Acknowledged', { exact: true })).toBeVisible();
  await dialog.getByLabel('Public response', { exact: true }).fill('Inspection is scheduled for tomorrow morning.');
  await dialog.getByRole('button', { name: 'Send response and complete', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await request.put(`/api/tickets/${ticket._id}/status`, { headers: headers(admin), data: { status: 'Dismissed' } })).status()).toBe(200);
  await openAs(page, owner, `/user/ticket/${ticket._id}`);
  await createFromUI(page, 'Appeal dismissal', 'The drain is still blocked and needs inspection.');
  await openAs(page, admin, '/admin/action-center');
  dialog = await review(page, 'admin', ticket);
  await choose(page, 'Appeal decision', 'Accept and reopen'); await choose(page, 'Reopen status', 'In Progress');
  await dialog.getByLabel('Public decision reason', { exact: true }).fill('The report will be investigated again.');
  await dialog.getByRole('button', { name: 'Submit decision', exact: true }).click(); await expect(dialog).toHaveCount(0);
  await openAs(page, owner, `/user/ticket/${ticket._id}`);
  const history = page.getByRole('region', { name: 'Request history', exact: true });
  await expect(history).toContainText('Inspection is scheduled for tomorrow morning.');
  await expect(history).toContainText('The report will be investigated again.');
  await page.screenshot({ path: testInfo.outputPath('user-request-history.png'), fullPage: true });
  await expect(page.getByRole('region', { name: 'Status History', exact: true })).toHaveCount(0);
  const saved = await (await request.get(`/api/tickets/${ticket._id}`, { headers: headers(admin) })).json();
  expect(saved.status).toBe('In Progress'); expect(saved.requests.map(item => item.state)).toEqual(['completed', 'completed', 'completed']);
  expect(saved.statusHistory.at(-1).kind).toBe('reversal');
  const safe = await (await request.get(`/api/tickets/${ticket._id}`, { headers: headers(employee) })).json();
  expect(safe.requests.some(item => item.type === 'appeal')).toBe(false);
});

test('UPDATE1 full stack Admin reverses an automatically archived resolution through the required-reason dialog', async ({ page, request }) => {
  const admin = await manager(request), owner = await account(request, 'ReversalOwner');
  const ticket = await report(request, owner, 'resolution reversal');
  for (const status of ['In Progress', 'Resolved']) expect((await request.put(`/api/tickets/${ticket._id}/status`, { headers: headers(admin), data: { status } })).status()).toBe(200);
  await openAs(page, admin, `/admin/ticket/${ticket._id}`);
  await page.getByRole('button', { name: 'Revert Status', exact: true }).click(); const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Current status:')).toContainText('Resolved');
  await choose(page, 'Restore status', 'In Progress');
  await expect(dialog.getByRole('button', { name: 'Confirm reversal', exact: true })).toBeDisabled();
  await dialog.getByLabel('Reason for reversal', { exact: true }).fill('The inspection has not yet finished.');
  await dialog.getByRole('button', { name: 'Confirm reversal', exact: true }).click(); await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mark Resolved', exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole('region', { name: 'Status History', exact: true })).toContainText('The inspection has not yet finished.');
  const saved = await (await request.get(`/api/tickets/${ticket._id}`, { headers: headers(admin) })).json();
  expect(saved.isArchived).toBe(false); expect(saved.resolvedAt).toBe(null); expect(saved.statusHistory.at(-1).previousResolvedAt).toBeTruthy();
});
