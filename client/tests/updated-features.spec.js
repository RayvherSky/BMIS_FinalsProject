import { test, expect } from '@playwright/test';

// Regression coverage for the October updates and their audit repairs.
// Historical failures are recorded in docs/system-audit-2026-10-18.md.
const PASSWORD = 'Password123!';
const ADMIN = 'maria.santos@email.com';
const RESIDENT = 'ana.reyes@email.com';
const OTHER_RESIDENT = 'pedro.garcia@email.com';

async function session(request, email = ADMIN) {
  const response = await request.post('/api/auth/login', { data: { email, password: PASSWORD } });
  expect(response.status()).toBe(200);
  const data = await response.json();
  return { ...data, headers: { Authorization: `Bearer ${data.token}` } };
}

async function incident(request, owner, title, fields = {}) {
  const response = await request.post('/api/tickets', {
    headers: owner.headers,
    data: { title, description: 'Maintenance requested near Baclaran market.', category: 'Infrastructure', location: 'Quirino Avenue', ...fields },
  });
  expect(response.status()).toBe(201);
  return response.json();
}

async function openAs(page, account, path) {
  await page.addInitScript((token) => localStorage.setItem('token', token), account.token);
  await page.goto(path);
}

async function choose(page, select, label) {
  await select.focus();
  await select.press('ArrowDown');
  // Ant Design's virtualized priority menu exposes only neighboring options
  // to accessibility queries; select the actual visible option instead.
  await page.locator('.ant-select-dropdown:visible').getByText(label, { exact: true }).click();
  if (await select.getAttribute('aria-expanded') === 'true') await select.press('Escape');
}

async function note(request, account, ticket, text, isPrivate = false) {
  const response = await request.post(`/api/tickets/${ticket._id}/notes`, { headers: account.headers, data: { text, isPrivate } });
  expect(response.status()).toBe(200);
  return response.json();
}

test('UPD-01 batch linking persists two children and unlink preserves the other relationship', async ({ page, request }) => {
  const admin = await session(request);
  const owner = await session(request, RESIDENT);
  const master = await incident(request, owner, 'Audit master pavement report');
  const childA = await incident(request, owner, 'Audit duplicate pavement A');
  const childB = await incident(request, owner, 'Audit duplicate pavement B');
  await openAs(page, admin, `/admin/ticket/${master._id}`);
  const select = page.getByRole('combobox', { name: 'Link to Duplicate', exact: true });
  await expect(page.getByRole('button', { name: 'Link Selected', exact: true })).toBeDisabled();
  await choose(page, select, `${childA.title} (Pending)`);
  await choose(page, select, `${childB.title} (Pending)`);
  const before = await (await request.get(`/api/tickets/${childA._id}`, { headers: admin.headers })).json();
  expect(before.linkedTicket).toBeNull();
  await page.getByRole('button', { name: 'Link Selected', exact: true }).click();
  for (const child of [childA, childB]) {
    await expect(page.getByRole('link', { name: `• ${child.title}`, exact: true })).toBeVisible();
    const persisted = await (await request.get(`/api/tickets/${child._id}`, { headers: admin.headers })).json();
    expect(persisted.linkedTicket._id).toBe(master._id);
  }
  await page.getByRole('link', { name: `• ${childA.title}`, exact: true }).locator('..').getByRole('button', { name: 'Unlink', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Unlink', exact: true }).click();
  await expect(page.getByRole('link', { name: `• ${childA.title}`, exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: `• ${childB.title}`, exact: true })).toBeVisible();
  const unlinked = await (await request.get(`/api/tickets/${childA._id}`, { headers: admin.headers })).json();
  expect(unlinked.linkedTicket).toBeNull();
});

test('UPD-02 priority changes require confirmation and persist after reload', async ({ page, request }) => {
  const admin = await session(request);
  const owner = await session(request, RESIDENT);
  const ticket = await incident(request, owner, 'Audit priority confirmation');
  await openAs(page, admin, `/admin/ticket/${ticket._id}`);
  const priority = page.locator('.detail-card').getByRole('combobox').first();
  await choose(page, priority, 'Urgent');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  let saved = await (await request.get(`/api/tickets/${ticket._id}`, { headers: admin.headers })).json();
  expect(saved.priority).toBe('Medium');
  await choose(page, priority, 'Urgent');
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByText('Ticket priority changed to Urgent', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.detail-card').getByText('Urgent', { exact: true })).toBeVisible();
  saved = await (await request.get(`/api/tickets/${ticket._id}`, { headers: admin.headers })).json();
  expect(saved.priority).toBe('Urgent');
});

test('UPD-03 priority API rejects invalid levels and resident writes', async ({ request }) => {
  const admin = await session(request);
  const owner = await session(request, RESIDENT);
  const ticket = await incident(request, owner, 'Audit priority authorization');
  expect((await request.patch(`/api/tickets/${ticket._id}/priority`, { headers: admin.headers, data: { priority: 'Extreme' } })).status()).toBe(400);
  expect((await request.patch(`/api/tickets/${ticket._id}/priority`, { headers: owner.headers, data: { priority: 'Urgent' } })).status()).toBe(403);
  const saved = await (await request.get(`/api/tickets/${ticket._id}`, { headers: admin.headers })).json();
  expect(saved.priority).toBe('Medium');
});

test('UPD-04 Others form requires a description and saves the custom category', async ({ page, request }) => {
  const owner = await session(request, RESIDENT);
  await openAs(page, owner, '/resident/submit-ticket');
  await page.getByLabel('Title', { exact: true }).fill('Audit animal welfare concern');
  await page.getByLabel('Description', { exact: true }).fill('A stray animal needs non-emergency assistance.');
  await page.getByLabel('Location', { exact: true }).fill('Baclaran market entrance');
  const category = page.getByRole('combobox', { name: 'Category', exact: true });
  await category.focus();
  await category.press('ArrowDown');
  await expect(page.getByRole('option').filter({ hasText: /^Others/ })).toHaveCount(1);
  await category.press('Escape');
  await choose(page, page.getByRole('combobox', { name: 'Category', exact: true }), 'Others (Please specify)');
  await page.getByRole('button', { name: 'Submit Report', exact: true }).click();
  await expect(page.getByText('Please specify your custom category', { exact: true })).toBeVisible();
  await page.getByLabel('Specify Category', { exact: true }).fill('Animal welfare');
  const created = page.waitForResponse(response => response.url().endsWith('/api/tickets') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Submit Report', exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const ticket = await response.json();
  expect(ticket).toMatchObject({ category: 'Others', customCategory: 'Animal welfare' });
  await expect(page).toHaveURL(/\/user\/my-tickets$/);
  const saved = await (await request.get(`/api/tickets/${ticket._id}`, { headers: owner.headers })).json();
  expect(saved.customCategory).toBe('Animal welfare');
});

test('UPD-05 public updates appear in the resident timeline and survive reload', async ({ page, request }) => {
  const owner = await session(request, RESIDENT);
  const ticket = await incident(request, owner, 'Audit public note timeline');
  await openAs(page, owner, `/resident/ticket/${ticket._id}`);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await page.getByPlaceholder('Add a new update or note to this ticket...').fill('The maintenance team has inspected the pavement.');
  await page.getByRole('button', { name: 'Post Update', exact: true }).click();
  await expect(page.getByText('The maintenance team has inspected the pavement.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('The maintenance team has inspected the pavement.', { exact: true })).toBeVisible();
});

test('UPD-06 detail GET hides internal notes and other residents cannot post', async ({ request }) => {
  const admin = await session(request);
  const owner = await session(request, RESIDENT);
  const other = await session(request, OTHER_RESIDENT);
  const ticket = await incident(request, owner, 'Audit note visibility on detail GET');
  await note(request, admin, ticket, 'Internal staffing detail', true);
  await note(request, admin, ticket, 'Maintenance is scheduled');
  const residentView = await (await request.get(`/api/tickets/${ticket._id}`, { headers: owner.headers })).json();
  expect(residentView.notes.map(item => item.text)).toEqual(['Maintenance is scheduled']);
  const adminView = await (await request.get(`/api/tickets/${ticket._id}`, { headers: admin.headers })).json();
  expect(adminView.notes).toHaveLength(2);
  expect((await request.post(`/api/tickets/${ticket._id}/notes`, { headers: other.headers, data: { text: 'Unauthorized update' } })).status()).toBe(403);
});

test('UPD-07 a resident cannot create a private internal note', async ({ request }) => {
  const owner = await session(request, RESIDENT);
  const ticket = await incident(request, owner, 'Audit resident private flag');
  const updated = await note(request, owner, ticket, 'Resident update', true);
  expect(updated.notes).toHaveLength(1);
  expect(updated.notes[0].isPrivate).toBe(false);
});

test('AUD-01 resident list responses must exclude internal note contents', async ({ request }) => {
  const admin = await session(request);
  const owner = await session(request, RESIDENT);
  const ticket = await incident(request, owner, 'Audit internal note list privacy');
  await note(request, admin, ticket, 'Confidential internal assignment', true);
  const list = await (await request.get('/api/tickets/my-tickets', { headers: owner.headers })).json();
  expect(list.find(item => item._id === ticket._id).notes).toEqual([]);
});

test('AUD-01 posting a resident update must not return existing internal notes', async ({ request }) => {
  const admin = await session(request);
  const owner = await session(request, RESIDENT);
  const ticket = await incident(request, owner, 'Audit internal note POST privacy');
  await note(request, admin, ticket, 'Confidential internal assignment', true);
  const updated = await note(request, owner, ticket, 'Please provide a progress update');
  expect(updated.notes.map(item => item.text)).toEqual(['Please provide a progress update']);
});

test('AUD-02 note responses must not expose another residents linked report', async ({ request }) => {
  const admin = await session(request);
  const owner = await session(request, RESIDENT);
  const other = await session(request, OTHER_RESIDENT);
  const own = await incident(request, owner, 'Audit own linked report');
  const foreign = await incident(request, other, 'Audit foreign confidential report', { description: 'Private description for another resident.' });
  expect((await request.put(`/api/tickets/${own._id}/link`, { headers: admin.headers, data: { linkedTicketId: foreign._id } })).status()).toBe(200);
  const updated = await note(request, owner, own, 'Any progress on my report?');
  expect(updated.linkedTicket).toEqual({ _id: foreign._id });
});

test('AUD-03 search treats regex characters as literal text across all searchable APIs', async ({ request }) => {
  const admin = await session(request);
  const owner = await session(request, RESIDENT);
  for (const [path, headers] of [
    ['/api/tickets', admin.headers], ['/api/tickets/my-tickets', owner.headers],
    ['/api/archive', admin.headers], ['/api/users', admin.headers],
  ]) {
    for (const search of ['[', '(', '.*', '+', '\\']) {
      const response = await request.get(path, { headers, params: { search } });
      expect.soft(response.status(), `${path} must accept literal ${search}`).toBe(200);
    }
    const invalid = await request.get(`${path}?search=one&search=two`, { headers });
    expect.soft(invalid.status(), `${path} must reject a non-text search`).toBe(400);
  }
});

test('AUD-04 Others requires a nonblank custom category at the API boundary', async ({ request }) => {
  const owner = await session(request, RESIDENT);
  for (const customCategory of [undefined, '', '   ', null, 123, {}, ['Animal welfare']]) {
    const response = await request.post('/api/tickets', {
      headers: owner.headers,
      data: { title: 'Audit missing custom category', description: 'Non-emergency maintenance request.', category: 'Others', customCategory, location: 'Baclaran market' },
    });
    expect.soft(response.status(), `customCategory=${JSON.stringify(customCategory)} must be rejected`).toBe(400);
  }
  const valid = await incident(request, owner, 'Audit trimmed custom category', { category: 'Others', customCategory: '  Animal welfare  ' });
  expect(valid.customCategory).toBe('Animal welfare');
  const standard = await incident(request, owner, 'Audit stale custom category', { customCategory: 'Stale label' });
  expect(standard.customCategory).toBe('');
});

test('AUD-05 Others reports must be selectable in category filters for both roles', async ({ page, request }) => {
  const admin = await session(request);
  const owner = await session(request, RESIDENT);
  const active = await incident(request, owner, 'Audit filter Others active', { category: 'Others', customCategory: 'Animal welfare' });
  const regular = await incident(request, owner, 'Audit filter standard active');
  const archived = await incident(request, owner, 'Audit filter Others archived', { category: 'Others', customCategory: 'Animal welfare' });
  const regularArchive = await incident(request, owner, 'Audit filter standard archived');
  for (const ticket of [archived, regularArchive]) {
    const completed = await request.put(`/api/tickets/${ticket._id}/status`, { headers: admin.headers, data: { status: 'Resolved' } });
    expect(completed.status()).toBe(200);
    expect((await completed.json()).isArchived).toBe(true);
  }
  for (const [email, paths] of [[ADMIN, ['/admin/dashboard', '/admin/archive']], [RESIDENT, ['/resident/my-tickets']]]) {
    const account = email === ADMIN ? admin : owner;
    await page.goto('/login');
    await page.evaluate(token => localStorage.setItem('token', token), account.token);
    for (const path of paths) {
      await page.goto(path);
      const select = page.getByRole('combobox', { name: 'Category filter', exact: true });
      await select.focus();
      await select.press('ArrowDown');
      await expect(page.getByRole('option', { name: 'Others', exact: true })).toHaveCount(1);
      const apiPath = path === '/admin/archive' ? '/api/archive' : path === '/resident/my-tickets' ? '/api/tickets/my-tickets' : '/api/tickets';
      const filtered = page.waitForResponse(response => {
        const url = new URL(response.url());
        return url.pathname === apiPath && url.searchParams.get('category') === 'Others';
      });
      await page.getByRole('option', { name: 'Others', exact: true }).click();
      const response = await filtered;
      expect(response.status()).toBe(200);
      const reports = await response.json();
      expect(reports.every(ticket => ticket.category === 'Others')).toBe(true);
      const wanted = path === '/admin/archive' ? archived : active;
      expect(reports.some(ticket => ticket._id === wanted._id)).toBe(true);
      await expect(page.getByText(wanted.title, { exact: true })).toBeVisible();
      await expect(page.getByText(regular.title, { exact: true })).toHaveCount(0);
      await expect(page.getByText(regularArchive.title, { exact: true })).toHaveCount(0);
    }
  }
});

test('UPD-08 dashboard charts show known counts and stay global when directory search changes', async ({ page, request }) => {
  const admin = await session(request);
  await page.route(url => url.pathname === '/api/archive', route => route.fulfill({ json: [] }));
  await page.route('**/api/tickets*', route => route.fulfill({ json: new URL(route.request().url()).searchParams.get('search') ? [] : [
    { _id: 'chart-a', title: 'Uncollected waste', category: 'Sanitation', status: 'Pending', priority: 'Medium' },
    { _id: 'chart-b', title: 'Broken footpath', category: 'Infrastructure', status: 'Resolved', priority: 'High' },
    { _id: 'chart-c', title: 'Blocked drainage', category: 'Infrastructure', status: 'Resolved', priority: 'Medium' },
    { _id: 'chart-d', title: 'Animal welfare', category: 'Others', customCategory: 'Animal welfare', status: 'Dismissed', priority: 'Low' },
  ] }));
  await openAs(page, admin, '/admin/dashboard');
  const pie = page.locator('.ant-card').filter({ hasText: 'Status Distribution' });
  await expect(pie).toContainText('Pending: 1 (25%)');
  await expect(pie).toContainText('Resolved: 2 (50%)');
  await expect(pie).toContainText('Dismissed: 1 (25%)');
  await expect(page.getByTitle('Infrastructure: 2 tickets', { exact: true })).toBeVisible();
  await expect(page.getByTitle('Others (Animal welfare): 1 tickets', { exact: true })).toBeVisible();
  await page.getByPlaceholder('Search tickets').fill('no-match');
  await page.getByPlaceholder('Search tickets').press('Enter');
  await expect(page.locator('.ant-empty-description')).toContainText('No data');
  await expect(pie).toContainText('Resolved: 2 (50%)');
});

test('UPD-09 empty analytics data shows zero totals without invalid charts', async ({ page, request }) => {
  const admin = await session(request);
  await page.route(url => url.pathname === '/api/archive', route => route.fulfill({ json: [] }));
  await page.route('**/api/tickets*', route => route.fulfill({ json: [] }));
  await openAs(page, admin, '/admin/dashboard');
  await expect(page.locator('.ant-statistic-content-value')).toHaveText(['0', '0', '0', '0', '0', '0']);
  await expect(page.getByText('System Analytics', { exact: true })).toHaveCount(0);
  await expect(page.locator('.ant-empty-description')).toContainText('No data');
});

test('AUD-06 invalid optional phone numbers must be rejected during registration', async ({ request }) => {
  for (const [index, phone] of ['not-a-phone-number', '08171234567', '0917123456', '091712345678', '639171234567', null, 9171234567].entries()) {
    const response = await request.post('/api/auth/register', { data: {
      firstName: 'Audit', lastName: 'Phone', email: `audit-invalid-phone-${Date.now()}-${index}@example.com`,
      password: PASSWORD, phone,
    } });
    expect(response.status()).toBe(400);
    expect((await response.json()).message).toMatch(/mobile|phone/i);
  }
});

test('AUD-06 registration accepts blank values and agreed mobile formats', async ({ request }) => {
  for (const [index, phone] of [undefined, '', '   ', '09171234567', '+639171234567', '0917 123 4567', '+63 917-123-4567'].entries()) {
    const response = await request.post('/api/auth/register', { data: {
      firstName: 'Audit', lastName: 'Mobile', email: `audit-valid-phone-${Date.now()}-${index}@example.com`,
      password: PASSWORD, phone,
    } });
    expect(response.status()).toBe(201);
    expect((await response.json()).user.phone).toBe(phone || '');
  }
});

test('AUD-06 profile and admin writes validate phone before modifying contact data', async ({ request }) => {
  const admin = await session(request);
  const created = await request.post('/api/auth/register', { data: {
    firstName: 'Audit', lastName: 'Contact', email: `audit-contact-${Date.now()}@example.com`, password: PASSWORD, phone: '09171234567', address: 'Original address',
  } });
  expect(created.status()).toBe(201);
  const account = await created.json();
  const headers = { Authorization: `Bearer ${account.token}` };
  for (const [path, auth] of [['/api/auth/profile', headers], [`/api/users/${account.user._id}`, admin.headers]]) {
    const invalid = await request.put(path, { headers: auth, data: { phone: 'invalid-contact', address: 'Unwanted change' } });
    expect(invalid.status()).toBe(400);
    const saved = await (await request.get('/api/auth/me', { headers })).json();
    expect(saved).toMatchObject({ phone: '09171234567', address: 'Original address' });
    for (const phone of ['+63 917-123-4567', '', '09171234567']) {
      const accepted = await request.put(path, { headers: auth, data: { phone } });
      expect(accepted.status()).toBe(200);
      const current = await (await request.get('/api/auth/me', { headers })).json();
      expect(current.phone).toBe(phone);
    }
  }
});

test('AUD-06 registration form blocks an invalid phone and accepts the corrected format', async ({ page }) => {
  await page.goto('/register');
  await page.getByPlaceholder('First Name', { exact: true }).fill('Audit');
  await page.getByPlaceholder('Last Name', { exact: true }).fill('Mobile');
  await page.getByPlaceholder('Email Address', { exact: true }).fill(`audit-form-phone-${Date.now()}@example.com`);
  await page.getByPlaceholder('Password', { exact: true }).fill(PASSWORD);
  await page.getByPlaceholder('Confirm Password', { exact: true }).fill(PASSWORD);
  const phone = page.getByPlaceholder('Phone Number (optional)', { exact: true });
  await phone.fill('not-a-phone-number');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.locator('.ant-form-item-explain-error')).toContainText('09XXXXXXXXX or +639XXXXXXXXX');
  await expect(page).toHaveURL(/\/register$/);
  await phone.fill('+63 917-123-4567');
  const registered = page.waitForResponse(response => response.url().endsWith('/api/auth/register') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  expect((await registered).status()).toBe(201);
  await expect(page).toHaveURL(/\/user\/dashboard$/);
});

test('UPD-10 new analytics and note controls fit a narrow admin viewport', async ({ page, request }) => {
  const admin = await session(request);
  const owner = await session(request, RESIDENT);
  const ticket = await incident(request, owner, 'Audit mobile note controls');
  await note(request, admin, ticket, 'Maintenance team will inspect this location.');
  await page.setViewportSize({ width: 375, height: 812 });
  await openAs(page, admin, '/admin/dashboard');
  await expect(page.getByText('System Analytics', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.goto(`/admin/ticket/${ticket._id}`);
  await expect(page.getByText('Maintenance team will inspect this location.', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('AUD-08 both roles can read long ticket details at 320px, 375px, and desktop', async ({ page, request }) => {
  const admin = await session(request);
  const owner = await session(request, RESIDENT);
  const title = `Audit long report ${'x'.repeat(80)}`;
  const text = `Inspection details ${'y'.repeat(120)}`;
  const ticket = await incident(request, owner, title, { description: text, location: `Market ${'z'.repeat(80)}` });
  await note(request, admin, ticket, text);
  for (const [account, role] of [[admin, 'admin'], [owner, 'resident']]) {
    await page.goto('/login');
    await page.evaluate(token => localStorage.setItem('token', token), account.token);
    for (const width of [320, 375, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/${role}/ticket/${ticket._id}`);
      await expect(page.locator('.detail-card').getByText(title, { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Post Update', exact: true })).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const card = page.locator('.detail-card');
      const bounds = await card.boundingBox();
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      if (role === 'admin') {
        const priority = card.getByRole('combobox').first();
        await expect(priority).toBeVisible();
        await expect(page.getByRole('checkbox')).toBeVisible();
        const linkButton = page.getByRole('button', { name: 'Link Selected', exact: true });
        const control = await linkButton.boundingBox();
        expect(control.x + control.width).toBeLessThanOrEqual(width);
      }
    }
  }
});

for (const action of ['link', 'unlink']) {
for (const delayedFetch of ['ticket', 'candidates']) {
test(`AUD-07 a late ${action} ${delayedFetch} refresh cannot overwrite the newly opened ticket`, async ({ page }) => {
  const admin = { _id: 'audit-admin', firstName: 'Audit', lastName: 'Admin', role: 'admin', email: ADMIN };
  const common = { description: 'Second report must remain visible', category: 'Sanitation', status: 'Pending', priority: 'Medium', location: 'Baclaran', submittedBy: admin };
  const b = { ...common, _id: 'audit-b', title: 'Audit Ticket B' };
  const a = { ...common, _id: 'audit-a', title: 'Audit Ticket A', linkedTicket: b };
  const c = { ...common, _id: 'audit-c', title: 'Audit Ticket C', linkedTicket: action === 'unlink' ? a._id : null };
  const d = { ...common, _id: 'audit-d', title: 'Audit Ticket D', linkedTicket: null };
  await page.addInitScript(() => localStorage.setItem('token', 'audit-controlled-token'));
  await page.route('**/api/auth/me', route => route.fulfill({ json: admin }));
  await page.route('**/api/tickets/audit-b', route => route.fulfill({ json: b }));
  let mutated = false;
  let held = false;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let notifyRefresh;
  const refreshStarted = new Promise(resolve => { notifyRefresh = resolve; });
  const holdRefresh = async (kind) => {
    if (mutated && !held && delayedFetch === kind) {
      held = true;
      notifyRefresh();
      await gate;
    }
  };
  await page.route('**/api/tickets', async route => {
    await holdRefresh('candidates');
    const child = mutated ? { ...c, linkedTicket: action === 'link' ? a._id : null } : c;
    await route.fulfill({ json: [a, b, child, d] });
  });
  await page.route(`**/api/tickets/audit-c/${action}`, route => {
    mutated = true;
    return route.fulfill({ json: { ...c, linkedTicket: action === 'link' ? a : null } });
  });
  await page.route('**/api/tickets/audit-a', async route => {
    await holdRefresh('ticket');
    await route.fulfill({ json: a });
  });
  try {
    await page.goto('/admin/ticket/audit-a');
    if (action === 'link') {
      await choose(page, page.getByRole('combobox', { name: 'Link to Duplicate' }), 'Audit Ticket C (Pending)');
      await page.getByRole('button', { name: 'Link Selected', exact: true }).click();
    } else {
      await page.getByRole('link', { name: '• Audit Ticket C', exact: true }).locator('..').getByRole('button', { name: 'Unlink', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Unlink', exact: true }).click();
    }
    await refreshStarted;
    if (action === 'unlink') {
      // Closing the dialog leaves its already-started request pending.
      await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    }
    await page.getByRole('link', { name: 'Audit Ticket B', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/ticket\/audit-b$/);
    await expect(page.locator('.detail-card').getByText('Audit Ticket B', { exact: true })).toBeVisible();
    await choose(page, page.getByRole('combobox', { name: 'Link to Duplicate' }), 'Audit Ticket D (Pending)');
    const oldResponse = page.waitForResponse(delayedFetch === 'ticket' ? '**/api/tickets/audit-a' : '**/api/tickets');
    release();
    await (await oldResponse).finished();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.locator('.detail-card').getByText('Audit Ticket B', { exact: true })).toBeVisible();
    await expect(page.locator('.detail-card').getByText('Audit Ticket A', { exact: true })).toHaveCount(0);
    await expect(page.locator('.ant-select-selection-item').getByText('Audit Ticket D (Pending)', { exact: true })).toBeVisible();
    const select = page.getByRole('combobox', { name: 'Link to Duplicate' });
    await select.focus();
    await select.press('ArrowDown');
    await expect(page.locator('.ant-select-dropdown:visible').getByText('Audit Ticket B (Pending)', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/^(Duplicate tickets linked|Ticket unlinked) successfully$/)).toHaveCount(0);
  } finally { release(); }
});
}
}
