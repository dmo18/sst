import { expect, Page, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

async function mockStatus(page: Page, fixtureName: string): Promise<void> {
  const body = await fs.readFile(path.join(process.cwd(), 'tests', 'fixtures', fixtureName), 'utf8');
  await page.route('**/status.json**', route => route.fulfill({ status: 200, contentType: 'application/json', body }));
}

test('renders clear dashboard state', async ({ page }, testInfo) => {
  await mockStatus(page, 'status-clear.json');
  await page.goto('/sst/');
  await expect(page.getByText('Service health dashboard')).toBeVisible();
  await expect(page.getByText('All clear')).toBeVisible();
  await expect(page.getByText('Provider matrix')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('dashboard-clear.png'), fullPage: true });
});

test('renders active incidents and provider matrix', async ({ page }, testInfo) => {
  await mockStatus(page, 'status-three-incidents.json');
  await page.goto('/sst/');
  await expect(page.getByText('Workers AI degraded availability')).toBeVisible();
  await expect(page.locator('.incident')).toHaveCount(3);
  await expect(page.locator('.provider').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('dashboard-incidents.png'), fullPage: true });
});
