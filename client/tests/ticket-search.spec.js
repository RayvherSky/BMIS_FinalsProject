import { test, expect } from '@playwright/test';

const owner = { _id: 'resident-search', firstName: 'Ana', lastName: 'Reyes', email: 'ana@example.com', role: 'resident' };
const base = { category: 'Sanitation', status: 'Pending', priority: 'High', location: 'Quirino Avenue', submittedBy: owner, createdAt: '2026-10-18T09:00:00Z', linkedTicket: null, notes: [] };
const active = [
  { ...base, _id: 'north', title: 'Drainage north' },
  { ...base, _id: 'south', title: 'Drainage south' },
  { ...base, _id: 'dismissed', title: 'Dismissed road report', category: 'Infrastructure', status: 'Dismissed', priority: 'Low', location: 'Market', submittedBy: { ...owner, _id: 'other-owner', firstName: 'Ben', lastName: 'Cruz' }, createdAt: '2026-09-01T09:00:00Z' },
  { ...base, _id: 'legacy', title: 'Legacy resolved report', category: 'Infrastructure', priority: 'Low', status: 'Resolved', location: 'Market', submittedBy: { ...owner, _id: 'other-owner', firstName: 'Ben', lastName: 'Cruz' }, createdAt: '2026-09-01T09:00:00Z' },
];
const archived = [
  { ...base, _id: 'archive-resolved', title: 'Archived resolved report', status: 'Resolved', isArchived: true, archivedAt: '2026-10-20T09:00:00Z' },
  { ...base, _id: 'archive-dismissed', title: 'Archived dismissed report', status: 'Dismissed', isArchived: true, archivedAt: '2026-10-20T09:00:00Z' },
];
const rows = page => page.locator('.ant-table-tbody > tr.ant-table-row, .user-report-card');

async function mockLists(page, role = 'admin') {
  await page.route('**/api/tickets/reviews*', route => route.fulfill({ json: { items: [], total: 0, counts: { pending: 0, reviewed: 0 } } }));
  await page.addInitScript(() => localStorage.setItem('token', 'search-fixture'));
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ...owner, role } }));
  for (const [pathname, records] of [['/api/tickets', active], ['/api/tickets/my-tickets', active.filter(ticket => ticket.submittedBy._id === owner._id)], ['/api/archive', archived]]) {
    await page.route(url => url.pathname === pathname, route => {
      const params = new URL(route.request().url()).searchParams;
      const filtered = records.filter(ticket => ['category', 'status', 'priority'].every(key => !params.get(key) || ticket[key] === params.get(key)));
      return route.fulfill({ json: filtered });
    });
  }
}

test('SEARCH admin table updates while typing across every requested field and shows multiple matches', async ({ page }) => {
  await mockLists(page);
  await page.goto('/admin/dashboard');
  await expect(rows(page)).toHaveCount(4);
  const search = page.getByRole('searchbox', { name: 'Search tickets', exact: true });
  for (const query of ['drainage', 'Ana Reyes', 'Sanitation', 'Pending', 'High', 'Quirino', '2026-10-18']) {
    await search.fill(query);
    await expect(rows(page)).toHaveCount(2);
    await expect(page.getByRole('status')).toHaveText('2 matching tickets');
  }
  await search.fill('draingae');
  await expect(rows(page)).toHaveCount(0);
  await page.getByRole('switch', { name: 'Fuzzy search', exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
  await page.getByRole('switch', { name: 'Fuzzy search', exact: true }).click();
  await expect(rows(page)).toHaveCount(0);
  await search.fill('');
  await expect(rows(page)).toHaveCount(4);
});

for (const [role, pathname] of [['resident', '/resident/my-tickets'], ['admin', '/admin/archive']]) {
test(`SEARCH ${pathname} shares live multi-result and fuzzy search`, async ({ page }) => {
  await mockLists(page, role);
  await page.goto(pathname);
  const search = page.getByRole('searchbox', { name: 'Search tickets', exact: true });
  await search.fill('Quirino');
  await expect(rows(page)).toHaveCount(2);
  await search.fill('Quirno');
  await expect(rows(page)).toHaveCount(0);
  await page.getByRole('switch', { name: 'Fuzzy search', exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
  if (pathname.includes('archive')) {
    await search.fill('2026-10-20');
    await page.getByRole('tab', { name: 'Resolved (1)', exact: true }).click();
    await expect(rows(page)).toHaveCount(1);
  }
});
}

test('SEARCH admin tiles open matching searchable active lists and keep archives separate', async ({ page }) => {
  await mockLists(page);
  await page.goto('/admin/dashboard');
  const resolved = page.getByRole('button', { name: 'Show Resolved', exact: true });
  await expect(resolved.locator('.ant-statistic-content-value')).toHaveText('1');
  await resolved.click();
  await expect(rows(page)).toHaveCount(1);
  for (const row of await rows(page).all()) await expect(row).toContainText('Resolved');
  await page.getByRole('searchbox', { name: 'Search tickets', exact: true }).fill('Archived');
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show Archived Tickets', exact: true })).toHaveCount(0);
  const activeTile = page.getByRole('button', { name: 'Show Total Active Tickets', exact: true });
  await activeTile.focus();
  await activeTile.press('Enter');
  await expect(rows(page)).toHaveCount(4);
  await expect(page.getByRole('searchbox', { name: 'Search tickets', exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Show Total Active Tickets', exact: true }).click();
  await expect(rows(page)).toHaveCount(4);
  await page.getByRole('button', { name: 'Show Pending', exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
});

test('SEARCH resident tiles navigate to an owned status list that remains searchable', async ({ page }) => {
  await mockLists(page, 'resident');
  await page.goto('/resident/dashboard');
  await page.getByRole('button', { name: 'Show Pending', exact: true }).click();
  await expect(page).toHaveURL(/\/user\/my-tickets\?status=Pending$/);
  await expect(rows(page)).toHaveCount(2);
  await page.getByRole('searchbox', { name: 'Search tickets', exact: true }).fill('north');
  await expect(rows(page)).toHaveCount(1);
});

test('LINK resolved and archived candidates are absent and a resolved master cannot start linking', async ({ page }) => {
  await mockLists(page);
  await page.route(url => url.pathname === '/api/tickets', route => route.fulfill({ json: [...active, ...archived] }));
  await page.route('**/api/tickets/master', route => route.fulfill({ json: { ...base, _id: 'master', title: 'Master report' } }));
  await page.route('**/api/tickets/resolved-master', route => route.fulfill({ json: { ...base, _id: 'resolved-master', title: 'Resolved master', status: 'Resolved' } }));
  await page.goto('/admin/ticket/master');
  const select = page.getByRole('combobox', { name: 'Link to Duplicate', exact: true });
  await select.focus();
  await select.press('ArrowDown');
  await expect(page.getByRole('option', { name: 'Drainage north (Pending)', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Legacy resolved report (Resolved)', exact: true })).toHaveCount(0);
  await expect(page.getByRole('option', { name: 'Archived resolved report (Resolved)', exact: true })).toHaveCount(0);
  await page.goto('/admin/ticket/resolved-master');
  await expect(page.getByText('Resolved master', { exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Link to Duplicate', exact: true })).toHaveCount(0);
});
