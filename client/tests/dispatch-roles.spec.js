import { test, expect } from '@playwright/test';

const password = 'Password123!';
const managerEmail = 'maria.santos@email.com';
const ownerEmail = 'ana.reyes@email.com';
const headers = account => ({ Authorization: `Bearer ${account.token}` });

async function session(request, email) {
  const response = await request.post('/api/auth/login', { data: { email, password } });
  expect(response.status()).toBe(200);
  return response.json();
}
async function registerEmployee(request, manager, suffix) {
  const email = `dispatch-browser-${suffix}-${Date.now()}@example.com`;
  const response = await request.post('/api/auth/register', { data: { firstName: 'Dispatch', lastName: suffix, email, password } });
  expect(response.status()).toBe(201);
  const account = await response.json();
  expect(account.user.role).toBe('user');
  const promoted = await request.patch(`/api/users/${account.user._id}/role`, { headers: headers(manager), data: { role: 'employee', confirmationEmail: email } });
  expect(promoted.status()).toBe(200);
  return { ...account, user: await promoted.json() };
}
async function incident(request, owner, title) {
  const response = await request.post('/api/tickets', { headers: headers(owner), data: {
    title, description: 'Inspect the drainage beside the market.', category: 'Others', customCategory: 'Drainage inspection', location: 'Baclaran market', priority: 'Urgent',
  } });
  expect(response.status()).toBe(201);
  const ticket = await response.json();
  expect(ticket.priority).toBe('Medium');
  return ticket;
}
async function assign(request, manager, ticket, employee) {
  const response = await request.patch(`/api/tickets/${ticket._id}/assign`, { headers: headers(manager), data: { assignedTo: employee?.user._id || null } });
  expect(response.status()).toBe(200);
  return response.json();
}
async function openAs(page, account, path) {
  await page.goto('/login');
  await page.evaluate(token => localStorage.setItem('token', token), account.token);
  await page.goto(path);
}
async function choose(page, name, label) {
  const select = page.getByRole('combobox', { name, exact: true });
  await select.focus(); await select.press('ArrowDown');
  await page.getByRole('option', { name: label, exact: true }).click();
}

test('DISPATCH Admin assigns from the UI, Employee posts updates, and User sees public communication only', async ({ page, request }) => {
  const manager = await session(request, managerEmail);
  const owner = await session(request, ownerEmail);
  const employee = await registerEmployee(request, manager, 'Communication');
  const ticket = await incident(request, owner, 'Dispatch browser communication report');
  await openAs(page, manager, `/admin/ticket/${ticket._id}`);
  await page.getByRole('button', { name: 'Assign Employee', exact: true }).click();
  await choose(page, 'Employee', `${employee.user.firstName} ${employee.user.lastName} (${employee.user.email})`);
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm Assignment', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Assignment History', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark Resolved', exact: true })).toBeVisible();
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
  await page.getByPlaceholder('Email Address', { exact: true }).fill(employee.user.email);
  await page.getByPlaceholder('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/employee\/assigned-tickets$/);
  await expect(page.getByText('Others (Drainage inspection)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: ticket.title, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Assign Employee', exact: true })).toHaveCount(0);
  await expect(page.locator('.detail-card').getByRole('combobox')).toHaveCount(0);
  const input = page.getByPlaceholder('Add a new update or note to this ticket...');
  await input.fill('Internal dispatch planning detail');
  await page.getByRole('checkbox', { name: /Private Internal Note/ }).check();
  await page.getByRole('button', { name: 'Post Update', exact: true }).click();
  await expect(page.getByText('Internal dispatch planning detail', { exact: true })).toBeVisible();
  await input.fill('The drainage inspection is scheduled tomorrow.');
  await page.getByRole('button', { name: 'Post Update', exact: true }).click();
  await expect(page.getByText('The drainage inspection is scheduled tomorrow.', { exact: true })).toBeVisible();
  await openAs(page, owner, `/user/ticket/${ticket._id}`);
  await expect(page.getByText('The drainage inspection is scheduled tomorrow.', { exact: true })).toBeVisible();
  await expect(page.getByText('Internal dispatch planning detail', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Assignment History', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await input.fill('Thank you. The market entrance is accessible.');
  await page.getByRole('button', { name: 'Post Update', exact: true }).click();
  await expect(page.getByText('User reply', { exact: true })).toBeVisible();
  const safe = await (await request.get(`/api/tickets/${ticket._id}`, { headers: headers(owner) })).json();
  expect(safe).not.toHaveProperty('assignmentHistory');
  expect(safe.assignedTo).not.toHaveProperty('email');
  expect(safe.notes.some(note => note.isPrivate)).toBe(false);
  await openAs(page, employee, `/employee/ticket/${ticket._id}`);
  await expect(page.getByText('Thank you. The market entrance is accessible.', { exact: true })).toBeVisible();
  await expect(page.getByText('Internal dispatch planning detail', { exact: true })).toBeVisible();
});

test('DISPATCH reassignment and unassignment immediately change Employee access and preserve history', async ({ page, request }) => {
  const manager = await session(request, managerEmail);
  const owner = await session(request, ownerEmail);
  const first = await registerEmployee(request, manager, 'First');
  const second = await registerEmployee(request, manager, 'Second');
  const ticket = await incident(request, owner, 'Dispatch browser reassignment report');
  const assigned = await assign(request, manager, ticket, first);
  expect(assigned.status).toBe('In Progress');
  await openAs(page, first, `/employee/ticket/${ticket._id}`);
  await expect(page.getByText(ticket.title, { exact: true })).toBeVisible();
  await assign(request, manager, ticket, second);
  await page.getByRole('button', { name: 'Refresh details', exact: true }).click();
  await expect(page.getByText(ticket.title, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Post Update', exact: true })).toHaveCount(0);
  const denied = await request.post(`/api/tickets/${ticket._id}/notes`, { headers: headers(first), data: { text: 'Must not be stored' } });
  expect(denied.status()).toBe(403);
  await openAs(page, second, '/employee/assigned-tickets');
  await expect(page.getByText(ticket.title, { exact: true })).toBeVisible();
  const removed = await assign(request, manager, ticket, null);
  expect(removed.status).toBe('In Progress');
  expect(removed.assignmentHistory.map(entry => entry.action)).toEqual(['assigned', 'reassigned', 'unassigned']);
  expect(removed.notes).toHaveLength(0);
  await page.getByRole('button', { name: /Refresh assignments$/, exact: false }).click();
  await expect(page.getByText(ticket.title, { exact: true })).toHaveCount(0);
  await assign(request, manager, ticket, second);
  const resolved = await request.put(`/api/tickets/${ticket._id}/status`, { headers: headers(manager), data: { status: 'Resolved' } });
  expect((await resolved.json()).isArchived).toBe(true);
  expect((await request.get(`/api/tickets/${ticket._id}`, { headers: headers(second) })).status()).toBe(403);
  await openAs(page, manager, `/admin/ticket/${ticket._id}`);
  await expect(page.getByText('Assignment History', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Assign Employee', exact: true })).toHaveCount(0);
});

test('DISPATCH Admin deactivates, reactivates and demotes an Employee with confirmed account controls', async ({ page, request }) => {
  const manager = await session(request, managerEmail);
  const owner = await session(request, ownerEmail);
  const employee = await registerEmployee(request, manager, 'Lifecycle');
  const ticket = await incident(request, owner, 'Dispatch browser account lifecycle report');
  await assign(request, manager, ticket, employee);
  await openAs(page, manager, '/admin/users');
  const search = page.getByPlaceholder('Search users by name or email');
  await search.fill(employee.user.email); await search.press('Enter');
  const row = page.getByRole('row').filter({ hasText: employee.user.email });
  await row.getByRole('button', { name: 'Deactivate', exact: true }).click();
  const confirmation = page.getByRole('button', { name: 'Confirm Account Status', exact: true });
  await expect(confirmation).toBeDisabled();
  await page.getByRole('dialog').getByLabel('Confirm account email', { exact: true }).fill(employee.user.email);
  await confirmation.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(row).toContainText('Inactive');
  expect((await request.get('/api/tickets', { headers: headers(employee) })).status()).toBe(401);
  let saved = await (await request.get(`/api/tickets/${ticket._id}`, { headers: headers(manager) })).json();
  expect(saved).toMatchObject({ assignedTo: null, status: 'In Progress' });
  await row.getByRole('button', { name: 'Activate', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Confirm account email', { exact: true }).fill(employee.user.email);
  await confirmation.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(row.getByRole('button', { name: 'Deactivate', exact: true })).toBeVisible();
  await assign(request, manager, ticket, employee);
  await row.getByRole('button', { name: 'Change Role', exact: true }).click();
  await choose(page, 'New Role', 'User');
  await expect(page.getByText(/All active assignments for this employee will be cleared/)).toBeVisible();
  await page.getByRole('dialog').getByLabel('Confirm account email', { exact: true }).fill(employee.user.email);
  await page.getByRole('button', { name: 'Confirm Role Change', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(row.getByText('User', { exact: true })).toBeVisible();
  saved = await (await request.get(`/api/tickets/${ticket._id}`, { headers: headers(manager) })).json();
  expect(saved).toMatchObject({ assignedTo: null, status: 'In Progress' });
  expect(saved.assignmentHistory).toHaveLength(4);
  await openAs(page, employee, '/employee/assigned-tickets');
  await expect(page).toHaveURL(/\/user\/dashboard$/);
});

test('DISPATCH Employee direct routes and forged requests cannot reach other workspaces or broaden scope', async ({ page, request }) => {
  const manager = await session(request, managerEmail);
  const owner = await session(request, ownerEmail);
  const employee = await registerEmployee(request, manager, 'Boundaries');
  const ticket = await incident(request, owner, 'Dispatch browser unassigned protected report');
  for (const path of ['/admin/users', '/admin/dashboard', '/admin/archive', '/user/submit-ticket', '/resident/my-tickets']) {
    await openAs(page, employee, path);
    await expect(page).toHaveURL(/\/employee\/assigned-tickets$/);
    await expect(page.getByText(ticket.title, { exact: true })).toHaveCount(0);
  }
  const auth = headers(employee);
  for (const path of ['/api/users', '/api/users/employees', '/api/archive', '/api/tickets/my-tickets', `/api/tickets/${ticket._id}`]) {
    expect((await request.get(path, { headers: auth })).status()).toBe(403);
  }
  expect((await request.post('/api/tickets', { headers: auth, data: { title: 'Forbidden employee submission' } })).status()).toBe(403);
  expect((await request.patch(`/api/tickets/${ticket._id}/assign`, { headers: auth, data: { assignedTo: employee.user._id } })).status()).toBe(403);
  expect((await request.patch(`/api/tickets/${ticket._id}/priority`, { headers: auth, data: { priority: 'Urgent' } })).status()).toBe(403);
  expect((await request.put(`/api/tickets/${ticket._id}/status`, { headers: auth, data: { status: 'Resolved' } })).status()).toBe(403);
  const tampered = await request.get(`/api/tickets?assignedTo=${owner.user._id}&submittedBy=${owner.user._id}&includeArchived=true`, { headers: auth });
  expect(tampered.status()).toBe(200);
  expect(await tampered.json()).toEqual([]);
});

test('DISPATCH Employee and User workspaces fit phones and retain their distinct list presentations', async ({ page, request }, testInfo) => {
  const manager = await session(request, managerEmail);
  const owner = await session(request, ownerEmail);
  const employee = await registerEmployee(request, manager, 'Mobile');
  const ticket = await incident(request, owner, 'Dispatch browser mobile report');
  await assign(request, manager, ticket, employee);
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await openAs(page, employee, '/employee/assigned-tickets');
    await expect(page.locator('.employee-queue-panel .ant-table')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByRole('button', { name: ticket.title, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Post Update', exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await openAs(page, owner, '/user/my-tickets');
    await expect(page.locator('.user-report-card').filter({ hasText: ticket.title })).toBeVisible();
    await expect(page.locator('.ant-table')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 1440) await page.screenshot({ path: testInfo.outputPath('user-workspace.png'), fullPage: true });
  }
  await openAs(page, employee, '/employee/assigned-tickets');
  await page.screenshot({ path: testInfo.outputPath('employee-workspace.png'), fullPage: true });
});
