import { expect, Page, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

async function mockStatus(page: Page, fixtureName: string): Promise<void> {
  const body = await fs.readFile(path.join(process.cwd(), 'tests', 'fixtures', fixtureName), 'utf8');
  await page.route('**/status.json**', route => route.fulfill({ status: 200, contentType: 'application/json', body }));
}

test('renders clear v6 status wall state', async ({ page }, testInfo) => {
  await mockStatus(page, 'status-clear.json');
  await page.goto('/sst/');
  await expect(page.getByText('MSP STATUS WALL')).toBeVisible();
  await expect(page.getByText('v6')).toBeVisible();
  await expect(page.getByText('All clear')).toBeVisible();
  await expect(page.getByText('Provider health matrix')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('status-wall-clear.png'), fullPage: true });
});

test('renders active incidents and provider matrix', async ({ page }, testInfo) => {
  await mockStatus(page, 'status-three-incidents.json');
  await page.goto('/sst/');
  await expect(page.getByText('MSP STATUS WALL')).toBeVisible();
  await expect(page.getByText('Workers AI degraded availability')).toBeVisible();
  await expect(page.locator('.incident-panel')).toHaveCount(1);
  await expect(page.locator('.incident-line')).toHaveCount(2);
  await expect(page.locator('.provider-line').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('status-wall-incidents.png'), fullPage: true });
});
