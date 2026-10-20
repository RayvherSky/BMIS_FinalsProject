import { test, expect } from '@playwright/test';

const resident = { _id: '000000000000000000000001', firstName: 'Ana', lastName: 'Reyes', email: 'ana.reyes@email.com', role: 'resident' };
const admin = { ...resident, _id: '000000000000000000000002', role: 'admin' };

async function mockSession(page, account = resident) {
  await page.route('**/api/tickets/reviews*', route => route.fulfill({ json: { items: [], total: 0, counts: { pending: 0, reviewed: 0 } } }));
  await page.addInitScript(() => localStorage.setItem('token', 'navigation-test-token'));
  await page.route('**/api/auth/me', route => route.fulfill({ json: account }));
  await page.route('**/api/tickets/my-tickets*', route => route.fulfill({ json: [] }));
}

async function session(request, email) {
  const response = await request.post('/api/auth/login', { data: { email, password: 'Password123!' } });
  expect(response.status()).toBe(200);
  const data = await response.json();
  return { ...data, headers: { Authorization: `Bearer ${data.token}` } };
}

test('NAV sidebar stays mounted and collapsed while its active highlight follows navigation', async ({ page }) => {
  await mockSession(page);
  await page.goto('/resident/dashboard');
  await expect(page.getByRole('button', { name: 'Collapse sidebar', exact: true })).toBeVisible();
  await expect(page.locator('.ant-layout-sider-trigger')).toHaveCount(0);
  const shell = await page.locator('#primary-sidebar').elementHandle();
  await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
  await page.getByRole('menuitem', { name: /My Tickets$/ }).click();
  await expect(page).toHaveURL(/\/user\/my-tickets$/);
  await expect(page.getByRole('button', { name: 'Expand sidebar', exact: true })).toBeVisible();
  expect(await shell.evaluate(node => node.isConnected)).toBe(true);
  const selected = page.locator('.sidebar-navigation .ant-menu-item-selected');
  await expect(selected).toContainText('My Tickets');
  const marker = page.locator('.sidebar-active-indicator');
  await expect(marker).toBeVisible();
  await expect.poll(async () => Math.abs((await marker.boundingBox()).y - (await selected.boundingBox()).y)).toBeLessThan(1);
  await page.goBack();
  await expect(page.locator('.sidebar-navigation .ant-menu-item-selected')).toContainText('Dashboard');
  await expect(page.getByRole('button', { name: 'Expand sidebar', exact: true })).toBeVisible();
});

test('NAV prominent resident actions navigate correctly at a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockSession(page);
  await page.goto('/resident/dashboard');
  for (const name of [/Report New Incident$/, /View all tickets$/]) {
    const action = page.getByRole('button', { name });
    await expect(action).toBeVisible();
    await expect.poll(async () => (await action.boundingBox()).x).toBeGreaterThanOrEqual(0);
    await expect.poll(async () => { const box = await action.boundingBox(); return box.x + box.width; }).toBeLessThanOrEqual(375);
    expect((await action.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole('button', { name: /Report New Incident$/ }).click();
  await expect(page).toHaveURL(/\/user\/submit-ticket$/);
  await page.goBack();
  await page.getByRole('button', { name: /View all tickets$/ }).click();
  await expect(page).toHaveURL(/\/user\/my-tickets$/);
});

test('NAV reduced-motion preference disables dashboard and sidebar motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockSession(page);
  await page.goto('/resident/dashboard');
  await expect(page.getByRole('heading', { name: 'Welcome, Ana!', exact: true })).toBeVisible();
  expect(await page.locator('.dashboard-page').evaluate(node => getComputedStyle(node).animationName)).toBe('none');
  expect(await page.locator('.stats-row > .ant-col').first().evaluate(node => getComputedStyle(node).animationName)).toBe('none');
  await expect(page.locator('.sidebar-active-indicator')).toBeVisible();
  expect(await page.locator('.sidebar-active-indicator').evaluate(node => getComputedStyle(node).transitionDuration)).toBe('0s');
});

test('NAV dashboard enters from the right edge without horizontal page overflow', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await mockSession(page);
  await page.goto('/resident/dashboard');
  await expect(page.getByRole('button', { name: /Report New Incident$/ })).toBeVisible();
  const initial = await page.locator('.dashboard-page').evaluate(node => {
    const animation = node.getAnimations().find(item => item.effect.target === node);
    if (!animation) throw new Error('Dashboard entry animation did not start');
    animation.pause();
    animation.currentTime = 0;
    return { left: node.getBoundingClientRect().left, edge: node.parentElement.getBoundingClientRect().right };
  });
  expect(initial.left).toBeGreaterThanOrEqual(initial.edge - 8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  const settled = await page.locator('.dashboard-page').evaluate(node => {
    node.getAnimations().find(item => item.effect.target === node).finish();
    return { left: node.getBoundingClientRect().left, edge: node.parentElement.getBoundingClientRect().left };
  });
  expect(Math.abs(settled.left - settled.edge - 8)).toBeLessThan(1);
});

test('NAV newly resolved reports auto-archive and status tabs combine with category filters', async ({ page, request }) => {
  const manager = await session(request, 'maria.santos@email.com');
  const owner = await session(request, 'ana.reyes@email.com');
  const prefix = `Navigation archive ${Date.now()}`;
  const reports = [];
  for (const [suffix, category] of [['resolved infrastructure', 'Infrastructure'], ['resolved sanitation', 'Sanitation'], ['dismissed infrastructure', 'Infrastructure']]) {
    const created = await request.post('/api/tickets', { headers: owner.headers, data: {
      title: `${prefix} ${suffix}`, description: 'Maintenance request.', location: 'Baclaran', category,
    } });
    expect(created.status()).toBe(201);
    reports.push(await created.json());
  }
  for (const ticket of reports.slice(0, 2)) {
    const resolved = await request.put(`/api/tickets/${ticket._id}/status`, { headers: manager.headers, data: { status: 'Resolved' } });
    expect(resolved.status()).toBe(200);
    expect(await resolved.json()).toMatchObject({ isArchived: true, status: 'Resolved' });
  }
  const dismissed = await request.put(`/api/tickets/${reports[2]._id}/status`, { headers: manager.headers, data: { status: 'Dismissed' } });
  expect((await dismissed.json()).isArchived).toBe(false);
  expect((await request.put(`/api/archive/${reports[2]._id}/archive`, { headers: manager.headers })).status()).toBe(200);
  await page.addInitScript(token => localStorage.setItem('token', token), manager.token);
  await page.goto('/admin/archive');
  const search = page.getByPlaceholder('Search archived tickets');
  await search.fill(prefix);
  await search.press('Enter');
  await page.getByRole('tab', { name: 'Resolved (2)', exact: true }).click();
  await expect(page.locator('.ant-table-tbody > tr.ant-table-row')).toHaveCount(2);
  const category = page.getByRole('combobox', { name: 'Category filter', exact: true });
  await category.focus();
  await category.press('ArrowDown');
  await page.getByRole('option', { name: 'Infrastructure', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Resolved (1)', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText(reports[0].title, { exact: true })).toBeVisible();
  await expect(page.getByText(reports[1].title, { exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Dismissed (1)', exact: true }).click();
  await expect(page.getByText(reports[2].title, { exact: true })).toBeVisible();
  await expect(page.getByText(reports[0].title, { exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'All (2)', exact: true }).click();
  await page.getByRole('button', { name: reports[0].title, exact: true }).click();
  await expect(page.locator('.sidebar-navigation .ant-menu-item-selected')).toContainText('Archive');
  await page.getByRole('button', { name: /Back to tickets$/ }).click();
  await expect(page).toHaveURL(/\/admin\/archive$/);
});

for (const phase of ['loading', 'failed']) {
test(`NAV Archive back navigation survives a ${phase} detail request`, async ({ page }) => {
  await mockSession(page, admin);
  const ticket = {
    _id: 'archive-origin', title: 'Archive navigation report', category: 'Infrastructure', status: 'Resolved',
    isArchived: true, archivedAt: '2026-10-18T00:00:00Z', submittedBy: resident,
  };
  await page.route(url => url.pathname === '/api/archive', route => route.fulfill({ json: [ticket] }));
  await page.route(url => url.pathname === '/api/tickets', route => route.fulfill({ json: [] }));
  let release;
  const delayed = new Promise(resolve => { release = resolve; });
  await page.route('**/api/tickets/archive-origin', async route => {
    if (phase === 'loading') await delayed;
    await route.fulfill({ status: 503, json: { message: 'Detail service unavailable' } });
  });
  try {
    await page.goto('/admin/archive');
    const requested = page.waitForRequest('**/api/tickets/archive-origin');
    await page.getByRole('button', { name: ticket.title, exact: true }).click();
    await requested;
    if (phase === 'failed') await expect(page.getByText('Detail service unavailable', { exact: true })).toBeVisible();
    await expect(page.locator('.sidebar-navigation .ant-menu-item-selected')).toContainText('Archive');
    await page.getByRole('button', { name: /Back to tickets$/ }).click();
    await expect(page).toHaveURL(/\/admin\/archive$/);
    await expect(page.getByRole('button', { name: ticket.title, exact: true })).toBeVisible();
  } finally { release(); }
});
}

test('NAV restoring the last row on a filtered archive page returns to a populated page', async ({ page }) => {
  await mockSession(page, admin);
  const records = Array.from({ length: 11 }, (_, index) => ({
    _id: `archive-${index + 1}`, title: `Archive resolved ${String(index + 1).padStart(2, '0')}`, category: 'Infrastructure', status: 'Resolved', isArchived: true,
    archivedAt: '2026-10-18T00:00:00Z', submittedBy: resident,
  }));
  await page.route(url => url.pathname === '/api/archive', route => route.fulfill({ json: [...records, { ...records[0], _id: 'dismissed-one', title: 'Archive dismissed', status: 'Dismissed' }] }));
  await page.route('**/api/archive/archive-11/restore', route => route.fulfill({ json: { ...records[10], isArchived: false, archivedAt: null } }));
  await page.goto('/admin/archive');
  await page.getByRole('tab', { name: 'Resolved (11)', exact: true }).click();
  await page.locator('.ant-pagination-item-2').click();
  const row = page.getByRole('row').filter({ hasText: 'Archive resolved 11' });
  await row.getByRole('button', { name: 'Restore', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Resolved (10)', exact: true })).toBeVisible();
  await expect(page.locator('.ant-pagination-item-active')).toHaveAttribute('title', '1');
  await expect(page.getByText('Archive resolved 01', { exact: true })).toBeVisible();
  await expect(page.getByText('Archive dismissed', { exact: true })).toHaveCount(0);
});
