import { test, expect } from '@playwright/test';

test('login, hosted-zone defaults, record CRUD, and logout', async ({ page }) => {
  const zoneName = `e2e-${Date.now()}.example.com`;
  await page.goto('/login');
  await page.getByLabel('Username').fill('demo');
  await page.getByLabel('Password').fill('demo1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/hosted-zones$/);

  await page.getByRole('button', { name: 'Create hosted zone' }).click();
  await page.getByLabel('Domain name').fill(zoneName);
  await page.getByRole('button', { name: 'Create hosted zone', exact: true }).last().click();
  await expect(page.getByText(`${zoneName}.`)).toBeVisible();

  await page.getByRole('link', { name: `${zoneName}.` }).click();
  await expect(page.getByRole('cell', { name: 'NS', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'SOA', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Create record' }).click();
  await page.getByLabel('Record name').fill(`www.${zoneName}`);
  await page.getByLabel('A values').fill('192.0.2.44');
  await page.getByRole('button', { name: 'Create record', exact: true }).last().click();
  await expect(page.getByText(`www.${zoneName}.`)).toBeVisible();

  await page.getByLabel('Filter records').fill('www.');
  await expect(page.getByText(`www.${zoneName}.`)).toBeVisible();
  await page.getByRole('button', { name: 'Delete' }).last().click();
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
  await expect(page.getByText(`www.${zoneName}.`)).toHaveCount(0);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
