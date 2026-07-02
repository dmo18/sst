import { expect, Page, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

async function mockStatus(page: Page, fixtureName: string): Promise<void> {
  const body = await fs.readFile(path.join(process.cwd(), 'tests', 'fixtures', fixtureName), 'utf8');
  await page.route('**/status.json**', route => route.fulfill({ status: 200, contentType: 'application/json', body }));
}

test('renders clear v9 operator board', async ({ page }, testInfo) => {
  await mockStatus(page, 'status-clear.json');
  await page.goto('/sst/');
  const panel = page.locator('.operator-board');
  await expect(panel).toHaveCSS('width', '458px');
  await expect(panel).toHaveCSS('height', '291px');
  await expect(page.getByText('ACTIVE ISSUES')).toBeVisible();
  await expect(page.getByText('v9')).toBeVisible();
  await expect(page.getByText('CLEAR')).toBeVisible();
  await expect(page.getByText('DIAGNOSTIC PROVIDER LIST')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('v9-clear.png'), fullPage: true });
});

test('renders active issue operator board and diagnostic rows', async ({ page }, testInfo) => {
  await mockStatus(page, 'status-three-incidents.json');
  await page.goto('/sst/');
  const panel = page.locator('.operator-board');
  await expect(panel).toHaveCSS('width', '458px');
  await expect(panel).toHaveCSS('height', '291px');
  await expect(page.getByText('Workers AI degraded availability')).toBeVisible();
  await expect(page.locator('.lead-issue')).toHaveCount(1);
  await expect(page.locator('.rail-item')).toHaveCount(2);
  await expect(page.locator('.diag-panel tbody tr').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('v9-issues.png'), fullPage: true });
});
