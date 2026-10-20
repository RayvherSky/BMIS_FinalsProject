import { test, expect } from '@playwright/test';
import { testPhone } from './helpers/phone';

const password = 'Password123!';
async function login(page, identifier, destination = /\/user\/dashboard$/) {
  await page.goto('/login');
  await page.getByPlaceholder('Phone Number or Email', { exact: true }).fill(identifier);
  await page.getByPlaceholder('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(destination);
}
test('CONTACT phone-only registration, normalized phone login and required profile contact work together', async ({ page, request }) => {
  const phone = testPhone();
  await page.goto('/register');
  await page.getByPlaceholder('First Name', { exact: true }).fill('Phone');
  await page.getByPlaceholder('Last Name', { exact: true }).fill('Only');
  await page.getByPlaceholder('Password', { exact: true }).fill(password);
  await page.getByPlaceholder('Confirm Password', { exact: true }).fill(password);
  await page.getByPlaceholder('Phone Number', { exact: true }).fill(`+63 ${phone.slice(1)}`);
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/user\/dashboard$/);
  await page.goto('/profile');
  await expect(page.getByText(phone, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Profile', exact: true }).click();
  await page.getByLabel('Phone', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.ant-form-item-explain-error')).toContainText('contact number');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.evaluate(() => localStorage.clear());
  await login(page, `+63 ${phone.slice(1)}`);
  const duplicate = await request.post('/api/auth/register', { data: { firstName: 'Duplicate', lastName: 'Phone', password, phone } });
  expect(duplicate.status()).toBe(400);
});

test('CONTACT Admin can search and confirm role/status changes for a phone-only account', async ({ page, request }) => {
  const phone = testPhone();
  const registration = await request.post('/api/auth/register', { data: { firstName: 'Phone', lastName: 'Managed', password, phone } });
  expect(registration.status()).toBe(201);
  await login(page, 'maria.santos@email.com', /\/admin\/dashboard$/);
  await page.goto('/admin/users');
  const search = page.getByPlaceholder('Search users by name, email or phone');
  await search.fill(phone); await search.press('Enter');
  const row = page.getByRole('row').filter({ hasText: phone });
  await row.getByRole('button', { name: 'Change Role', exact: true }).click();
  const role = page.getByRole('combobox', { name: 'New Role', exact: true });
  await role.focus(); await role.press('ArrowDown');
  await page.getByRole('option', { name: 'Employee', exact: true }).click();
  await page.getByLabel('Confirm account phone', { exact: true }).fill(phone);
  await page.getByRole('button', { name: /Confirm Role Change$/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(row).toContainText('Employee');
  await row.getByRole('button', { name: 'Deactivate', exact: true }).click();
  await page.getByRole('dialog', { name: 'Deactivate Account', exact: true }).getByLabel('Confirm account phone', { exact: true }).fill(phone);
  await page.getByRole('button', { name: 'Confirm Account Status', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(row).toContainText('Inactive');
});

test('CONTACT phone-only password recovery generates the existing demo reset link', async ({ page, request }) => {
  const phone = testPhone();
  expect((await request.post('/api/auth/register', { data: { firstName: 'Phone', lastName: 'Recover', password, phone } })).status()).toBe(201);
  await page.goto('/forgot-password');
  await page.getByPlaceholder('Phone Number or Email', { exact: true }).fill(phone);
  await page.getByRole('button', { name: 'Send Reset Link', exact: true }).click();
  await expect(page.getByText('Reset Link Generated', { exact: true })).toBeVisible();
  await expect(page.getByText('Password Reset Link (Demo)', { exact: true })).toBeVisible();
  await expect(page.locator('.ant-alert-description')).toContainText('No email or SMS is sent');
});
