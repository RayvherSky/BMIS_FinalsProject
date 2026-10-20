import { test, expect } from '@playwright/test';

const owner = { _id: '000000000000000000000001', firstName: 'Ana', lastName: 'Reyes', role: 'user',
  email: 'ana@example.test', phone: '09171234567', address: 'Baclaran market' };
const ticket = { _id: '000000000000000000000010', title: 'Drainage concern', description: 'Inspect the entrance.',
  category: 'Infrastructure', status: 'In Progress', priority: 'Medium', location: 'Baclaran', submittedBy: owner,
  notes: [], requests: [], isArchived: false, createdAt: '2026-10-19T00:00:00Z' };
async function session(page, role = 'admin') {
  await page.route('**/api/tickets/reviews*', route => route.fulfill({ json: { items: [], total: 0, counts: { pending: 0, reviewed: 0 } } }));
  await page.addInitScript(() => localStorage.setItem('token', 'review-contact-contract'));
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ...owner, role } }));
}

test('REVIEW dashboard statistics, filters and directory exclude archived reports', async ({ page }) => {
  await session(page);
  const archived = { ...ticket, _id: 'archived-report', title: 'Archived secret report', status: 'Resolved', isArchived: true };
  let archiveReads = 0;
  await page.route(url => url.pathname === '/api/archive', route => { archiveReads++; return route.fulfill({ json: [archived] }); });
  await page.route(url => url.pathname === '/api/tickets', route => {
    const status = new URL(route.request().url()).searchParams.get('status');
    return route.fulfill({ json: [ticket, archived].filter(row => !status || row.status === status) });
  });
  await page.goto('/admin/dashboard');
  await expect(page.getByRole('button', { name: 'Show Archived Tickets', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Ticket scope', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show Total Active Tickets', exact: true }).locator('.ant-statistic-content-value')).toHaveText('1');
  await expect(page.getByRole('button', { name: 'Show Resolved', exact: true }).locator('.ant-statistic-content-value')).toHaveText('0');
  await expect(page.getByText(archived.title, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Show Resolved', exact: true }).click();
  await expect(page.getByText(archived.title, { exact: true })).toHaveCount(0);
  expect(archiveReads).toBe(0);
});

test('REVIEW duplicate linking offers eligible reports across categories', async ({ page }) => {
  await session(page);
  await page.route(`**/api/tickets/${ticket._id}`, route => route.fulfill({ json: ticket }));
  await page.route(url => url.pathname === '/api/tickets', route => route.fulfill({ json: [ticket,
    { ...ticket, _id: 'different-category', title: 'Sanitation report', category: 'Sanitation', status: 'Pending' },
    { ...ticket, _id: 'archived', title: 'Archived sanitation', category: 'Sanitation', isArchived: true },
  ] }));
  await page.goto(`/admin/ticket/${ticket._id}`);
  const input = page.getByRole('combobox', { name: 'Link to Duplicate', exact: true });
  await input.focus(); await input.press('ArrowDown');
  await expect(page.getByRole('option', { name: 'Sanitation report (Pending)', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Archived sanitation (In Progress)', exact: true })).toHaveCount(0);
});

test('REVIEW assigned Employee ticket details show the reporting User contact details', async ({ page }) => {
  await session(page, 'employee');
  await page.route(`**/api/tickets/${ticket._id}`, route => route.fulfill({ json: ticket }));
  await page.goto(`/employee/ticket/${ticket._id}`);
  await expect(page.getByText(owner.phone, { exact: true })).toBeVisible();
  await expect(page.getByText(owner.address, { exact: true })).toBeVisible();
  await expect(page.getByText(owner.email, { exact: true })).toBeVisible();
  await expect(page.locator('.ant-descriptions-item-label').first()).toHaveText('Reported By');
  await expect(page.locator('.ant-descriptions-item-content').first()).toHaveText('Ana Reyes');
});

test('REVIEW submission requires contact and sends the editable prefilled number', async ({ page }) => {
  await session(page, 'user');
  let received;
  await page.route(url => url.pathname === '/api/tickets', async route => {
    received = route.request().postData();
    await route.fulfill({ status: 201, json: ticket });
  });
  await page.route('**/api/tickets/my-tickets**', route => route.fulfill({ json: [] }));
  await page.goto('/user/submit-ticket');
  await page.getByLabel('Title', { exact: true }).fill('Contact test');
  await page.getByLabel('Description', { exact: true }).fill('Inspect the market');
  await page.getByRole('combobox', { name: 'Category', exact: true }).click();
  await page.getByRole('option', { name: 'Infrastructure', exact: true }).click();
  await page.getByLabel('Location', { exact: true }).fill('Baclaran');
  const phone = page.getByLabel('Contact Number', { exact: true });
  await expect(phone).toHaveValue(owner.phone);
  await phone.fill('');
  await page.getByRole('button', { name: 'Submit Report', exact: true }).click();
  await expect(page.getByText('Please enter a contact number', { exact: true })).toBeVisible();
  expect(received).toBeUndefined();
  await phone.fill('+63 917-765-4321');
  await page.getByRole('button', { name: 'Submit Report', exact: true }).click();
  await expect(page).toHaveURL(/\/user\/my-tickets$/);
  expect(received).toContain('name="contactNumber"');
  expect(received).toContain('+63 917-765-4321');
});
