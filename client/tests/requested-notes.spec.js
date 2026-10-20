import { test, expect } from '@playwright/test';
import { testPhone } from './helpers/phone';

const password = 'Password123!';

async function login(request, email) {
  const response = await request.post('/api/auth/login', { data: { email, password } });
  expect(response.status()).toBe(200);
  const account = await response.json();
  return { ...account, headers: { Authorization: `Bearer ${account.token}` } };
}

test('NOTES residents cannot select priority and see the priority assigned by an admin', async ({ page, request }) => {
  const resident = await login(request, 'ana.reyes@email.com');
  const admin = await login(request, 'maria.santos@email.com');
  await page.addInitScript(token => localStorage.setItem('token', token), resident.token);
  await page.goto('/resident/submit-ticket');
  await expect(page.getByRole('combobox', { name: 'Priority', exact: true })).toHaveCount(0);
  await expect(page.getByText('New reports start at Medium priority.', { exact: false })).toBeVisible();
  const created = await request.post('/api/tickets', { headers: resident.headers, data: {
    title: 'Notes priority ownership', description: 'Maintenance requested at the market.', category: 'Infrastructure', location: 'Baclaran', priority: 'Urgent',
  } });
  expect(created.status()).toBe(201);
  const ticket = await created.json();
  expect(ticket.priority).toBe('Medium');
  await page.goto(`/resident/ticket/${ticket._id}`);
  await expect(page.locator('.detail-card').getByText('Medium', { exact: true })).toBeVisible();
  await expect(page.locator('.detail-card').getByRole('combobox')).toHaveCount(0);
  expect((await request.patch(`/api/tickets/${ticket._id}/priority`, { headers: resident.headers, data: { priority: 'Urgent' } })).status()).toBe(403);
  expect((await request.patch(`/api/tickets/${ticket._id}/priority`, { headers: admin.headers, data: { priority: 'High' } })).status()).toBe(200);
  await page.reload();
  await expect(page.locator('.detail-card').getByText('High', { exact: true })).toBeVisible();
  await expect(page.locator('.detail-card').getByRole('combobox')).toHaveCount(0);
});

test('NOTES a failed role change keeps the confirmation available for a deliberate retry', async ({ page, request }) => {
  const admin = await login(request, 'maria.santos@email.com');
  const email = `notes-role-${Date.now()}@example.com`;
  const registered = await request.post('/api/auth/register', { data: { firstName: 'Notes', lastName: 'Role', email, password, phone: testPhone() } });
  expect(registered.status()).toBe(201);
  const { user } = await registered.json();
  await page.addInitScript(token => localStorage.setItem('token', token), admin.token);
  await page.goto('/admin/users');
  const search = page.getByPlaceholder('Search users by name, email or phone');
  await search.fill(email);
  await search.press('Enter');
  const row = page.getByRole('row').filter({ hasText: email });
  await row.getByRole('button', { name: 'Change Role', exact: true }).click();
  const role = page.getByRole('combobox', { name: 'New Role', exact: true });
  await role.focus();
  await role.press('ArrowDown');
  await page.getByRole('option', { name: 'Admin', exact: true }).click();
  await page.getByLabel('Confirm account email', { exact: true }).fill(email);
  const url = `**/api/users/${user._id}/role`;
  await page.route(url, route => route.fulfill({ status: 500, json: { message: 'Role service unavailable' } }));
  const confirm = page.getByRole('button', { name: /Confirm Role Change$/ });
  await confirm.click();
  await expect(page.getByText('Role service unavailable', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Confirm account email', { exact: true })).toHaveValue(email);
  const unchanged = await request.get(`/api/users/${user._id}`, { headers: admin.headers });
  expect((await unchanged.json()).role).toBe('user');
  await page.unroute(url);
  await expect(confirm).not.toHaveClass(/ant-btn-loading(?:\s|$)/);
  await confirm.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(row).toContainText('Admin');
  const saved = await request.get(`/api/users/${user._id}`, { headers: admin.headers });
  expect((await saved.json()).role).toBe('admin');
});
