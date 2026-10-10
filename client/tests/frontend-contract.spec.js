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
  await page.route('**/api/tickets/a/link', async (route) => {
    await delayed;
    await route.fulfill({ json: { ...ticketA, linkedTicket: ticketC } });
  });
  await page.goto('/admin/ticket/a');
  const select = page.getByRole('combobox', { name: 'Link to Duplicate' });
  await select.focus();
  await select.press('ArrowDown');
  const mutation = page.waitForRequest('**/api/tickets/a/link');
  await page.getByRole('option', { name: 'Ticket C', exact: true }).click();
  await mutation;
  await page.getByRole('link', { name: 'Ticket B', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/ticket\/b$/);
  await expect(page.locator('.detail-card')).toContainText('Second report');
  const response = page.waitForResponse('**/api/tickets/a/link');
  release();
  await (await response).finished();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator('.detail-card').getByText('Ticket B', { exact: true })).toBeVisible();
  await expect(page.locator('.detail-card').getByText('Ticket A', { exact: true })).toHaveCount(0);
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
