import { test, expect } from '@playwright/test';
import { testPhone } from './helpers/phone';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ADMIN = 'maria.santos@email.com';
const RESIDENT = 'ana.reyes@email.com';
const PASSWORD = 'Password123!';
const categories = ['Sanitation', 'Infrastructure', 'Security', 'Noise Complaint', 'Public Safety', 'Environmental Hazard', 'Utilities'];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=', 'base64');
const uploadedFiles = new Set();
const uploadDirectory = path.resolve(fileURLToPath(new URL('../../server/uploads/', import.meta.url)));

test.afterAll(async () => {
  // Remove only the photos created by this worker's test requests.
  for (const file of uploadedFiles) {
    try { await unlink(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
});

async function authenticate(request, email = ADMIN, password = PASSWORD) {
  const response = await request.post('/api/auth/login', { data: { email, password } });
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  return { Authorization: `Bearer ${data.token}` };
}

async function login(page, email = RESIDENT, password = PASSWORD) {
  await page.goto('/login');
  await page.getByPlaceholder('Phone Number or Email', { exact: true }).fill(email);
  await page.getByPlaceholder('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(email === ADMIN ? /\/admin\/dashboard$/ : /\/user\/dashboard$/);
}

async function choose(page, label, value) {
  const select = page.getByRole('combobox', { name: label, exact: true });
  await select.focus();
  await select.press('ArrowDown');
  await page.getByRole('option', { name: value, exact: true }).click();
}

async function createIncident(request, headers, title, overrides = {}) {
  const response = await request.post('/api/tickets', {
    headers,
    multipart: {
      title, description: 'A non-emergency issue requiring barangay maintenance.',
      category: 'Infrastructure', location: 'Quirino Avenue, Barangay Baclaran',
      priority: 'Medium', ...overrides,
    },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test('demo data includes all fifteen Admin/Employee/User accounts and at least twenty completed tickets', async ({ request }) => {
  const headers = await authenticate(request);
  const users = await (await request.get('/api/users', { headers })).json();
  expect(users).toHaveLength(15);
  expect(users.filter((user) => user.role === 'admin')).toHaveLength(3);
  expect(users.filter((user) => user.role === 'employee')).toHaveLength(2);
  expect(users.filter((user) => user.role === 'user')).toHaveLength(10);
  const originalUsers = users.filter(user => !user.email.endsWith('@bmis.test'));
  expect(originalUsers).toHaveLength(10);
  expect(originalUsers.every((user) => user.firstName && user.lastName && user.email && user.address)).toBeTruthy();
  expect(users.every(user => user.firstName && user.lastName && user.email)).toBeTruthy();
  const tickets = await (await request.get('/api/tickets', { headers })).json();
  expect(tickets.filter((ticket) => ['Resolved', 'Dismissed'].includes(ticket.status)).length).toBeGreaterThanOrEqual(20);
});

test('profile saves contact details and leaves a blank password unchanged', async ({ page, request }) => {
  await login(page);
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Profile' }).click();
  await page.getByLabel('Phone').fill('09190001122');
  const save = page.waitForResponse((response) => response.url().endsWith('/api/auth/profile') && response.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  const response = await save;
  expect(response.ok()).toBeTruthy();
  expect(response.request().postDataJSON()).not.toHaveProperty('password');
  await expect(page.getByText('09190001122', { exact: true })).toBeVisible();
  const headers = await authenticate(request, RESIDENT);
  await request.put('/api/auth/profile', { headers, data: { phone: '09191234569' } });
});

test('resident dashboard shows its own totals and at most five recent tickets', async ({ page, request }) => {
  const headers = await authenticate(request, RESIDENT);
  const tickets = await (await request.get('/api/tickets/my-tickets', { headers })).json();
  await login(page);
  await expect(page.getByRole('heading', { name: 'Welcome, Ana!' })).toBeVisible();
  await expect(page.locator('.stat-card').filter({ hasText: 'Total Tickets' }).locator('.ant-statistic-content-value')).toHaveText(String(tickets.length));
  await expect(page.locator('.ticket-card')).toHaveCount(Math.min(5, tickets.length));
  await page.getByRole('button', { name: 'Report New Incident' }).click();
  await expect(page).toHaveURL(/\/user\/submit-ticket$/);
});

test('resident submits evidence and admin processes, archives and restores the ticket', async ({ page, request }) => {
  const title = 'Acceptance: damaged pavement near Baclaran market';
  await login(page);
  await page.goto('/resident/submit-ticket');
  await page.getByRole('button', { name: 'Submit Report' }).click();
  await expect(page.getByText('Please enter a title')).toBeVisible();
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill('Uneven paving stones outside the market need maintenance.');
  await page.getByRole('combobox', { name: 'Category', exact: true }).click();
  for (const category of categories) {
    await expect(page.locator('.ant-select-item-option-content').getByText(category, { exact: true })).toBeVisible();
  }
  await page.getByRole('option', { name: 'Infrastructure', exact: true }).click();
  await page.getByLabel('Location', { exact: true }).fill('Baclaran market, Quirino Avenue');
  await page.locator('input[type=file]').setInputFiles({ name: `bmis-acceptance-pavement-${process.pid}.png`, mimeType: 'image/png', buffer: png });
  const createdResponse = page.waitForResponse((response) => response.url().endsWith('/api/tickets') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Submit Report' }).click();
  const response = await createdResponse;
  expect(response.status()).toBe(201);
  const ticket = await response.json();
  uploadedFiles.add(path.join(uploadDirectory, path.basename(ticket.image)));
  expect(ticket.priority).toBe('Medium');
  expect(ticket.image).toMatch(/^\/uploads\//);
  await expect(page).toHaveURL(/\/user\/my-tickets$/);
  await page.getByText(title, { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start Processing' })).toHaveCount(0);
  await expect.poll(() => page.locator('.detail-image').evaluate((image) => image.complete && image.naturalWidth > 0)).toBeTruthy();
  await page.evaluate(() => localStorage.clear());
  await login(page, ADMIN);
  await page.goto(`/admin/ticket/${ticket._id}`);
  await page.getByRole('button', { name: 'Start Processing' }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start Processing' })).toBeVisible();
  await page.getByRole('button', { name: 'Start Processing' }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mark Resolved' })).toBeVisible();
  await page.getByRole('button', { name: 'Mark Resolved' }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('Ticket resolved and moved to Archive', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Archive Ticket', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Go to Archived Tickets', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/archive$/);
  const headers = await authenticate(request);
  expect((await (await request.get('/api/tickets', { headers })).json()).some((item) => item._id === ticket._id)).toBeFalsy();
  await page.goto('/admin/archive');
  const row = page.getByRole('row').filter({ hasText: title });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Resolved');
  await row.getByRole('button', { name: 'Restore', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(row).toHaveCount(0);
  const restored = await (await request.get(`/api/tickets/${ticket._id}`, { headers })).json();
  expect(restored.isArchived).toBe(false);
  expect(restored.status).toBe('Resolved');
  expect(restored.resolvedAt).toBeTruthy();
  expect(restored.archivedAt).toBeNull();
});

test('upload validation rejects unsupported files and photos over five MB', async ({ page }) => {
  await login(page);
  await page.goto('/resident/submit-ticket');
  await page.locator('input[type=file]').setInputFiles({ name: 'document.txt', mimeType: 'text/plain', buffer: Buffer.from('not a photo') });
  await expect(page.getByText('Only JPEG, PNG, and WebP photos are allowed')).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(page.getByText('Photo must be 5 MB or smaller')).toBeVisible();
  await expect(page.locator('.ant-upload-list-item')).toHaveCount(0);
});

test('ticket filters work and admin totals stay independent of search', async ({ page, request }) => {
  await login(page);
  await page.goto('/resident/my-tickets');
  await choose(page, 'Category filter', 'Sanitation');
  await choose(page, 'Status filter', 'Resolved');
  const rows = page.locator('.user-report-card');
  await expect(rows.first()).toBeVisible();
  for (const row of await rows.all()) {
    await expect(row).toContainText('Sanitation');
    await expect(row).toContainText('Resolved');
  }
  await page.getByPlaceholder('Search tickets').fill('no-matching-incident-xyz');
  await page.getByPlaceholder('Search tickets').press('Enter');
  await expect(page.locator('.ant-empty-description').getByText('No matching tickets', { exact: true })).toBeVisible();
  await page.evaluate(() => localStorage.clear());
  await login(page, ADMIN);
  const headers = await authenticate(request);
  const tickets = await (await request.get('/api/tickets', { headers })).json();
  const total = page.locator('.stat-card').filter({ hasText: 'Total Active Tickets' }).locator('.ant-statistic-content-value');
  await expect(total).toHaveText(String(tickets.length));
  await page.getByPlaceholder('Search tickets').fill('no-matching-incident-xyz');
  await page.getByPlaceholder('Search tickets').press('Enter');
  await expect(page.locator('.ant-empty-description').getByText('No data', { exact: true })).toBeVisible();
  await expect(total).toHaveText(String(tickets.length));
});

test('duplicate linking excludes self and persists a navigable reference', async ({ page, request }) => {
  const residentHeaders = await authenticate(request, RESIDENT);
  const primary = await createIncident(request, residentHeaders, 'Acceptance: original streetlight report');
  const duplicate = await createIncident(request, residentHeaders, 'Acceptance: duplicate streetlight report');
  await login(page, ADMIN);
  await page.goto(`/admin/ticket/${primary._id}`);
  const select = page.getByRole('combobox', { name: 'Link to Duplicate' });
  await select.click();
  await expect(page.getByRole('option', { name: `${primary.title} (Pending)`, exact: true })).toHaveCount(0);
  await select.fill(duplicate.title);
  await page.getByRole('option', { name: `${duplicate.title} (Pending)`, exact: true }).click();
  await select.press('Escape');
  const adminHeaders = await authenticate(request);
  const before = await (await request.get(`/api/tickets/${duplicate._id}`, { headers: adminHeaders })).json();
  expect(before.linkedTicket).toBeNull();
  await page.getByRole('button', { name: 'Link Selected', exact: true }).click();
  await expect(page.getByRole('link', { name: `• ${duplicate.title}`, exact: true })).toBeVisible();
  const persisted = await (await request.get(`/api/tickets/${duplicate._id}`, { headers: adminHeaders })).json();
  expect(persisted.linkedTicket._id).toBe(primary._id);
  await page.reload();
  await page.getByRole('link', { name: `• ${duplicate.title}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/ticket/${duplicate._id}$`));
  await page.reload();
  await expect(page.getByRole('link', { name: primary.title, exact: true })).toBeVisible();
  await page.getByRole('link', { name: primary.title, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/ticket/${primary._id}$`));
});

test('admin edits contact details separately from a confirmed role change', async ({ page, request }) => {
  const headers = await authenticate(request);
  const users = await (await request.get('/api/users?search=pedro.garcia', { headers })).json();
  const pedro = users[0];
  try {
  await login(page, ADMIN);
  await page.goto('/admin/users');
  await page.getByPlaceholder('Search users by name, email or phone').fill('pedro.garcia@email.com');
  await page.getByPlaceholder('Search users by name, email or phone').press('Enter');
  const row = page.getByRole('row').filter({ hasText: 'pedro.garcia@email.com' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Phone', { exact: true }).fill('09209998877');
  await expect(dialog.getByRole('combobox', { name: 'Role', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Save Changes' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toContainText('09209998877');
  await expect(row).toContainText('User');
  await row.getByRole('button', { name: 'Change Role', exact: true }).click();
  const confirm = page.getByRole('button', { name: 'Confirm Role Change', exact: true });
  await expect(confirm).toBeDisabled();
  await choose(page, 'New Role', 'Admin');
  await page.getByLabel('Confirm account email', { exact: true }).fill('wrong@example.com');
  await expect(confirm).toBeDisabled();
  await page.getByLabel('Confirm account email', { exact: true }).fill(pedro.email);
  await expect(confirm).toBeEnabled();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(row).toContainText('User');
  await row.getByRole('button', { name: 'Change Role', exact: true }).click();
  await expect(page.getByLabel('Confirm account email', { exact: true })).toHaveValue('');
  await choose(page, 'New Role', 'Admin');
  await page.getByLabel('Confirm account email', { exact: true }).fill(pedro.email);
  await confirm.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(row).toContainText('Admin');
  await page.reload();
  await page.getByPlaceholder('Search users by name, email or phone').fill(pedro.email);
  await page.getByPlaceholder('Search users by name, email or phone').press('Enter');
  await expect(row).toContainText('Admin');
  await expect(row).toContainText('09209998877');
  } finally {
    expect((await request.patch(`/api/users/${pedro._id}/role`, { headers, data: { role: 'resident', confirmationEmail: pedro.email } })).status()).toBe(200);
    expect((await request.put(`/api/users/${pedro._id}`, { headers, data: { phone: '09201234570' } })).status()).toBe(200);
  }
});

test('role routes and ticket ownership are enforced and missing tickets are handled', async ({ page, request }) => {
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/login$/);
  await login(page);
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/user\/dashboard$/);
  const adminHeaders = await authenticate(request);
  const residentHeaders = await authenticate(request, RESIDENT);
  expect((await request.get('/api/users', { headers: residentHeaders })).status()).toBe(403);
  expect((await request.put('/api/archive/000000000000000000000000/archive', { headers: residentHeaders })).status()).toBe(403);
  const all = await (await request.get('/api/tickets', { headers: adminHeaders })).json();
  const other = all.find((ticket) => ticket.submittedBy.email !== RESIDENT);
  expect((await request.get(`/api/tickets/${other._id}`, { headers: residentHeaders })).status()).toBe(403);
  await page.goto(`/resident/ticket/${other._id}`);
  await expect(page.getByText('Not authorized to view this ticket')).toBeVisible();
  await page.goto('/resident/ticket/000000000000000000000000');
  await expect(page.getByText('Ticket not found', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to tickets' })).toBeVisible();
});

test('password recovery resets once and invalidates the old password', async ({ page, request }) => {
  await page.goto('/forgot-password');
  await page.getByPlaceholder('Phone Number or Email', { exact: true }).fill('rosa.martinez@email.com');
  const resetResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/forgot-password'));
  await page.getByRole('button', { name: 'Send Reset Link' }).click();
  const { resetToken } = await (await resetResponse).json();
  await expect(page.getByText('Reset Link Generated', { exact: true })).toBeVisible();
  await page.goto(`/reset-password/${resetToken}`);
  await page.getByPlaceholder('New Password', { exact: true }).fill('Temporary123!');
  await page.getByPlaceholder('Confirm New Password', { exact: true }).fill('Temporary123!');
  await page.getByRole('button', { name: 'Reset Password', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await request.post('/api/auth/login', { data: { email: 'rosa.martinez@email.com', password: PASSWORD } })).status()).toBe(401);
  expect((await request.post(`/api/auth/reset-password/${resetToken}`, { data: { password: PASSWORD } })).status()).toBe(400);
  const headers = await authenticate(request, 'rosa.martinez@email.com', 'Temporary123!');
  await request.put('/api/auth/profile', { headers, data: { password: PASSWORD } });
});

test('changed roles take effect on existing sessions immediately', async ({ request }) => {
  const adminHeaders = await authenticate(request);
  const pedroHeaders = await authenticate(request, 'pedro.garcia@email.com');
  const users = await (await request.get('/api/users?search=pedro.garcia', { headers: adminHeaders })).json();
  const pedro = users[0];
  try {
    expect((await request.patch(`/api/users/${pedro._id}/role`, { headers: adminHeaders, data: { role: 'admin', confirmationEmail: pedro.email } })).status()).toBe(200);
    expect((await request.get('/api/users', { headers: pedroHeaders })).status()).toBe(200);
    const elevatedHeaders = await authenticate(request, 'pedro.garcia@email.com');
    expect((await request.patch(`/api/users/${pedro._id}/role`, { headers: adminHeaders, data: { role: 'resident', confirmationEmail: pedro.email } })).status()).toBe(200);
    expect((await request.get('/api/users', { headers: elevatedHeaders })).status()).toBe(403);
  } finally {
    expect((await request.patch(`/api/users/${pedro._id}/role`, { headers: adminHeaders, data: { role: 'resident', confirmationEmail: pedro.email } })).status()).toBe(200);
  }
});

test('linked duplicates do not reveal another resident\'s report contents', async ({ request }) => {
  const adminHeaders = await authenticate(request);
  const anaHeaders = await authenticate(request, RESIDENT);
  const pedroHeaders = await authenticate(request, 'pedro.garcia@email.com');
  const own = await createIncident(request, anaHeaders, 'Acceptance: resident-owned duplicate');
  const other = await createIncident(request, pedroHeaders, 'Acceptance: separate resident private title', { description: 'Private report details from another resident.' });
  await request.put(`/api/tickets/${own._id}/link`, { headers: adminHeaders, data: { linkedTicketId: other._id } });
  const detail = await (await request.get(`/api/tickets/${own._id}`, { headers: anaHeaders })).json();
  expect(detail.linkedTicket._id).toBe(other._id);
  expect(detail.linkedTicket).not.toHaveProperty('description');
  expect(detail.linkedTicket).not.toHaveProperty('image');
  expect(detail.linkedTicket).not.toHaveProperty('submittedBy');
  expect(detail.linkedTicket).not.toHaveProperty('title');
  expect((await request.get(`/api/tickets/${other._id}`, { headers: anaHeaders })).status()).toBe(403);
});

test('dismissed tickets archive and restore with timestamps and status intact', async ({ request }) => {
  const headers = await authenticate(request);
  const residentHeaders = await authenticate(request, RESIDENT);
  const ticket = await createIncident(request, residentHeaders, 'Acceptance: resolved duplicate complaint');
  expect((await request.put(`/api/archive/${ticket._id}/archive`, { headers })).status()).toBe(400);
  expect((await request.put(`/api/tickets/${ticket._id}/link`, { headers, data: { linkedTicketId: ticket._id } })).status()).toBe(400);
  const dismissedResponse = await request.put(`/api/tickets/${ticket._id}/status`, { headers, data: { status: 'Dismissed' } });
  expect(dismissedResponse.ok()).toBeTruthy();
  const dismissed = await dismissedResponse.json();
  expect(dismissed.dismissedAt).toBeTruthy();
  expect(dismissed.resolvedAt).toBeNull();
  expect((await request.put(`/api/archive/${ticket._id}/archive`, { headers })).ok()).toBeTruthy();
  const archived = await (await request.get('/api/archive?category=Infrastructure&search=resolved%20duplicate', { headers })).json();
  expect(archived.some((item) => item._id === ticket._id)).toBeTruthy();
  const restored = await (await request.put(`/api/archive/${ticket._id}/restore`, { headers })).json();
  expect(restored.status).toBe('Dismissed');
  expect(restored.dismissedAt).toBe(dismissed.dismissedAt);
  expect(restored.isArchived).toBe(false);
});

test('registration creates a User and logout removes access', async ({ page }) => {
  await page.goto('/register');
  await page.getByPlaceholder('First Name', { exact: true }).fill('Luz');
  await page.getByPlaceholder('Last Name', { exact: true }).fill('Mendoza');
  await page.getByPlaceholder('Email Address', { exact: true }).fill('luz.acceptance@example.com');
  await page.getByPlaceholder('Phone Number', { exact: true }).fill(testPhone());
  await page.getByPlaceholder('Password', { exact: true }).fill(PASSWORD);
  await page.getByPlaceholder('Confirm Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/user\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Welcome, Luz!' })).toBeVisible();
  await expect(page.getByText('No tickets yet')).toBeVisible();
  await page.locator('.header-right').click();
  await page.getByText('Logout', { exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/resident/my-tickets');
  await expect(page).toHaveURL(/\/login$/);
});
