import { test, expect } from '@playwright/test';

const resident = {
  _id: '000000000000000000000001', firstName: 'Ana', lastName: 'Reyes',
  email: 'ana.reyes@email.com', role: 'resident', phone: '09191234569', address: 'Baclaran',
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('token', 'contract-test-token'));
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: resident }));
});

test('profile reads the current user and preserves unsaved edits after failure', async ({ page }) => {
  await page.route('**/api/auth/profile', (route) => route.fulfill({ status: 500, json: { message: 'Profile service unavailable' } }));
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible();
  await expect(page.getByText(resident.email, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Profile' }).click();
  await page.getByLabel('Phone', { exact: true }).fill('09190009999');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByText('Profile service unavailable')).toBeVisible();
  await expect(page.getByLabel('Phone', { exact: true })).toHaveValue('09190009999');
});

for (const editor of ['profile', 'admin']) {
test(`AUD-06 ${editor} form preserves an unchanged legacy contact when editing an address`, async ({ page }) => {
  let stored = { ...resident, phone: 'legacy contact' };
  const currentUser = editor === 'admin' ? { ...resident, _id: '000000000000000000000002', role: 'admin' } : stored;
  await page.route('**/api/auth/me', route => route.fulfill({ json: currentUser }));
  await page.route(url => url.pathname === '/api/users', route => route.fulfill({ json: [stored] }));
  const updatePath = editor === 'admin' ? `/api/users/${resident._id}` : '/api/auth/profile';
  await page.route(`**${updatePath}`, route => {
    stored = { ...stored, ...route.request().postDataJSON() };
    return route.fulfill({ json: stored });
  });
  await page.goto(editor === 'admin' ? '/admin/users' : '/profile');
  await page.getByRole('button', { name: editor === 'admin' ? 'Edit' : 'Edit Profile', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Phone', { exact: true })).toHaveValue('legacy contact');
  await dialog.getByLabel('Address', { exact: true }).fill('Updated address');
  const saved = page.waitForRequest(request => new URL(request.url()).pathname === updatePath && request.method() === 'PUT');
  await dialog.getByRole('button', { name: 'Save Changes', exact: true }).click();
  expect((await saved).postDataJSON()).not.toHaveProperty('phone');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('Updated address', { exact: true })).toBeVisible();
  await expect(page.getByText('legacy contact', { exact: true })).toBeVisible();
});
}

test('ticket fetch failure leaves an explanatory result and back navigation', async ({ page }) => {
  await page.route('**/api/tickets/000000000000000000000099', (route) => route.fulfill({ status: 404, json: { message: 'Ticket not found' } }));
  await page.goto('/resident/ticket/000000000000000000000099');
  await expect(page.getByText('Ticket not found', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to tickets' })).toBeVisible();
});

test('empty ticket response renders zero statistics and an empty state', async ({ page }) => {
  await page.route('**/api/tickets/my-tickets*', (route) => route.fulfill({ json: [] }));
  await page.goto('/resident/dashboard');
  await expect(page.getByRole('heading', { name: 'Welcome, Ana!' })).toBeVisible();
  await expect(page.locator('.ant-statistic-content-value')).toHaveText(['0', '0', '0', '0']);
  await expect(page.getByText('No tickets yet')).toBeVisible();
});

test('a delayed ticket mutation cannot replace the record after linked navigation', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { ...resident, role: 'admin' } }));
  const ticketB = { _id: 'b', title: 'Ticket B', description: 'Second report', category: 'Sanitation', status: 'Pending', priority: 'Medium', location: 'Baclaran', submittedBy: resident, createdAt: '2026-10-01T00:00:00Z' };
  const ticketA = { ...ticketB, _id: 'a', title: 'Ticket A', linkedTicket: ticketB };
  const ticketC = { ...ticketB, _id: 'c', title: 'Ticket C' };
  await page.route('**/api/tickets', (route) => route.fulfill({ json: [ticketA, ticketB, ticketC] }));
  await page.route('**/api/tickets/a', (route) => route.fulfill({ json: ticketA }));
  await page.route('**/api/tickets/b', (route) => route.fulfill({ json: ticketB }));
  let release;
  const delayed = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/tickets/c/link', async (route) => {
    await delayed;
    await route.fulfill({ json: { ...ticketC, linkedTicket: ticketA } });
  });
  try {
  await page.goto('/admin/ticket/a');
  const select = page.getByRole('combobox', { name: 'Link to Duplicate' });
  await select.focus();
  await select.press('ArrowDown');
  await expect(page.getByRole('option', { name: 'Ticket A (Pending)', exact: true })).toHaveCount(0);
  await page.getByRole('option', { name: 'Ticket C (Pending)', exact: true }).click();
  await select.press('Escape');
  const mutation = page.waitForRequest('**/api/tickets/c/link');
  await page.getByRole('button', { name: 'Link Selected', exact: true }).click();
  expect((await mutation).postDataJSON()).toEqual({ linkedTicketId: 'a' });
  await page.getByRole('link', { name: 'Ticket B', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/ticket\/b$/);
  await expect(page.locator('.detail-card')).toContainText('Second report');
  const response = page.waitForResponse('**/api/tickets/c/link');
  release();
  await (await response).finished();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator('.detail-card').getByText('Ticket B', { exact: true })).toBeVisible();
  await expect(page.locator('.detail-card').getByText('Ticket A', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Duplicate tickets linked successfully', { exact: true })).toHaveCount(0);
  } finally { release(); }
});

test('resident pages fit a narrow phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const user = { ...resident, address: '78 Quirino Avenue, Barangay Baclaran, Parañaque City' };
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: user }));
  const tickets = [{ _id: 'phone-ticket', title: 'Repaired pedestrian ramp near Baclaran market', description: 'The ramp was repaired.', category: 'Infrastructure', status: 'Resolved', priority: 'Medium', location: 'Baclaran Public Market entrance, Quirino Avenue', submittedBy: user, createdAt: '2026-10-01T00:00:00Z' }];
  await page.route('**/api/tickets/my-tickets*', (route) => route.fulfill({ json: tickets }));
  for (const route of ['/resident/dashboard', '/resident/submit-ticket', '/resident/my-tickets', '/profile']) {
    await page.goto(route);
    await page.getByRole('heading').first().waitFor();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  }
});

test('REVAMP Employee workspace contains only operational navigation and assigned records', async ({ page }) => {
  const employee = { ...resident, _id: 'employee-one', role: 'employee' };
  await page.route('**/api/auth/me', route => route.fulfill({ json: employee }));
  await page.route(url => url.pathname === '/api/tickets', route => route.fulfill({ json: [{
    _id: 'assigned-one', title: 'Assigned drainage inspection', category: 'Others', customCategory: 'Drainage inspection',
    status: 'In Progress', priority: 'High', location: 'Baclaran', assignedTo: employee,
    createdAt: '2026-10-18T00:00:00Z', updatedAt: '2026-10-19T00:00:00Z',
  }] }));
  await page.goto('/employee/assigned-tickets');
  await expect(page.getByRole('heading', { name: 'Assigned Tickets', exact: true })).toBeVisible();
  await expect(page.getByText('Assigned drainage inspection', { exact: true })).toBeVisible();
  await expect(page.getByText('Others (Drainage inspection)', { exact: true })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(navigation.getByRole('menuitem')).toHaveCount(3);
  await expect(navigation.getByRole('menuitem', { name: /Action Center/ })).toBeVisible();
  await expect(navigation.getByRole('menuitem', { name: /Archive|Users|Dashboard/ })).toHaveCount(0);
  await expect(page.locator('.role-employee')).toBeVisible();
});

test('REVAMP legacy User list links retain the selected status on their canonical route', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ...resident, role: 'user' } }));
  await page.route('**/api/tickets/my-tickets*', route => route.fulfill({ json: [] }));
  await page.goto('/resident/my-tickets?status=Pending');
  await expect(page).toHaveURL(/\/user\/my-tickets\?status=Pending$/);
  await expect(page.getByRole('heading', { name: 'My Tickets', exact: true })).toBeVisible();
  await expect(page.locator('.role-user')).toBeVisible();
});

test('REVAMP Employee note denial clears previously visible restricted ticket details', async ({ page }) => {
  const employee = { ...resident, _id: 'employee-one', role: 'employee' };
  await page.route('**/api/auth/me', route => route.fulfill({ json: employee }));
  await page.route('**/api/tickets/assigned-one', route => route.fulfill({ json: {
    _id: 'assigned-one', title: 'Restricted assignment content', description: 'Only the current assignee may view this.',
    category: 'Infrastructure', status: 'In Progress', priority: 'Medium', location: 'Baclaran', assignedTo: employee, notes: [],
  } }));
  await page.route('**/api/tickets/assigned-one/notes', route => route.fulfill({ status: 403, json: { message: 'This ticket is no longer assigned to you' } }));
  await page.goto('/employee/ticket/assigned-one');
  await expect(page.getByText('Restricted assignment content', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark Resolved', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Link to Duplicate', exact: true })).toHaveCount(0);
  await page.getByPlaceholder('Add a new update or note to this ticket...').fill('Inspection completed');
  await page.getByRole('button', { name: 'Post Update', exact: true }).click();
  await expect(page.getByText('This ticket is no longer assigned to you', { exact: true })).toBeVisible();
  await expect(page.getByText('Restricted assignment content', { exact: true })).toHaveCount(0);
});

test('REVAMP a late Employee refresh cannot restore ticket details after a note access denial', async ({ page }) => {
  const employee = { ...resident, _id: 'employee-one', role: 'employee' };
  const ticket = { _id: 'assigned-race', title: 'Revoked assignment content', description: 'Current assignee only.',
    category: 'Infrastructure', status: 'In Progress', priority: 'Medium', location: 'Baclaran', assignedTo: employee, notes: [] };
  await page.route('**/api/auth/me', route => route.fulfill({ json: employee }));
  let releaseNote, releaseRefresh;
  const noteGate = new Promise(resolve => { releaseNote = resolve; });
  const refreshGate = new Promise(resolve => { releaseRefresh = resolve; });
  let holdRefresh = false;
  await page.route('**/api/tickets/assigned-race', async route => {
    if (holdRefresh) await refreshGate;
    await route.fulfill({ json: ticket });
  });
  await page.route('**/api/tickets/assigned-race/notes', async route => {
    await noteGate;
    await route.fulfill({ status: 403, json: { message: 'Assignment was revoked' } });
  });
  try {
    await page.goto('/employee/ticket/assigned-race');
    await expect(page.getByText(ticket.title, { exact: true })).toBeVisible();
    await page.getByPlaceholder('Add a new update or note to this ticket...').fill('Inspection update');
    const posting = page.waitForRequest('**/api/tickets/assigned-race/notes');
    await page.getByRole('button', { name: 'Post Update', exact: true }).click();
    await posting;
    holdRefresh = true;
    const refreshing = page.waitForRequest('**/api/tickets/assigned-race');
    await page.getByRole('button', { name: 'Refresh details', exact: true }).click();
    await refreshing;
    releaseNote();
    await expect(page.getByText('Assignment was revoked', { exact: true })).toBeVisible();
    await expect(page.getByText(ticket.title, { exact: true })).toHaveCount(0);
    const refreshed = page.waitForResponse('**/api/tickets/assigned-race');
    releaseRefresh();
    await (await refreshed).finished();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.getByText(ticket.title, { exact: true })).toHaveCount(0);
    await expect(page.getByText('Assignment was revoked', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Post Update', exact: true })).toHaveCount(0);
  } finally { releaseNote(); releaseRefresh(); }
});
